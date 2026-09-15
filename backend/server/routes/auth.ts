import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { sendError } from '../lib/response';
import { getJwtSecret } from '../middleware/authMiddleware';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'auth' });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// Register
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return sendError(res, 400, 'Username, email, and password are required');
    }

    if (!USERNAME_REGEX.test(username)) {
      return sendError(res, 400, 'Username must be 3-20 characters long and contain only letters, numbers, and underscores');
    }

    if (!EMAIL_REGEX.test(email)) {
      return sendError(res, 400, 'Please provide a valid email address');
    }

    if (password.length < 6 || password.length > 100) {
      return sendError(res, 400, 'Password must be between 6 and 100 characters');
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username }] },
    });

    if (existing) {
      return sendError(res, 400, 'Username or email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        passwordHash,
        role: 'USER',
      },
    });

    const jwtSecret = getJwtSecret();
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
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
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return sendError(res, 400, 'Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return sendError(res, 400, 'Invalid credentials');
    }

    const jwtSecret = getJwtSecret();
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
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

// Quick Guest Login
router.post('/guest', authRateLimiter, async (req, res) => {
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
          data: {
            username: guestUsername,
            email: guestEmail,
            passwordHash,
            role: 'USER',
          },
        });
        break;
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

    const jwtSecret = getJwtSecret();
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
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
        role: true,
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
