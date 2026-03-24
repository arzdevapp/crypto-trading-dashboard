import { WebSocketServer, WebSocket } from 'ws';
import type { WsMessage, LiveCandle } from '../types/websocket';
import { getAllRunnerIds, getRunnerStatus } from '../lib/strategies/StrategyRunner';
import { getExchangeAdapter } from '../lib/exchange/ExchangeFactory';

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Set<Client>();

// ── Live candle watchers ──────────────────────────────────────────────────────
// key = `${exchangeId}:${symbol}:${timeframe}`
const candleSubscribers = new Map<string, Set<Client>>();
const candleWatchers    = new Map<string, ReturnType<typeof setInterval>>();
const lastCandle        = new Map<string, LiveCandle>();

function startCandleWatcher(key: string) {
  if (candleWatchers.has(key)) return;
  const [exchangeId, ...rest] = key.split(':');
  const timeframe = rest.pop()!;
  const symbol    = rest.join(':'); // handles symbols like BTC/USDT:USDT

  const poll = async () => {
    const subs = candleSubscribers.get(key);
    if (!subs || subs.size === 0) { stopCandleWatcher(key); return; }
    try {
      const adapter = await getExchangeAdapter(exchangeId);
      const candles = await adapter.fetchOHLCV(symbol, timeframe, 2);
      if (candles.length === 0) return;

      const raw = candles[candles.length - 1];
      const fresh: LiveCandle = {
        time:  Math.floor(raw.timestamp / 1000),
        open:  raw.open,
        high:  raw.high,
        low:   raw.low,
        close: raw.close,
      };
      const prev = lastCandle.get(key);
      // Broadcast if close changed or a new candle started
      if (!prev || prev.time !== fresh.time || prev.close !== fresh.close ||
          prev.high !== fresh.high || prev.low !== fresh.low) {
        lastCandle.set(key, fresh);
        const msg: WsMessage = { type: 'candle', exchangeId, symbol, timeframe, candle: fresh };
        const payload = JSON.stringify(msg);
        for (const client of subs) {
          if (client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
        }
      }
    } catch (err) {
      console.error(`[candle-watcher] ${key}:`, (err as Error).message);
    }
  };

  poll(); // immediate first push
  // Kraken rate-limits public endpoints aggressively; use 15s for all exchanges
  candleWatchers.set(key, setInterval(poll, 15000));
}

function stopCandleWatcher(key: string) {
  const timer = candleWatchers.get(key);
  if (timer) { clearInterval(timer); candleWatchers.delete(key); }
  lastCandle.delete(key);
}

function removeClientFromCandles(client: Client) {
  for (const [key, subs] of candleSubscribers.entries()) {
    subs.delete(client);
    if (subs.size === 0) { candleSubscribers.delete(key); stopCandleWatcher(key); }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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

    ws.on('close', () => { clients.delete(client); removeClientFromCandles(client); });
    ws.on('error', () => { clients.delete(client); removeClientFromCandles(client); });

    ws.send(JSON.stringify({ type: 'pong' }));

    // Send current state of all running strategies on connect
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
    if (msg.channel === 'candle' && msg.timeframe) {
      const key = `${msg.exchangeId}:${msg.symbol}:${msg.timeframe}`;
      if (!candleSubscribers.has(key)) candleSubscribers.set(key, new Set());
      candleSubscribers.get(key)!.add(client);
      startCandleWatcher(key);
    } else {
      client.subscriptions.add(`${msg.channel}:${msg.symbol}`);
    }
  } else if (msg.type === 'unsubscribe') {
    if (msg.channel === 'candle' && msg.timeframe) {
      const key = `${msg.symbol}:${msg.timeframe}`; // partial key for unsubscribe
      // Find matching full keys
      for (const [fullKey, subs] of candleSubscribers.entries()) {
        if (fullKey.endsWith(`:${msg.symbol}:${msg.timeframe}`)) {
          subs.delete(client);
          if (subs.size === 0) { candleSubscribers.delete(fullKey); stopCandleWatcher(fullKey); }
        }
      }
    } else {
      client.subscriptions.delete(`ticker:${msg.symbol}`);
      client.subscriptions.delete(`orderbook:${msg.symbol}`);
    }
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
