// server/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const SHARED_PASSWORD = process.env.SHARED_PASSWORD || '123456';

router.post('/login', async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  // In a real app, SHARED_PASSWORD should be hashed. For simplicity here, we assume plaintext compare if not hashed.
  // However, to demonstrate good practice, we'll verify directly.
  const isValid = password === SHARED_PASSWORD;

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

  return res.json({ token });
});

export default router;
