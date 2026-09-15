import { Server } from 'socket.io';
import { prisma } from '../lib/db';
import { calculateEloChange } from '../services/eloService';

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
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private matchmakingQueue: Player[] = [];
  private io: Server | null = null;
  private timerInterval: NodeJS.Timeout | null = null;
  private isProcessingQueue = false;
  private finishingLocks: Set<string> = new Set();

  public init(io: Server) {
    this.io = io;
    this.startGlobalTimer();
  }

  public getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public getRooms(): Map<string, Room> {
    return this.rooms;
  }

  public async createRoom(host: Player, isPrivate: boolean = true): Promise<Room> {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Pick random problem from DB
    const problems = await prisma.problem.findMany();
    if (problems.length === 0) {
      throw new Error('No competitive programming problems available. Please seed database first.');
    }

    const problem = problems[Math.floor(Math.random() * problems.length)];

    const room: Room = {
      roomCode,
      player1: { ...host, connected: true },
      player2: null,
      spectators: [],
      problemId: problem.id,
      problem,
      status: 'WAITING',
      timeRemainingSec: 600, // 10 minutes
    };

    this.rooms.set(roomCode, room);

    // Save match draft in DB with error handling
    try {
      await prisma.match.create({
        data: {
          roomCode,
          player1Id: host.id,
          problemId: problem.id,
          status: 'WAITING',
        },
      });
    } catch (err) {
      console.error(`Failed to create match draft for room ${roomCode}:`, err);
    }

    return room;
  }

  public async joinRoom(roomCode: string, player: Player): Promise<{ room?: Room; error?: string }> {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { error: 'Room not found' };
    }

    // Check if player 1 is reconnecting
    if (room.player1 && room.player1.id === player.id) {
      room.player1.socketId = player.socketId;
      room.player1.connected = true;
      if (room.disconnectTimerP1) {
        clearTimeout(room.disconnectTimerP1);
        room.disconnectTimerP1 = undefined;
      }
      return { room };
    }

    // Check if player 2 is reconnecting
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

      try {
        await prisma.match.update({
          where: { roomCode: code },
          data: {
            player2Id: player.id,
            status: 'IN_PROGRESS',
          },
        });
      } catch (err) {
        console.error(`Failed to update match record for room ${code}:`, err);
      }

      return { room };
    }

    // Otherwise add as spectator
    if (!room.spectators.includes(player.socketId)) {
      room.spectators.push(player.socketId);
    }

    return { room };
  }

  public addToMatchmaking(player: Player) {
    if (this.matchmakingQueue.some((p) => p.id === player.id)) return;
    this.matchmakingQueue.push(player);
    this.processMatchmaking();
  }

  public removeFromMatchmaking(socketId: string) {
    this.matchmakingQueue = this.matchmakingQueue.filter((p) => p.socketId !== socketId);
  }

  private async processMatchmaking() {
    if (this.isProcessingQueue || this.matchmakingQueue.length < 2) return;
    this.isProcessingQueue = true;

    try {
      while (this.matchmakingQueue.length >= 2) {
        const p1 = this.matchmakingQueue.shift()!;
        const p2 = this.matchmakingQueue.shift()!;

        try {
          const room = await this.createRoom(p1, false);
          await this.joinRoom(room.roomCode, p2);

          if (this.io) {
            this.io.to(p1.socketId).emit('match_found', { roomCode: room.roomCode });
            this.io.to(p2.socketId).emit('match_found', { roomCode: room.roomCode });
          }
        } catch (err) {
          console.error('Matchmaking pair creation failed:', err);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  public handleDisconnect(socketId: string) {
    this.removeFromMatchmaking(socketId);

    for (const [roomCode, room] of this.rooms.entries()) {
      if (room.player1?.socketId === socketId) {
        room.player1.connected = false;
        if (room.status === 'IN_PROGRESS') {
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
    // Atomic finish match lock check
    if (this.finishingLocks.has(roomCode)) return;
    const room = this.rooms.get(roomCode);
    if (!room || room.status === 'FINISHED') return;

    this.finishingLocks.add(roomCode);

    try {
      room.status = 'FINISHED';
      room.winnerId = winnerId;

      let p1EloDelta = 0;
      let p2EloDelta = 0;

      if (room.player1 && room.player2) {
        const outcome = winnerId === room.player1.id ? 'p1_win' : winnerId === room.player2.id ? 'p2_win' : 'draw';
        const eloRes = calculateEloChange(room.player1.elo, room.player2.elo, outcome);

        p1EloDelta = eloRes.p1Delta;
        p2EloDelta = eloRes.p2Delta;

        try {
          await prisma.user.update({
            where: { id: room.player1.id },
            data: {
              elo: eloRes.p1NewElo,
              wins: outcome === 'p1_win' ? { increment: 1 } : undefined,
              losses: outcome === 'p2_win' ? { increment: 1 } : undefined,
              draws: outcome === 'draw' ? { increment: 1 } : undefined,
            },
          });

          await prisma.user.update({
            where: { id: room.player2.id },
            data: {
              elo: eloRes.p2NewElo,
              wins: outcome === 'p2_win' ? { increment: 1 } : undefined,
              losses: outcome === 'p1_win' ? { increment: 1 } : undefined,
              draws: outcome === 'draw' ? { increment: 1 } : undefined,
            },
          });

          await prisma.match.update({
            where: { roomCode },
            data: {
              status: winnerId ? 'FINISHED' : 'DRAW',
              winnerId: winnerId || undefined,
              player1EloDelta: p1EloDelta,
              player2EloDelta: p2EloDelta,
              endedAt: new Date(),
            },
          });
        } catch (dbErr) {
          console.error(`Database error during match finish for room ${roomCode}:`, dbErr);
        }
      }

      if (this.io) {
        this.io.to(roomCode).emit('match_ended', {
          winnerId,
          reason: outcomeReason,
          player1EloDelta: p1EloDelta,
          player2EloDelta: p2EloDelta,
        });
      }

      // Schedule room memory cleanup after 1 hour
      this.scheduleRoomCleanup(roomCode);
    } finally {
      this.finishingLocks.delete(roomCode);
    }
  }

  private scheduleRoomCleanup(roomCode: string) {
    setTimeout(() => {
      const room = this.rooms.get(roomCode);
      if (room && room.status === 'FINISHED') {
        this.rooms.delete(roomCode);
        console.log(`Cleaned up expired finished room: ${roomCode}`);
      }
    }, 3600000); // 1 hour
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
