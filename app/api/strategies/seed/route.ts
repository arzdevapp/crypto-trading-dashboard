export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface PresetStrategy {
  name: string;
  type: string;
  symbol: string;
  timeframe: string;
  config: Record<string, unknown>;
  description: string;
  tier: 'best' | 'good' | 'moderate';
}

const PRESETS: PresetStrategy[] = [
  // ─── DAY TRADER PRESETS ───────────────────────────────────────────
  {
    name: 'Day Trader — BTC/USDT (Conservative)',
    type: 'DAY_TRADER',
    symbol: 'BTC/USDT',
    timeframe: '5m',
    config: { quantity: 0.001, stopLossPct: 1.0, takeProfitPct: 0.8, trailingGapPct: 0.3, entrySignalMin: 4, maxTradesPerDay: 5, newsBlockThresh: -0.4 },
    description: 'Neural day trader on BTC 5m. Hard 1% stop loss, 0.8% take profit with trailing. Max 5 trades/day.',
    tier: 'best',
  },
  {
    name: 'Day Trader — ETH/USDT (Aggressive)',
    type: 'DAY_TRADER',
    symbol: 'ETH/USDT',
    timeframe: '5m',
    config: { quantity: 0.01, stopLossPct: 1.5, takeProfitPct: 1.0, trailingGapPct: 0.4, entrySignalMin: 3, maxTradesPerDay: 8, newsBlockThresh: -0.3 },
    description: 'Aggressive ETH day trader. Wider SL/TP for volatile ETH moves, up to 8 trades/day.',
    tier: 'good',
  },
  {
    name: 'Day Trader — SOL/USDT (Scalp)',
    type: 'DAY_TRADER',
    symbol: 'SOL/USDT',
    timeframe: '1m',
    config: { quantity: 0.1, stopLossPct: 0.8, takeProfitPct: 0.5, trailingGapPct: 0.2, entrySignalMin: 3, maxTradesPerDay: 10, newsBlockThresh: -0.3 },
    description: 'Fast scalper on SOL 1m. Tight 0.8% SL, 0.5% TP, high frequency up to 10 trades/day.',
    tier: 'good',
  },
  // ─── TIER 1: BEST ────────────────────────────────────────────────
  {
    name: 'PowerTrader DCA — BTC/USDT',
    type: 'POWER_TRADER',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    config: { tradeStartLevel: 3, quantity: 0.001, pmStartPct: 5, pmStartPctDCA: 2.5, trailingGapPct: 0.5 },
    description: 'Neural kNN DCA bot on Bitcoin. Enters at long signal ≥3, DCA on deeper dips, exits on trailing profit margin.',
    tier: 'best',
  },
  {
    name: 'PowerTrader DCA — ETH/USDT',
    type: 'POWER_TRADER',
    symbol: 'ETH/USDT',
    timeframe: '1h',
    config: { tradeStartLevel: 3, quantity: 0.01, pmStartPct: 5, pmStartPctDCA: 2.5, trailingGapPct: 0.5 },
    description: 'Neural kNN DCA bot on Ethereum. Higher volatility than BTC means more DCA opportunities.',
    tier: 'best',
  },
  {
    name: 'Sentiment Contrarian — BTC/USDT',
    type: 'SENTIMENT',
    symbol: 'BTC/USDT',
    timeframe: '4h',
    config: { rsiPeriod: 14, fearBuyThreshold: 30, extremeFearThreshold: 20, greedSellThreshold: 70, extremeGreedThreshold: 85, quantity: 0.001 },
    description: 'Buys extreme fear, sells extreme greed using the Fear & Greed Index + RSI. "Be greedy when others are fearful."',
    tier: 'best',
  },
  // ─── TIER 2: GOOD ────────────────────────────────────────────────
  {
    name: 'RSI Reversal — BTC/USDT 4h',
    type: 'RSI',
    symbol: 'BTC/USDT',
    timeframe: '4h',
    config: { period: 14, oversold: 28, overbought: 72, quantity: 0.001 },
    description: 'Classic RSI reversal on BTC 4h. Tighter oversold/overbought thresholds (28/72) reduce false signals vs the standard 30/70.',
    tier: 'good',
  },
  {
    name: 'RSI Reversal — ETH/USDT 4h',
    type: 'RSI',
    symbol: 'ETH/USDT',
    timeframe: '4h',
    config: { period: 14, oversold: 30, overbought: 70, quantity: 0.01 },
    description: 'RSI reversal on ETH. ETH has more frequent oversold bounces than BTC making RSI more effective.',
    tier: 'good',
  },
  {
    name: 'EMA Crossover — BTC/USDT 4h',
    type: 'MA_CROSSOVER',
    symbol: 'BTC/USDT',
    timeframe: '4h',
    config: { fastPeriod: 9, slowPeriod: 21, useEMA: true, quantity: 0.001 },
    description: 'EMA 9/21 crossover on BTC 4h. Proven trend-following setup. EMA reacts faster than SMA to price changes.',
    tier: 'good',
  },
  {
    name: 'EMA Crossover — SOL/USDT 1h',
    type: 'MA_CROSSOVER',
    symbol: 'SOL/USDT',
    timeframe: '1h',
    config: { fastPeriod: 9, slowPeriod: 21, useEMA: true, quantity: 0.1 },
    description: 'EMA 9/21 on SOL 1h. SOL has strong trending behaviour making crossovers reliable.',
    tier: 'good',
  },
  {
    name: 'MACD Momentum — ETH/USDT 4h',
    type: 'MACD',
    symbol: 'ETH/USDT',
    timeframe: '4h',
    config: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, quantity: 0.01 },
    description: 'Standard MACD on ETH 4h. Histogram crossovers catch momentum shifts. High win rate in trending markets.',
    tier: 'good',
  },
  // ─── TIER 3: MODERATE ────────────────────────────────────────────
  {
    name: 'Bollinger Squeeze — SOL/USDT 1h',
    type: 'BOLLINGER',
    symbol: 'SOL/USDT',
    timeframe: '1h',
    config: { period: 20, stdDev: 2, quantity: 0.1 },
    description: 'Bollinger Band mean reversion on SOL. Buys lower band touches, sells upper band rejections.',
    tier: 'moderate',
  },
  {
    name: 'Bollinger Squeeze — BNB/USDT 4h',
    type: 'BOLLINGER',
    symbol: 'BNB/USDT',
    timeframe: '4h',
    config: { period: 20, stdDev: 2, quantity: 0.05 },
    description: 'Bollinger bands on BNB 4h. BNB tends to range between clear support/resistance making band bounces reliable.',
    tier: 'moderate',
  },
  {
    name: 'MACD Momentum — BTC/USDT 1d',
    type: 'MACD',
    symbol: 'BTC/USDT',
    timeframe: '1d',
    config: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, quantity: 0.001 },
    description: 'Daily MACD on BTC. Fewer but higher-conviction signals. Best for swing trading over weeks.',
    tier: 'moderate',
  },
  {
    name: 'Sentiment Contrarian — ETH/USDT',
    type: 'SENTIMENT',
    symbol: 'ETH/USDT',
    timeframe: '4h',
    config: { rsiPeriod: 14, fearBuyThreshold: 30, extremeFearThreshold: 20, greedSellThreshold: 70, extremeGreedThreshold: 85, quantity: 0.01 },
    description: 'Fear & Greed contrarian on ETH. ETH tends to move sharper during market fear/greed cycles than BTC.',
    tier: 'moderate',
  },
];

export async function POST(req: NextRequest) {
  const { exchangeId, tiers = ['best', 'good', 'moderate'] } = await req.json();

  if (!exchangeId) {
    return NextResponse.json({ error: 'exchangeId required' }, { status: 400 });
  }

  try {
    const selected = PRESETS.filter(p => tiers.includes(p.tier));
    const created: string[] = [];
    const skipped: string[] = [];

    for (const preset of selected) {
      // Skip if already exists for this exchange+symbol+type
      const existing = await prisma.strategy.findFirst({
        where: { exchangeId, symbol: preset.symbol, type: preset.type, timeframe: preset.timeframe },
      });

      if (existing) {
        skipped.push(preset.name);
        continue;
      }

      await prisma.strategy.create({
        data: {
          name: preset.name,
          type: preset.type,
          symbol: preset.symbol,
          timeframe: preset.timeframe,
          config: JSON.stringify({ ...preset.config, _description: preset.description, _tier: preset.tier }),
          exchangeId,
          status: 'stopped',
        },
      });
      created.push(preset.name);
    }

    return NextResponse.json({ created, skipped, total: created.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ presets: PRESETS.map(p => ({ name: p.name, type: p.type, symbol: p.symbol, timeframe: p.timeframe, tier: p.tier, description: p.description })) });
}
