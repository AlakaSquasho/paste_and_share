import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { broadcastSyncEvent } from '../ws';

const router = Router();
const prisma = new PrismaClient();

const CLIPBOARD_IMAGE_DIR = path.join(__dirname, '../../uploads/clipboard');
if (!fs.existsSync(CLIPBOARD_IMAGE_DIR)) {
  fs.mkdirSync(CLIPBOARD_IMAGE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CLIPBOARD_IMAGE_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const deleteImageFromDisk = (filename: string) => {
  const filePath = path.join(CLIPBOARD_IMAGE_DIR, filename);
  fs.unlink(filePath, (err) => {
    if (err) console.error('Failed to delete clipboard image from disk:', err);
  });
};

// PUT /api/clipboard/image - upload new image, replacing any existing one
router.put('/', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Delete existing clipboard image if any
    const existing = await prisma.clipboardImage.findFirst();
    if (existing) {
      deleteImageFromDisk(existing.filename);
      await prisma.clipboardImage.delete({ where: { id: existing.id } });
    }

    const newRecord = await prisma.clipboardImage.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });

    broadcastSyncEvent('clipboard_updated');
    return res.json({
      id: newRecord.id,
      mimetype: newRecord.mimetype,
      size: newRecord.size,
      originalName: newRecord.originalName,
    });
  } catch (error) {
    // Clean up uploaded file if DB write failed
    deleteImageFromDisk(req.file.filename);
    return res.status(500).json({ error: 'Failed to save clipboard image' });
  }
});

// GET /api/clipboard/image - retrieve current clipboard image blob
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const record = await prisma.clipboardImage.findFirst();
    if (!record) {
      return res.status(404).json({ error: 'No clipboard image' });
    }

    const filePath = path.join(CLIPBOARD_IMAGE_DIR, record.filename);
    res.setHeader('Content-Type', record.mimetype);
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve clipboard image' });
  }
});

// DELETE /api/clipboard/image - delete current clipboard image
router.delete('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const record = await prisma.clipboardImage.findFirst();
    if (!record) {
      return res.status(404).json({ error: 'No clipboard image' });
    }

    deleteImageFromDisk(record.filename);
    await prisma.clipboardImage.delete({ where: { id: record.id } });

    broadcastSyncEvent('clipboard_updated');
    return res.json({ message: 'Clipboard image deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete clipboard image' });
  }
});

export default router;
