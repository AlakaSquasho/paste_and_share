// server/src/middleware/logger.ts
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const logDirectory = path.join(__dirname, '../../logs');
const logFile = path.join(logDirectory, 'access.log');

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

export const accessLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Get IP address
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Listen for the finish event to log the status code
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;
    const userAgent = req.headers['user-agent'] || '-';

    const logEntry = `[${timestamp}] ${ip} - ${method} ${url} ${status} (${duration}ms) - ${userAgent}\n`;

    try {
      fs.appendFileSync(logFile, logEntry);
    } catch (err) {
      console.error('Failed to write to access log:', err);
    }
  });

  next();
};
