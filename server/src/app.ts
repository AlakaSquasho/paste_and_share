// server/src/app.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';

// Import middleware
import { accessLogger } from './middleware/logger';

// Import routes
import authRoutes from './routes/auth';
import clipboardRoutes from './routes/clipboard';
import filesRoutes from './routes/files';

const app = express();

// Global Rate Limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(accessLogger); // Apply logger to all requests (including static files)
app.use(cors());
app.use(express.json());
app.use('/api', globalLimiter); // Apply to all API routes

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clipboard', clipboardRoutes);
app.use('/api/files', filesRoutes);

// Static frontend serving (for production)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

export default app;
