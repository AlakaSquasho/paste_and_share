import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

type SyncEventType = 'clipboard_updated' | 'files_updated';

interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
}

const clients = new Set<WebSocket>();

const parseToken = (req: IncomingMessage) => {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  return url.searchParams.get('token');
};

const isAuthorized = (req: IncomingMessage) => {
  const token = parseToken(req);
  if (!token) return false;

  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
};

const sendEvent = (ws: WebSocket, event: SyncEvent) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
};

let websocketServer: WebSocketServer | null = null;

export const initWebSocketServer = (wss: WebSocketServer) => {
  websocketServer = wss;

  wss.on('connection', (ws, req) => {
    if (!isAuthorized(req)) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });
};

export const broadcastSyncEvent = (type: SyncEventType) => {
  if (!websocketServer) return;

  const event: SyncEvent = {
    type,
    timestamp: Date.now(),
  };

  clients.forEach((ws) => sendEvent(ws, event));
};
