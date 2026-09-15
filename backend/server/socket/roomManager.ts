import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { calculateEloChange } from '../services/eloService';
import { runTestsLocally, TestCase } from '../services/executionService';

const prisma = new PrismaClient();

export interface Player {
  id: string;
  username: string;
  elo: number;
  socketId: string;
  connected: boolean;
  code?: string;
  language?: string;
}

export interface Room {
  roomCode: string;
  player1: Player | null;
  player2: Player | null;
  spectators: string[];
  problemId: string;
  problem?: any;
  status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
  startTime?: number;
  timeRemainingSec: number;
  winnerId?: string | null;
  disconnectTimerP1?: NodeJS.Timeout;
  disconnectTimerP2?: NodeJS.Timeout;
  yjsState?: Uint8Array;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private matchmakingQueue: Player[] = [];
  private io: Server | null = null;
  private timerInterval: NodeJS.Timeout | null = null;

  public init(io: Server) {
    this.io = io;
    this.startGlobalTimer();
  }

  public getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public async createRoom(host: Player, isPrivate: boolean = true): Promise<Room> {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Pick random problem from DB
    const problems = await prisma.problem.findMany();
    const problem = problems.length > 0 
      ? problems[Math.floor(Math.random() * problems.length)]
      : null;

    const room: Room = {
      roomCode,
      player1: { ...host, connected: true },
      player2: null,
      spectators: [],
      problemId: problem?.id || 'default',
      problem,
      status: 'WAITING',
      timeRemainingSec: 600, // 10 minutes
    };

    this.rooms.set(roomCode, room);

    // Save match draft in DB
    if (problem) {
      await prisma.match.create({
        data: {
          roomCode,
          player1Id: host.id,
          problemId: problem.id,
          status: 'WAITING',
        },
      }).catch(() => {});
    }

    return room;
  }

  public async joinRoom(roomCode: string, player: Player): Promise<{ room?: Room; error?: string }> {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { error: 'Room not found' };
    }

    // Check if player is reconnecting
    if (room.player1 && room.player1.id === player.id) {
      room.player1.socketId = player.socketId;
      room.player1.connected = true;
      if (room.disconnectTimerP1) {
        clearTimeout(room.disconnectTimerP1);
        room.disconnectTimerP1 = undefined;
      }
      return { room };
    }

    if (room.player2 && room.player2.id === player.id) {
      room.player2.socketId = player.socketId;
      room.player2.connected = true;
      if (room.disconnectTimerP2) {
        clearTimeout(room.disconnectTimerP2);
        room.disconnectTimerP2 = undefined;
      }
      return { room };
    }

    // New player 2 joining
    if (!room.player2 && room.player1?.id !== player.id) {
      room.player2 = { ...player, connected: true };
      room.status = 'IN_PROGRESS';
      room.startTime = Date.now();

      // Update match record in DB
      await prisma.match.update({
        where: { roomCode: code },
        data: {
          player2Id: player.id,
          status: 'IN_PROGRESS',
        },
      }).catch(() => {});

      return { room };
    }

    // Otherwise add as spectator
    if (!room.spectators.includes(player.socketId)) {
      room.spectators.push(player.socketId);
    }

    return { room };
  }

  public addToMatchmaking(player: Player) {
    // Check if already in queue
    if (this.matchmakingQueue.some(p => p.id === player.id)) return;

    this.matchmakingQueue.push(player);
    this.processMatchmaking();
  }

  public removeFromMatchmaking(socketId: string) {
    this.matchmakingQueue = this.matchmakingQueue.filter(p => p.socketId !== socketId);
  }

  private async processMatchmaking() {
    if (this.matchmakingQueue.length < 2) return;

    const p1 = this.matchmakingQueue.shift()!;
    const p2 = this.matchmakingQueue.shift()!;

    const room = await this.createRoom(p1, false);
    await this.joinRoom(room.roomCode, p2);

    if (this.io) {
      this.io.to(p1.socketId).emit('match_found', { roomCode: room.roomCode });
      this.io.to(p2.socketId).emit('match_found', { roomCode: room.roomCode });
    }
  }

  public handleDisconnect(socketId: string) {
    this.removeFromMatchmaking(socketId);

    for (const [roomCode, room] of this.rooms.entries()) {
      if (room.player1?.socketId === socketId) {
        room.player1.connected = false;
        if (room.status === 'IN_PROGRESS') {
          // Set 60 second reconnect timer
          room.disconnectTimerP1 = setTimeout(() => {
            this.handleForfeit(roomCode, room.player1?.id || '', 'Player 1 disconnected (timeout)');
          }, 60000);
        }
        if (this.io) this.io.to(roomCode).emit('player_status_change', { player: 'p1', connected: false });
      } else if (room.player2?.socketId === socketId) {
        room.player2.connected = false;
        if (room.status === 'IN_PROGRESS') {
          room.disconnectTimerP2 = setTimeout(() => {
            this.handleForfeit(roomCode, room.player2?.id || '', 'Player 2 disconnected (timeout)');
          }, 60000);
        }
        if (this.io) this.io.to(roomCode).emit('player_status_change', { player: 'p2', connected: false });
      }
    }
  }

  public async handleForfeit(roomCode: string, forfeitingUserId: string, reason: string) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status === 'FINISHED') return;

    const winnerId = room.player1?.id === forfeitingUserId ? room.player2?.id : room.player1?.id;
    await this.finishMatch(roomCode, winnerId || null, reason);
  }

  public async finishMatch(roomCode: string, winnerId: string | null, outcomeReason: string) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status === 'FINISHED') return;

    room.status = 'FINISHED';
    room.winnerId = winnerId;

    let p1EloDelta = 0;
    let p2EloDelta = 0;

    if (room.player1 && room.player2) {
      const outcome = winnerId === room.player1.id ? 'p1_win' : winnerId === room.player2.id ? 'p2_win' : 'draw';
      const eloRes = calculateEloChange(room.player1.elo, room.player2.elo, outcome);

      p1EloDelta = eloRes.p1Delta;
      p2EloDelta = eloRes.p2Delta;

      // Update User ELO in database
      await prisma.user.update({
        where: { id: room.player1.id },
        data: {
          elo: eloRes.p1NewElo,
          wins: outcome === 'p1_win' ? { increment: 1 } : undefined,
          losses: outcome === 'p2_win' ? { increment: 1 } : undefined,
          draws: outcome === 'draw' ? { increment: 1 } : undefined,
        },
      }).catch(() => {});

      await prisma.user.update({
        where: { id: room.player2.id },
        data: {
          elo: eloRes.p2NewElo,
          wins: outcome === 'p2_win' ? { increment: 1 } : undefined,
          losses: outcome === 'p1_win' ? { increment: 1 } : undefined,
          draws: outcome === 'draw' ? { increment: 1 } : undefined,
        },
      }).catch(() => {});

      // Update Match record
      await prisma.match.update({
        where: { roomCode },
        data: {
          status: winnerId ? 'FINISHED' : 'DRAW',
          winnerId: winnerId || undefined,
          player1EloDelta: p1EloDelta,
          player2EloDelta: p2EloDelta,
          endedAt: new Date(),
        },
      }).catch(() => {});
    }

    if (this.io) {
      this.io.to(roomCode).emit('match_ended', {
        winnerId,
        reason: outcomeReason,
        player1EloDelta: p1EloDelta,
        player2EloDelta: p2EloDelta,
      });
    }
  }

  private startGlobalTimer() {
    this.timerInterval = setInterval(() => {
      for (const [roomCode, room] of this.rooms.entries()) {
        if (room.status === 'IN_PROGRESS') {
          room.timeRemainingSec -= 1;

          if (this.io) {
            this.io.to(roomCode).emit('timer_tick', { timeRemainingSec: room.timeRemainingSec });
          }

          if (room.timeRemainingSec <= 0) {
            this.finishMatch(roomCode, null, 'Time Limit Reached - Match Draw!');
          }
        }
      }
    }, 1000);
  }
}

export const roomManager = new RoomManager();
