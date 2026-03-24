import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { broadcastSyncEvent } from '../ws';

const router = Router();
const prisma = new PrismaClient();

interface ClipboardTextPayload {
  version: 2;
  type: 'text';
  text: string;
}

const EMPTY_TEXT_PAYLOAD: ClipboardTextPayload = {
  version: 2,
  type: 'text',
  text: '',
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isV2TextPayload = (value: unknown): value is ClipboardTextPayload => {
  if (!isObject(value)) return false;
  return value.version === 2 && value.type === 'text' && typeof value.text === 'string';
};

const parseStoredClipboardPayload = (content: string): ClipboardTextPayload | null => {
  try {
    const parsed = JSON.parse(content);
    if (isV2TextPayload(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
};

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const [latest, clipboardImage] = await Promise.all([
      prisma.clipboard.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.clipboardImage.findFirst(),
    ]);

    if (!latest) {
      return res.json({
        id: null,
        createdAt: null,
        payload: EMPTY_TEXT_PAYLOAD,
        hasImage: !!clipboardImage,
        imageInfo: clipboardImage
          ? { mimetype: clipboardImage.mimetype, size: clipboardImage.size, originalName: clipboardImage.originalName }
          : null,
      });
    }

    const payload = parseStoredClipboardPayload(latest.content) ?? EMPTY_TEXT_PAYLOAD;

    return res.json({
      id: latest.id,
      createdAt: latest.createdAt,
      payload,
      hasImage: !!clipboardImage,
      imageInfo: clipboardImage
        ? { mimetype: clipboardImage.mimetype, size: clipboardImage.size, originalName: clipboardImage.originalName }
        : null,
    });
  } catch (error) {
    console.error('Prisma Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  const payload = req.body as unknown;

  if (!isV2TextPayload(payload)) {
    return res.status(400).json({ error: 'Invalid clipboard payload' });
  }

  try {
    const newEntry = await prisma.clipboard.create({
      data: { content: JSON.stringify(payload) },
    });

    res.json({ id: newEntry.id, createdAt: newEntry.createdAt });
    broadcastSyncEvent('clipboard_updated');
  } catch {
    res.status(500).json({ error: 'Failed to update clipboard' });
  }
});

export default router;
