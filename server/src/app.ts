// server/src/app.ts
import express from 'express';
import cors from 'cors';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import clipboardRoutes from './routes/clipboard';
import filesRoutes from './routes/files';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
