type SyncEventType = 'clipboard_updated' | 'files_updated';

interface SyncEvent {
  type: SyncEventType;
  timestamp: number;
}

type SyncEventHandler = (event: SyncEvent) => void;

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
const listeners = new Set<SyncEventHandler>();

const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const token = encodeURIComponent(localStorage.getItem('token') || '');
  return `${protocol}://${window.location.host}/ws?token=${token}`;
};

const notify = (event: SyncEvent) => {
  listeners.forEach((listener) => listener(event));
};

const scheduleReconnect = () => {
  if (reconnectTimer !== null) return;

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, 1000);
};

const handleMessage = (message: MessageEvent) => {
  try {
    const event = JSON.parse(message.data) as SyncEvent;
    if (!event?.type) return;
    notify(event);
  } catch {
    // ignore invalid message
  }
};

export const connectWebSocket = () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) return;

  socket = new WebSocket(getWebSocketUrl());

  socket.onmessage = handleMessage;
  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };
  socket.onerror = () => {
    socket?.close();
  };
};

export const disconnectWebSocket = () => {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
};

export const subscribeSyncEvent = (listener: SyncEventHandler) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
