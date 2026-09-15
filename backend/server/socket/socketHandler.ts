import { Server, Socket } from 'socket.io';
import { roomManager } from './roomManager';
import { runTestsLocally, TestCase } from '../services/executionService';
import { prisma } from '../lib/db';

function safeParseTests(data: string): TestCase[] {
  try {
    const parsed = JSON.parse(data || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.input === 'string' && typeof t.expected === 'string');
  } catch (err) {
    console.error('Failed to parse test JSON:', err);
    return [];
  }
}

function safeCallback(callback: any, data: any) {
  try {
    if (typeof callback === 'function') {
      callback(data);
    }
  } catch (err) {
    console.error('Socket ACK callback error:', err);
  }
}

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
      try {
        const room = await roomManager.createRoom({
          ...playerData,
          socketId: socket.id,
          connected: true,
        });
        socket.join(room.roomCode);
        safeCallback(callback, { roomCode: room.roomCode, room });
      } catch (err: any) {
        safeCallback(callback, { error: err.message || 'Failed to create room' });
      }
    });

    // Join Room
    socket.on('join_room', async (data: { roomCode: string; user: { id: string; username: string; elo: number } }, callback) => {
      const result = await roomManager.joinRoom(data.roomCode, {
        ...data.user,
        socketId: socket.id,
        connected: true,
      });

      if (result.error) {
        safeCallback(callback, { error: result.error });
        return;
      }

      socket.join(data.roomCode.toUpperCase());
      const room = result.room!;

      // Notify room members
      io.to(room.roomCode).emit('room_updated', { room });
      safeCallback(callback, { room });
    });

    // Collaborative Editor Sync (Socket Broadcast)
    socket.on('code_change', (data: { roomCode: string; code: string; language: string; cursor?: any }) => {
      socket.to(data.roomCode.toUpperCase()).emit('opponent_code_update', {
        code: data.code,
        language: data.language,
        cursor: data.cursor,
        senderSocketId: socket.id,
      });
    });

    // Run Code against Sample Tests
    socket.on('run_code', async (data: { roomCode: string; code: string; language: 'javascript' | 'python' }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || !room.problem) {
        safeCallback(callback, { error: 'Problem not found' });
        return;
      }

      const sampleTests: TestCase[] = safeParseTests(room.problem.sampleTests);
      const executionResult = await runTestsLocally(data.code, data.language, sampleTests);

      safeCallback(callback, executionResult);
    });

    // Submit Code against Hidden Test Cases
    socket.on('submit_code', async (data: { roomCode: string; userId: string; code: string; language: 'javascript' | 'python' }, callback) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || !room.problem || room.status === 'FINISHED') {
        safeCallback(callback, { error: 'Match is inactive' });
        return;
      }

      const hiddenTests: TestCase[] = safeParseTests(room.problem.hiddenTests);
      const executionResult = await runTestsLocally(data.code, data.language, hiddenTests);

      // Save submission in DB with error handling
      try {
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
          });
        }
      } catch (err) {
        console.error('Failed to log submission record:', err);
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

      safeCallback(callback, executionResult);
    });

    // Forfeit Match
    socket.on('forfeit_match', async (data: { roomCode: string; userId: string }) => {
      await roomManager.handleForfeit(data.roomCode, data.userId, 'Player surrendered');
    });

    // Disconnect handling with opponent notification
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // Notify room members of opponent disconnect
      for (const [roomCode, room] of roomManager.getRooms().entries()) {
        if (room.player1?.socketId === socket.id && room.player2) {
          io.to(room.player2.socketId).emit('opponent_disconnected');
        } else if (room.player2?.socketId === socket.id && room.player1) {
          io.to(room.player1.socketId).emit('opponent_disconnected');
        }
      }

      roomManager.handleDisconnect(socket.id);
    });
  });
}
