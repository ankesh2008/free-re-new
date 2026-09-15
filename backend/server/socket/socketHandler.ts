import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { roomManager } from './roomManager';
import { runTestsLocally, TestCase } from '../services/executionService';
import { prisma } from '../lib/db';
import { getJwtSecret } from '../middleware/authMiddleware';
import { checkSocketRateLimit } from '../middleware/rateLimiter';

interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      id: string;
      username: string;
      role: string;
    };
  };
}

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

  // Authenticate socket connections via JWT handshake
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token is required for socket connection'));
    }

    try {
      const jwtSecret = getJwtSecret();
      const decoded = jwt.verify(token, jwtSecret) as { id: string; username: string; role?: string };
      socket.data.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'USER',
      };
      next();
    } catch (err) {
      return next(new Error('Invalid or expired socket authentication token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;

    console.log(`Authenticated socket connected: ${socket.id} (User: ${user.username})`);

    // Join Matchmaking Queue (uses verified socket.data.user)
    socket.on('join_queue', async (playerData?: { elo?: number }) => {
      try {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        const elo = dbUser ? dbUser.elo : playerData?.elo || 1200;

        roomManager.addToMatchmaking({
          id: user.id,
          username: user.username,
          elo,
          socketId: socket.id,
          connected: true,
        });
      } catch (err) {
        console.error('Error in join_queue handler:', err);
      }
    });

    // Cancel Queue
    socket.on('leave_queue', () => {
      roomManager.removeFromMatchmaking(socket.id);
    });

    // Create Room (uses verified socket.data.user)
    socket.on('create_room', async (_playerData: any, callback) => {
      try {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        const elo = dbUser ? dbUser.elo : 1200;

        const room = await roomManager.createRoom({
          id: user.id,
          username: user.username,
          elo,
          socketId: socket.id,
          connected: true,
        });
        socket.join(room.roomCode);
        safeCallback(callback, { roomCode: room.roomCode, room });
      } catch (err: any) {
        safeCallback(callback, { error: err.message || 'Failed to create room' });
      }
    });

    // Join Room (uses verified socket.data.user)
    socket.on('join_room', async (data: { roomCode: string }, callback) => {
      if (!data || !data.roomCode) {
        safeCallback(callback, { error: 'Room code is required' });
        return;
      }

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      const elo = dbUser ? dbUser.elo : 1200;

      const result = await roomManager.joinRoom(data.roomCode, {
        id: user.id,
        username: user.username,
        elo,
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

    // Collaborative Editor Sync
    socket.on('code_change', (data: { roomCode: string; code: string; language: string; cursor?: any }) => {
      if (!data || !data.roomCode || typeof data.code !== 'string') return;
      socket.to(data.roomCode.toUpperCase()).emit('opponent_code_update', {
        code: data.code,
        language: data.language,
        cursor: data.cursor,
        senderSocketId: socket.id,
      });
    });

    // Run Code against Sample Tests (Rate-limited)
    socket.on('run_code', async (data: { roomCode: string; code: string; language: 'javascript' | 'python' }, callback) => {
      if (!checkSocketRateLimit(socket.id, 10, 10000)) {
        safeCallback(callback, { error: 'Rate limit exceeded. Please wait a few seconds before running code again.' });
        return;
      }

      const room = roomManager.getRoom(data.roomCode);
      if (!room || !room.problem) {
        safeCallback(callback, { error: 'Problem not found' });
        return;
      }

      const sampleTests: TestCase[] = safeParseTests(room.problem.sampleTests);
      const executionResult = await runTestsLocally(data.code, data.language, sampleTests);

      safeCallback(callback, executionResult);
    });

    // Submit Code against Hidden Test Cases (Rate-limited, strictly uses user.id)
    socket.on('submit_code', async (data: { roomCode: string; code: string; language: 'javascript' | 'python' }, callback) => {
      if (!checkSocketRateLimit(socket.id, 5, 10000)) {
        safeCallback(callback, { error: 'Rate limit exceeded. Please wait a few seconds before submitting code again.' });
        return;
      }

      const room = roomManager.getRoom(data.roomCode);
      if (!room || !room.problem || room.status === 'FINISHED') {
        safeCallback(callback, { error: 'Match is inactive' });
        return;
      }

      const hiddenTests: TestCase[] = safeParseTests(room.problem.hiddenTests);
      const executionResult = await runTestsLocally(data.code, data.language, hiddenTests);

      // Save submission in DB using verified user.id
      try {
        const matchRecord = await prisma.match.findUnique({ where: { roomCode: room.roomCode } });
        if (matchRecord) {
          await prisma.submission.create({
            data: {
              matchId: matchRecord.id,
              userId: user.id,
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
        userId: user.id,
        testsPassed: executionResult.testsPassed,
        totalTests: executionResult.totalTests,
        status: executionResult.status,
      });

      // If user passed ALL hidden test cases -> WINNER!
      if (executionResult.status === 'ACCEPTED') {
        await roomManager.finishMatch(room.roomCode, user.id, `Passed all ${executionResult.totalTests} test cases!`);
      }

      safeCallback(callback, executionResult);
    });

    // Forfeit Match (strictly uses verified user.id)
    socket.on('forfeit_match', async (data: { roomCode: string }) => {
      if (!data || !data.roomCode) return;
      await roomManager.handleForfeit(data.roomCode, user.id, 'Player surrendered');
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${user.username})`);

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
