import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'freere_secret_key_12345';

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
    });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Quick Guest Login
router.post('/guest', async (req, res) => {
  try {
    const guestUsername = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    const guestEmail = `${guestUsername.toLowerCase()}@freere.guest`;
    const passwordHash = await bcrypt.hash('guestpass', 10);

    const user = await prisma.user.create({
      data: { username: guestUsername, email: guestEmail, passwordHash },
    });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Guest login failed' });
  }
});

// User Profile
router.get('/user/:username', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true,
        username: true,
        elo: true,
        wins: true,
        losses: true,
        draws: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ player1Id: user.id }, { player2Id: user.id }],
      },
      include: {
        player1: { select: { username: true, elo: true } },
        player2: { select: { username: true, elo: true } },
        problem: { select: { title: true, difficulty: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ user, matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
