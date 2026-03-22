export const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance', hasSandbox: true },
  { id: 'coinbasepro', name: 'Coinbase Pro', hasSandbox: true },
  { id: 'kraken', name: 'Kraken', hasSandbox: false },
  { id: 'bybit', name: 'Bybit', hasSandbox: true },
  { id: 'okx', name: 'OKX', hasSandbox: true },
];

export const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'];

export const STRATEGY_TYPES = [
  { id: 'MA_CROSSOVER', name: 'MA Crossover' },
  { id: 'RSI', name: 'RSI Strategy' },
  { id: 'MACD', name: 'MACD Strategy' },
  { id: 'GRID', name: 'Grid Trading' },
  { id: 'BOLLINGER', name: 'Bollinger Bands' },
  { id: 'POWER_TRADER', name: 'PowerTrader DCA (Neural)' },
  { id: 'SENTIMENT', name: 'Sentiment + RSI' },
];

export const DEFAULT_RISK_PROFILE = {
  maxPositionSizePct: 5.0,
  maxDrawdownPct: 20.0,
  defaultStopLossPct: 2.0,
  defaultTakeProfitPct: 4.0,
  maxOpenPositions: 5,
};

export const WS_PORT = process.env.WS_PORT ?? '8080';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080';
