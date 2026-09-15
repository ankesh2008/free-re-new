import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { sendError } from '../lib/response';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'freere_secret_key_12345';

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return sendError(res, 400, 'Username, email, and password are required');
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      return sendError(res, 400, 'Username or email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
    });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
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
    sendError(res, 500, err.message || 'Registration failed');
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return sendError(res, 400, 'Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return sendError(res, 400, 'Invalid credentials');
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
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
    sendError(res, 500, err.message || 'Login failed');
  }
});

// Quick Guest Login with UUID collision retry loop
router.post('/guest', async (req, res) => {
  try {
    let retries = 5;
    let user = null;

    while (retries > 0) {
      const guestId = crypto.randomUUID();
      const guestUsername = `Guest_${guestId.substring(0, 8)}`;
      const guestEmail = `guest_${guestId}@freere.guest`;
      const passwordHash = await bcrypt.hash(guestId, 10);

      try {
        user = await prisma.user.create({
          data: { username: guestUsername, email: guestEmail, passwordHash },
        });
        break; // Successfully created
      } catch (err: any) {
        if (err.code === 'P2002') {
          retries--;
          continue;
        }
        throw err;
      }
    }

    if (!user) {
      return sendError(res, 500, 'Failed to generate unique guest account');
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      success: true,
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
    sendError(res, 500, err.message || 'Guest login failed');
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

    if (!user) return sendError(res, 404, 'User not found');

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
    sendError(res, 500, err.message);
  }
});

export default router;
