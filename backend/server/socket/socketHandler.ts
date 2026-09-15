import { Server, Socket } from 'socket.io';
import { roomManager } from './roomManager';
import { runTestsLocally, TestCase } from '../services/executionService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupSocketHandlers(io: Server) {
  roomManager.init(io);

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join Matchmaking Queue
    socket.on('join_queue', (playerData: { id: string; username: string; elo: number }) => {
      roomManager.addToMatchmaking({
        ...playerData,
        socketId: socket.id,
        connected: true,
      });
    });

    // Cancel Queue
    socket.on('leave_queue', () => {
      roomManager.removeFromMatchmaking(socket.id);
    });

    // Create Room
    socket.on('create_room', async (playerData: { id: string; username: string; elo: number }, callback) => {
      const room = await roomManager.createRoom({
        ...playerData,
        socketId: socket.id,
        connected: true,
      });
      socket.join(room.roomCode);
      if (typeof callback === 'function') callback({ roomCode: room.roomCode, room });
    });

    // Join Room
    socket.on('join_room', async (data: { roomCode: string; user: { id: string; username: string; elo: number } }, callback) => {
      const result = await roomManager.joinRoom(data.roomCode, {
        ...data.user,
        socketId: socket.id,
        connected: true,
      });

      if (result.error) {
        if (typeof callback === 'function') callback({ error: result.error });
        return;
      }

      socket.join(data.roomCode.toUpperCase());
      const room = result.room!;

      // Notify room members
      io.to(room.roomCode).emit('room_updated', { room });

      if (typeof callback === 'function') callback({ room });
    });

    // Collaborative Editor Sync (Yjs or Socket Broadcast)
    socket.on('code_change', (data: { roomCode: string; code: string; language: string; cursor?: any }) => {
      socket.to(data.roomCode.toUpperCase()).emit('opponent_code_update', {
        code: data.code,
        language: data.language,
        cursor: data.cursor,
        senderSocketId: socket.id,
      });
    });

    // CRDT Yjs Binary Update
    socket.on('yjs_update', (data: { roomCode: string; update: ArrayBuffer }) => {
      socket.to(data.roomCode.toUpperCase()).emit('yjs_update', data.update);
    });

    // Run Code against Sample Tests
    socket.on('run_code', async (data: { roomCode: string; code: string; language: 'javascript' | 'python' }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || !room.problem) {
        if (typeof callback === 'function') callback({ error: 'Problem not found' });
        return;
      }

      const sampleTests: TestCase[] = JSON.parse(room.problem.sampleTests || '[]');
      const executionResult = await runTestsLocally(data.code, data.language, sampleTests);

      if (typeof callback === 'function') callback(executionResult);
    });

    // Submit Code against Hidden Test Cases
    socket.on('submit_code', async (data: { roomCode: string; userId: string; code: string; language: 'javascript' | 'python' }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || !room.problem || room.status === 'FINISHED') {
        if (typeof callback === 'function') callback({ error: 'Match is inactive' });
        return;
      }

      const hiddenTests: TestCase[] = JSON.parse(room.problem.hiddenTests || '[]');
      const executionResult = await runTestsLocally(data.code, data.language, hiddenTests);

      // Save submission in DB
      const matchRecord = await prisma.match.findUnique({ where: { roomCode: room.roomCode } });
      if (matchRecord) {
        await prisma.submission.create({
          data: {
            matchId: matchRecord.id,
            userId: data.userId,
            code: data.code,
            language: data.language,
            status: executionResult.status,
            testsPassed: executionResult.testsPassed,
            totalTests: executionResult.totalTests,
            executionTimeMs: executionResult.executionTimeMs,
          },
        }).catch(() => {});
      }

      // Notify room about submission attempt
      io.to(room.roomCode).emit('submission_attempt', {
        userId: data.userId,
        testsPassed: executionResult.testsPassed,
        totalTests: executionResult.totalTests,
        status: executionResult.status,
      });

      // If user passed ALL hidden test cases -> WINNER!
      if (executionResult.status === 'ACCEPTED') {
        await roomManager.finishMatch(room.roomCode, data.userId, `Passed all ${executionResult.totalTests} test cases!`);
      }

      if (typeof callback === 'function') callback(executionResult);
    });

    // Forfeit Match
    socket.on('forfeit_match', async (data: { roomCode: string; userId: string }) => {
      await roomManager.handleForfeit(data.roomCode, data.userId, 'Player surrendered');
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      roomManager.handleDisconnect(socket.id);
    });
  });
}
