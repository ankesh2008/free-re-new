import { Router } from 'express';
import { prisma } from '../lib/db';
import { sendError } from '../lib/response';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const problemRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'problem' });

// List all problems
router.get('/', async (req, res) => {
  try {
    const problems = await prisma.problem.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        difficulty: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(problems);
  } catch (err: any) {
    sendError(res, 500, err.message);
  }
});

// Get problem details by ID or slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isUUID = idOrSlug.length === 36;

    const problem = await prisma.problem.findFirst({
      where: {
        OR: [
          isUUID ? { id: idOrSlug } : undefined,
          { slug: idOrSlug },
        ].filter(Boolean) as any,
      },
    });

    if (!problem) return sendError(res, 404, 'Problem not found');
    res.json(problem);
  } catch (err: any) {
    sendError(res, 500, err.message);
  }
});

// Helper validation for test arrays
function validateTestCases(tests: any): boolean {
  if (!Array.isArray(tests)) return false;
  if (tests.length > 50) return false; // Maximum 50 test cases limit
  return tests.every(
    (t) =>
      typeof t === 'object' &&
      t !== null &&
      typeof t.input === 'string' &&
      t.input.length <= 10000 &&
      typeof t.expected === 'string' &&
      t.expected.length <= 10000
  );
}

// Protected Route: Admin Create Problem
router.post('/', problemRateLimiter, authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, difficulty, description, initialJS, initialPy, sampleTests, hiddenTests } = req.body;

    if (!title || typeof title !== 'string' || title.length > 100) {
      return sendError(res, 400, 'Title is required and must be under 100 characters');
    }

    if (!description || typeof description !== 'string' || description.length > 20000) {
      return sendError(res, 400, 'Description is required and must be under 20,000 characters');
    }

    if (!initialJS || typeof initialJS !== 'string' || !initialPy || typeof initialPy !== 'string') {
      return sendError(res, 400, 'initialJS and initialPy starter templates are required');
    }

    let parsedSample: any[] = [];
    let parsedHidden: any[] = [];

    try {
      parsedSample = typeof sampleTests === 'string' ? JSON.parse(sampleTests || '[]') : sampleTests;
      parsedHidden = typeof hiddenTests === 'string' ? JSON.parse(hiddenTests || '[]') : hiddenTests;
    } catch {
      return sendError(res, 400, 'Invalid JSON format for test cases');
    }

    if (!validateTestCases(parsedSample) || !validateTestCases(parsedHidden)) {
      return sendError(res, 400, 'Test cases must be an array of objects with { input: string, expected: string }');
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const problem = await prisma.problem.create({
      data: {
        title,
        slug,
        difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
        description,
        initialJS,
        initialPy,
        sampleTests: JSON.stringify(parsedSample),
        hiddenTests: JSON.stringify(parsedHidden),
      },
    });

    res.json({ success: true, problem });
  } catch (err: any) {
    sendError(res, 500, err.message);
  }
});

export default router;
