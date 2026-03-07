// server/src/routes/files.ts (Update to fix import path)
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { broadcastSyncEvent } from '../ws';

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

const normalizeOriginalName = (originalName: string) => {
  if (/[\u3400-\u9FFF]/.test(originalName)) {
    return originalName;
  }

  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  if (/[\u3400-\u9FFF]/.test(decoded)) {
    return decoded;
  }

  return originalName;
};

const getDisplayFileName = (file: Express.Multer.File) => normalizeOriginalName(file.originalname);

const toAsciiFileName = (name: string) => name.replace(/[^\x20-\x7E]/g, '_');
const escapeQuotedString = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const buildContentDisposition = (filename: string) => {
  const asciiFallback = escapeQuotedString(toAsciiFileName(filename) || 'download');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
};

const streamFileAsAttachment = (res: Response, filePath: string, filename: string) => {
  res.setHeader('Content-Disposition', buildContentDisposition(filename));
  res.sendFile(filePath);
};

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
router.post('/upload', authenticate, (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Failed to parse uploaded file' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const newFile = await prisma.fileMetadata.create({
      data: {
        originalName: getDisplayFileName(req.file),
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
    broadcastSyncEvent('files_updated');
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
    streamFileAsAttachment(res, filePath, fileData.originalName);
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

    broadcastSyncEvent('files_updated');
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
