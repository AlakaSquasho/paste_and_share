import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { broadcastSyncEvent } from '../ws';

const router = Router();
const prisma = new PrismaClient();

interface ClipboardImageRef {
  fileId: string;
  mimetype: string;
  size: number;
  originalName: string;
}

interface ClipboardTextPayload {
  version: 2;
  type: 'text';
  text: string;
}

interface ClipboardImagePayload {
  version: 2;
  type: 'image';
  image: ClipboardImageRef;
}

type ClipboardPayload = ClipboardTextPayload | ClipboardImagePayload;

const EMPTY_TEXT_PAYLOAD: ClipboardTextPayload = {
  version: 2,
  type: 'text',
  text: '',
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isClipboardImageRef = (value: unknown): value is ClipboardImageRef => {
  if (!isObject(value)) return false;

  return (
    typeof value.fileId === 'string' &&
    typeof value.mimetype === 'string' &&
    typeof value.size === 'number' &&
    typeof value.originalName === 'string'
  );
};

const isV2TextPayload = (value: unknown): value is ClipboardTextPayload => {
  if (!isObject(value)) return false;
  return value.version === 2 && value.type === 'text' && typeof value.text === 'string';
};

const isV2ImagePayload = (value: unknown): value is ClipboardImagePayload => {
  if (!isObject(value)) return false;
  return value.version === 2 && value.type === 'image' && isClipboardImageRef(value.image);
};

const parseStoredClipboardPayload = (content: string): ClipboardPayload | null => {
  try {
    const parsed = JSON.parse(content);
    if (isV2TextPayload(parsed) || isV2ImagePayload(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const latest = await prisma.clipboard.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return res.json({
        id: null,
        createdAt: null,
        payload: EMPTY_TEXT_PAYLOAD,
      });
    }

    const payload = parseStoredClipboardPayload(latest.content) ?? EMPTY_TEXT_PAYLOAD;

    return res.json({
      id: latest.id,
      createdAt: latest.createdAt,
      payload,
    });
  } catch (error) {
    console.error('Prisma Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  const payload = req.body as unknown;

  if (!isV2TextPayload(payload) && !isV2ImagePayload(payload)) {
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
