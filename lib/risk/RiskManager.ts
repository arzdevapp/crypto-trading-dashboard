import type { Signal } from '@/types/strategy';

export interface RiskProfile {
  maxPositionSizePct: number;
  maxDrawdownPct: number;
  defaultStopLossPct: number;
  defaultTakeProfitPct: number;
  maxOpenPositions: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  openPositionCount: number;
  drawdownPct: number;
  lastPrice: number;
}

export interface ValidationResult {
  approved: boolean;
  errors: string[];
  adjustedSignal?: Signal;
}

export class RiskManager {
  constructor(private profile: RiskProfile) {}

  validate(signal: Signal, portfolio: PortfolioSnapshot): ValidationResult {
    const errors: string[] = [];

    // Drawdown check applies to all trade actions
    if (portfolio.drawdownPct >= this.profile.maxDrawdownPct) {
      errors.push(`Max drawdown (${this.profile.maxDrawdownPct}%) breached — trading halted`);
    }

    if (signal.action === 'buy') {
      if (portfolio.openPositionCount >= this.profile.maxOpenPositions) {
        errors.push(`Max open positions (${this.profile.maxOpenPositions}) reached`);
      }
      const qty = signal.quantity ?? 0;
      const price = signal.price ?? portfolio.lastPrice;
      const positionValue = qty * price;
      const positionPct = (positionValue / portfolio.totalValue) * 100;
      if (positionPct > this.profile.maxPositionSizePct) {
        errors.push(`Position size ${positionPct.toFixed(1)}% exceeds max ${this.profile.maxPositionSizePct}%`);
      }
    }

    // Only compute adjusted signal for actual trade actions
    let adjustedSignal: Signal | undefined;
    if (signal.action === 'buy' || signal.action === 'sell') {
      adjustedSignal = {
        ...signal,
        stopLoss: signal.stopLoss ?? this.computeStopLoss(signal.price ?? portfolio.lastPrice, signal.action),
        takeProfit: signal.takeProfit ?? this.computeTakeProfit(signal.price ?? portfolio.lastPrice, signal.action),
      };
    }

    return { approved: errors.length === 0, errors, adjustedSignal };
  }

  computeStopLoss(entryPrice: number, side: 'buy' | 'sell'): number {
    const offset = entryPrice * (this.profile.defaultStopLossPct / 100);
    return side === 'buy' ? entryPrice - offset : entryPrice + offset;
  }

  computeTakeProfit(entryPrice: number, side: 'buy' | 'sell'): number {
    const offset = entryPrice * (this.profile.defaultTakeProfitPct / 100);
    return side === 'buy' ? entryPrice + offset : entryPrice - offset;
  }
}
