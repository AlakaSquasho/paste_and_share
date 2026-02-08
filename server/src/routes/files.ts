// server/src/routes/files.ts (Update to fix import path)
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// List all files
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const files = await prisma.fileMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Upload a file
router.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const newFile = await prisma.fileMetadata.create({
      data: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
    res.json(newFile);
  } catch (error) {
    // Clean up file on error
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Failed to save file metadata' });
  }
});

// Download a file
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const fileData = await prisma.fileMetadata.findUnique({
      where: { id },
    });

    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(UPLOADS_DIR, fileData.filename);
    res.download(filePath, fileData.originalName);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete a file
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const fileData = await prisma.fileMetadata.findUnique({
      where: { id },
    });

    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from DB
    await prisma.fileMetadata.delete({ where: { id } });

    // Delete from disk
    const filePath = path.join(UPLOADS_DIR, fileData.filename);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file from disk:', err);
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
