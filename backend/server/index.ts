import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import authRoutes from './routes/auth';
import problemRoutes from './routes/problems';
import matchRoutes from './routes/matches';
import { setupSocketHandlers } from './socket/socketHandler';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/matches', matchRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Real-time WebSockets
setupSocketHandlers(io);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 free-re Backend Server running on http://localhost:${PORT}`);
});
