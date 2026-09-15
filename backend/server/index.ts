import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { prisma } from './lib/db';

import authRoutes from './routes/auth';
import problemRoutes from './routes/problems';
import matchRoutes from './routes/matches';
import { setupSocketHandlers } from './socket/socketHandler';

const app = express();
const server = http.createServer(app);

// Environment setup & allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Payload size limits protection against DoS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/matches', matchRoutes);

// Health check endpoint with database ping
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message || String(err),
    });
  }
});

// Real-time WebSockets
setupSocketHandlers(io);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 free-re Backend Server running on http://localhost:${PORT}`);
});
