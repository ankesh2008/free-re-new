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

// Flexible CORS checking for Vercel preview/production deployments & local testing
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const isOriginAllowed = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) return callback(null, true); // Allow non-browser requests (Postman, curl, internal calls)

  if (configuredOrigins.includes('*')) return callback(null, true);

  const isAllowed = configuredOrigins.some((allowed) => {
    if (allowed === origin) return true;
    if (allowed.startsWith('*.') && origin.endsWith(allowed.slice(1))) return true;
    if (origin.endsWith('.vercel.app')) return true; // Auto-allow Vercel deployment domains
    return false;
  });

  if (isAllowed) {
    callback(null, true);
  } else {
    console.warn(`Blocked CORS request from origin: ${origin}`);
    callback(null, false);
  }
};

const io = new Server(server, {
  cors: {
    origin: isOriginAllowed,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

app.use(
  cors({
    origin: isOriginAllowed,
    credentials: true,
  })
);

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
  console.log(`🚀 free-re Backend Server running on port ${PORT}`);
});
