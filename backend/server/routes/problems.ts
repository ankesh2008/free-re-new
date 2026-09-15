import { Router } from 'express';
import { prisma } from '../lib/db';
import { sendError } from '../lib/response';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

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
  return tests.every(
    (t) => typeof t === 'object' && t !== null && typeof t.input === 'string' && typeof t.expected === 'string'
  );
}

// Protected Route: Admin Create Problem
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, difficulty, description, initialJS, initialPy, sampleTests, hiddenTests } = req.body;

    if (!title || !description || !initialJS || !initialPy) {
      return sendError(res, 400, 'Title, description, initialJS, and initialPy are required');
    }

    const parsedSample = typeof sampleTests === 'string' ? JSON.parse(sampleTests || '[]') : sampleTests;
    const parsedHidden = typeof hiddenTests === 'string' ? JSON.parse(hiddenTests || '[]') : hiddenTests;

    if (!validateTestCases(parsedSample) || !validateTestCases(parsedHidden)) {
      return sendError(res, 400, 'Test cases must be an array of objects with { input: string, expected: string }');
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const problem = await prisma.problem.create({
      data: {
        title,
        slug,
        difficulty: difficulty || 'Medium',
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
