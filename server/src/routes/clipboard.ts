// server/src/routes/clipboard.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get latest clipboard content
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const latest = await prisma.clipboard.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    // 如果没有记录，返回空内容对象，而不是 null
    res.json(latest || { content: '' });
  } catch (error) {
    console.error('Prisma Error:', error); // 在后端终端打印具体错误
    res.status(500).json({ error: 'Database error', details: error });
  }
});

// Update clipboard content
router.post('/', authenticate, async (req: Request, res: Response) => {
  const { content } = req.body;

  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Content must be a string' });
  }

  try {
    const newEntry = await prisma.clipboard.create({
      data: { content },
    });
    res.json(newEntry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update clipboard' });
  }
});

export default router;
