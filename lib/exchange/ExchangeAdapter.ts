import ccxt, { type Exchange } from 'ccxt';
import type { OHLCVCandle, Ticker, OrderBook, BalanceSheet } from '@/types/exchange';
import type { Order, PlaceOrderParams } from '@/types/order';

export class ExchangeAdapter {
  private exchange: Exchange;

  constructor(exchangeId: string, apiKey: string, apiSecret: string, sandbox: boolean) {
    const ExchangeClass = (ccxt as unknown as Record<string, new (config: object) => Exchange>)[exchangeId];
    if (!ExchangeClass) throw new Error(`Exchange ${exchangeId} not supported`);
    this.exchange = new ExchangeClass({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
    });
    if (sandbox && this.exchange.urls?.test) {
      const currentUrls = (this.exchange as unknown as Record<string, unknown>)['urls'] as Record<string, unknown>;
      (this.exchange as unknown as Record<string, unknown>)['urls'] = {
        ...currentUrls,
        api: this.exchange.urls.test,
      };
    }
  }

  async fetchOHLCV(symbol: string, timeframe: string, limit = 200, since?: number): Promise<OHLCVCandle[]> {
    const raw = await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);
    return (raw as [number, number, number, number, number, number][]).map(
      ([timestamp, open, high, low, close, volume]) => ({ timestamp, open, high, low, close, volume })
    );
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const t = await this.exchange.fetchTicker(symbol);
    return {
      symbol: t.symbol,
      last: t.last ?? 0,
      bid: t.bid ?? 0,
      ask: t.ask ?? 0,
      high: t.high ?? 0,
      low: t.low ?? 0,
      volume: t.baseVolume ?? 0,
      change: t.change ?? 0,
      percentage: t.percentage ?? 0,
      timestamp: t.timestamp ?? Date.now(),
    };
  }

  async fetchOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const ob = await this.exchange.fetchOrderBook(symbol, limit);
    return {
      bids: ob.bids.map((entry) => ({ price: Number(entry[0]), amount: Number(entry[1]) })),
      asks: ob.asks.map((entry) => ({ price: Number(entry[0]), amount: Number(entry[1]) })),
      timestamp: ob.timestamp ?? Date.now(),
    };
  }

  async fetchBalance(): Promise<BalanceSheet> {
    const balance = await this.exchange.fetchBalance();
    const result: BalanceSheet = {};
    for (const [asset, data] of Object.entries(balance)) {
      if (asset === 'info' || asset === 'total' || asset === 'free' || asset === 'used') continue;
      if (typeof data === 'object' && data !== null && 'total' in data) {
        const d = data as { free: number; used: number; total: number };
        if (d.total > 0) result[asset] = { free: d.free, used: d.used, total: d.total };
      }
    }
    return result;
  }

  async fetchMarkets() {
    return this.exchange.fetchMarkets();
  }

  async placeOrder(params: PlaceOrderParams): Promise<Order> {
    const order = await this.exchange.createOrder(
      params.symbol,
      params.type,
      params.side,
      params.amount,
      params.price,
      params.stopPrice ? { stopPrice: params.stopPrice } : undefined
    );
    return {
      id: order.id,
      symbol: order.symbol,
      side: order.side as 'buy' | 'sell',
      type: order.type as 'market' | 'limit' | 'stop',
      amount: order.amount,
      price: order.price ?? undefined,
      status: order.status as 'open' | 'filled' | 'cancelled',
      filled: order.filled ?? 0,
      remaining: order.remaining ?? order.amount,
      fee: order.fee ? { cost: Number(order.fee.cost ?? 0), currency: String(order.fee.currency ?? '') } : undefined,
      timestamp: order.timestamp ?? Date.now(),
    };
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const orders = await this.exchange.fetchOpenOrders(symbol);
    return orders.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side as 'buy' | 'sell',
      type: o.type as 'market' | 'limit' | 'stop',
      amount: o.amount,
      price: o.price ?? undefined,
      status: o.status as 'open' | 'filled' | 'cancelled',
      filled: o.filled ?? 0,
      remaining: o.remaining ?? o.amount,
      timestamp: o.timestamp ?? Date.now(),
    }));
  }

  async cancelOrder(id: string, symbol: string): Promise<void> {
    await this.exchange.cancelOrder(id, symbol);
  }
}
