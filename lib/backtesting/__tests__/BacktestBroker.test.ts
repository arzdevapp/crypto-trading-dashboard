import { describe, it, expect, beforeEach } from 'vitest';
import { BacktestBroker } from '../BacktestBroker';
import type { Signal } from '@/types/strategy';

const BUY: Signal = { action: 'buy', quantity: 1, reason: 'test' };
const SELL: Signal = { action: 'sell', quantity: 1, reason: 'test' };

describe('BacktestBroker', () => {
  let broker: BacktestBroker;

  beforeEach(() => {
    // No commission, no slippage for clean arithmetic
    broker = new BacktestBroker(10000, 0, 0);
  });

  it('starts with the specified capital', () => {
    expect(broker.getCapital()).toBe(10000);
  });

  it('opens a long position on buy signal', () => {
    broker.submitOrder(BUY, 100); // buy 1 unit at $100
    expect(broker.getCapital()).toBe(9900); // 10000 - 100
    expect(broker.getTrades()).toHaveLength(0); // still open
  });

  it('closes position on sell and records a trade', () => {
    broker.submitOrder(BUY, 100);  // buy at $100
    broker.submitOrder(SELL, 120); // sell at $120
    const trades = broker.getTrades();
    expect(trades).toHaveLength(1);
    expect(trades[0].pnl).toBeCloseTo(20);   // 120 - 100 = +$20
    expect(trades[0].entryPrice).toBe(100);
    expect(trades[0].exitPrice).toBe(120);
  });

  it('records a losing trade', () => {
    broker.submitOrder(BUY, 100);
    broker.submitOrder(SELL, 80);
    const trades = broker.getTrades();
    expect(trades[0].pnl).toBeCloseTo(-20);
  });

  it('does not open a second position when one is already open', () => {
    broker.submitOrder(BUY, 100);
    broker.submitOrder(BUY, 110); // second buy should be ignored
    broker.submitOrder(SELL, 120);
    // Only one trade (one round trip)
    expect(broker.getTrades()).toHaveLength(1);
  });

  it('does not sell when there is no open position', () => {
    broker.submitOrder(SELL, 100); // nothing to close
    expect(broker.getTrades()).toHaveLength(0);
  });

  it('applies commission correctly', () => {
    const brokerWithFee = new BacktestBroker(10000, 0.001, 0); // 0.1% commission
    brokerWithFee.submitOrder(BUY, 100);  // buy 1 @ $100, commission = $0.10
    brokerWithFee.submitOrder(SELL, 120); // sell 1 @ $120, commission = $0.12
    const trade = brokerWithFee.getTrades()[0];
    expect(trade.commission).toBeCloseTo(0.10 + 0.12, 5);
    expect(trade.pnl).toBeCloseTo(20 - 0.10 - 0.12, 5);
  });

  it('applies slippage to fill price', () => {
    const brokerSlip = new BacktestBroker(10000, 0, 0.01); // 1% slippage
    brokerSlip.submitOrder(BUY, 100);  // fill at 100 * 1.01 = 101
    brokerSlip.submitOrder(SELL, 120); // fill at 120 * 0.99 = 118.8
    const trade = brokerSlip.getTrades()[0];
    expect(trade.entryPrice).toBeCloseTo(101);
    expect(trade.exitPrice).toBeCloseTo(118.8);
  });

  it('does not open position if insufficient capital', () => {
    const poorBroker = new BacktestBroker(50, 0, 0);
    poorBroker.submitOrder(BUY, 100); // costs $100, only $50 available
    expect(poorBroker.getTrades()).toHaveLength(0);
    expect(poorBroker.getCapital()).toBe(50); // unchanged
  });

  it('records equity on settlePendingOrders', () => {
    broker.settlePendingOrders(100, 1000);
    broker.settlePendingOrders(110, 2000);
    expect(broker.getEquityCurve()).toHaveLength(2);
  });

  it('closeAllPositions closes any open position', () => {
    broker.submitOrder(BUY, 100);
    broker.closeAllPositions(150);
    expect(broker.getTrades()).toHaveLength(1);
    expect(broker.getTrades()[0].exitPrice).toBe(150);
  });

  it('pnlPct is calculated relative to entry cost', () => {
    broker.submitOrder(BUY, 100); // entry $100
    broker.submitOrder(SELL, 110); // exit $110
    const trade = broker.getTrades()[0];
    expect(trade.pnlPct).toBeCloseTo(10); // 10%
  });
});
