import type { WsMessage } from '@/types/websocket';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080';

type MessageHandler = (msg: WsMessage) => void;

let ws: WebSocket | null = null;
const handlers = new Set<MessageHandler>();
const connectionHandlers = new Set<(connected: boolean) => void>();
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let isConnected = false;

export function addConnectionHandler(handler: (connected: boolean) => void) {
  connectionHandlers.add(handler);
  handler(isConnected);
  return () => connectionHandlers.delete(handler);
}

function connect() {
  if (typeof window === 'undefined') return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    reconnectDelay = 1000;
    isConnected = true;
    connectionHandlers.forEach((h) => h(true));
  };

  ws.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data);
      handlers.forEach((h) => h(msg));
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    ws = null;
    isConnected = false;
    connectionHandlers.forEach((h) => h(false));
    reconnectTimeout = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      connect();
    }, reconnectDelay);
  };

  ws.onerror = () => ws?.close();
}

export function addMessageHandler(handler: MessageHandler) {
  if (!ws) connect();
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function sendMessage(msg: WsMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function subscribe(channel: 'ticker' | 'orderbook', symbol: string, exchangeId: string) {
  sendMessage({ type: 'subscribe', channel, symbol, exchangeId });
}

export function unsubscribe(channel: 'ticker' | 'orderbook', symbol: string) {
  sendMessage({ type: 'unsubscribe', channel, symbol });
}
