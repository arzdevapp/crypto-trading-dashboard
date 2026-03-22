import type { BacktestTrade } from '@/types/backtest';
import type { Signal } from '@/types/strategy';

interface OpenPosition {
  side: 'buy' | 'sell';
  entryPrice: number;
  quantity: number;
  entryTime: number;
  commission: number;
}

export class BacktestBroker {
  private capital: number;
  private position: OpenPosition | null = null;
  private trades: BacktestTrade[] = [];
  private equityCurve: { timestamp: number; equity: number }[] = [];
  private commissionRate: number;
  private slippagePct: number;

  constructor(initialCapital: number, commissionRate = 0.001, slippagePct = 0.0005) {
    this.capital = initialCapital;
    this.commissionRate = commissionRate;
    this.slippagePct = slippagePct;
  }

  submitOrder(signal: Signal, nextOpen: number): void {
    if (signal.action === 'hold') return;

    const slippage = nextOpen * this.slippagePct;
    const fillPrice = signal.action === 'buy' ? nextOpen + slippage : nextOpen - slippage;
    const qty = signal.quantity ?? 0.001;
    const commission = fillPrice * qty * this.commissionRate;

    if (signal.action === 'buy' && !this.position) {
      const cost = fillPrice * qty + commission;
      if (cost > this.capital) return;
      this.capital -= cost;
      this.position = { side: 'buy', entryPrice: fillPrice, quantity: qty, entryTime: Date.now(), commission };
    } else if (signal.action === 'sell' && this.position) {
      this.closePosition(fillPrice, Date.now());
    }
  }

  settlePendingOrders(openPrice: number, timestamp: number): void {
    this.equityCurve.push({ timestamp, equity: this.getEquity(openPrice) });
  }

  closePosition(price: number, timestamp: number): void {
    if (!this.position) return;
    const { entryPrice, quantity, entryTime, commission: entryCommission } = this.position;
    const exitCommission = price * quantity * this.commissionRate;
    const proceeds = price * quantity - exitCommission;
    const pnl = proceeds - entryPrice * quantity - entryCommission;
    const pnlPct = (pnl / (entryPrice * quantity)) * 100;

    this.capital += proceeds + entryPrice * quantity;
    this.trades.push({
      entryTime,
      exitTime: timestamp,
      side: 'buy',
      entryPrice,
      exitPrice: price,
      quantity,
      pnl,
      pnlPct,
      commission: entryCommission + exitCommission,
    });
    this.position = null;
  }

  closeAllPositions(lastPrice: number): void {
    if (this.position) this.closePosition(lastPrice, Date.now());
  }

  getEquity(currentPrice: number): number {
    if (this.position) return this.capital + this.position.entryPrice * this.position.quantity;
    return this.capital;
  }

  getTrades(): BacktestTrade[] { return this.trades; }
  getEquityCurve(): { timestamp: number; equity: number }[] { return this.equityCurve; }
  getCapital(): number { return this.capital; }
}
