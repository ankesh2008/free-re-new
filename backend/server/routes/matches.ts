import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get ELO Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        elo: true,
        wins: true,
        losses: true,
        draws: true,
      },
      orderBy: { elo: 'desc' },
      take: 50,
    });
    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Match details
router.get('/:roomCode', async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { roomCode: req.params.roomCode.toUpperCase() },
      include: {
        player1: { select: { id: true, username: true, elo: true } },
        player2: { select: { id: true, username: true, elo: true } },
        problem: true,
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
