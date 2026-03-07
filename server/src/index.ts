// server/src/index.ts
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from the root directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import { initWebSocketServer } from './ws';

const PORT = process.env.PORT || 3000;

const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
});

initWebSocketServer(wss);

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
