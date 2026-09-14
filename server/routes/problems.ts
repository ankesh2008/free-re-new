import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

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
    res.status(500).json({ error: err.message });
  }
});

// Get problem details by ID or slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });

    if (!problem) return res.status(404).json({ error: 'Problem not found' });
    res.json(problem);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create Problem
router.post('/', async (req, res) => {
  try {
    const { title, difficulty, description, initialJS, initialPy, sampleTests, hiddenTests } = req.body;

    if (!title || !description || !initialJS || !initialPy) {
      return res.status(400).json({ error: 'Missing required problem fields' });
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
        sampleTests: typeof sampleTests === 'string' ? sampleTests : JSON.stringify(sampleTests || []),
        hiddenTests: typeof hiddenTests === 'string' ? hiddenTests : JSON.stringify(hiddenTests || []),
      },
    });

    res.json(problem);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
