import { WebSocketServer, WebSocket } from 'ws';
import type { WsMessage } from '../types/websocket';
import { getAllRunnerIds, getRunnerStatus } from '../lib/strategies/StrategyRunner';

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Set<Client>();

export function createWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    const client: Client = { ws, subscriptions: new Set() };
    clients.add(client);

    ws.on('message', (data) => {
      try {
        const msg: WsMessage = JSON.parse(data.toString());
        handleMessage(client, msg);
      } catch {
        // ignore invalid JSON
      }
    });

    ws.on('close', () => clients.delete(client));
    ws.on('error', () => clients.delete(client));

    ws.send(JSON.stringify({ type: 'pong' }));

    // Send current state of all running strategies to the newly connected client
    // so a reconnecting device sees accurate status immediately.
    for (const id of getAllRunnerIds()) {
      const runner = getRunnerStatus(id);
      if (!runner) continue;
      ws.send(JSON.stringify({
        type: 'strategy',
        strategyId: id,
        status: runner.status,
        signal: runner.lastSignal,
      }));
    }
  });

  console.log(`WebSocket server running on port ${port}`);
  return wss;
}

function handleMessage(client: Client, msg: WsMessage) {
  if (msg.type === 'subscribe') {
    client.subscriptions.add(`${msg.channel}:${msg.symbol}`);
  } else if (msg.type === 'unsubscribe') {
    client.subscriptions.delete(`ticker:${msg.symbol}`);
    client.subscriptions.delete(`orderbook:${msg.symbol}`);
  }
}

export function broadcast(msg: WsMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;

    let shouldSend = false;
    if (msg.type === 'ticker') shouldSend = client.subscriptions.has(`ticker:${msg.symbol}`);
    else if (msg.type === 'orderbook') shouldSend = client.subscriptions.has(`orderbook:${msg.symbol}`);
    else if (msg.type === 'strategy') shouldSend = true;
    else shouldSend = true;

    if (shouldSend) client.ws.send(data);
  }
}
