// server/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const SHARED_PASSWORD = process.env.SHARED_PASSWORD || '123456';

// Rate limiter for login: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per `window`
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  // Artificial delay to prevent timing attacks and slow down brute force
  await new Promise(resolve => setTimeout(resolve, 500));

  let isValid = false;

  // Try bcrypt first if the shared password looks like a hash
  if (SHARED_PASSWORD.startsWith('$2a$') || SHARED_PASSWORD.startsWith('$2b$')) {
    isValid = await bcrypt.compare(password, SHARED_PASSWORD);
  } else {
    isValid = password === SHARED_PASSWORD;
  }

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

  return res.json({ token });
});

export default router;
