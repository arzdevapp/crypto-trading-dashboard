import { NextResponse } from 'next/server';
import { getExchangeAdapter } from '@/lib/exchange/ExchangeFactory';
import { loadHistoricalData } from '@/lib/backtesting/HistoricalDataLoader';
import { runBacktest } from '@/lib/backtesting/BacktestEngine';
import { createStrategy } from '@/lib/strategies/StrategyRegistry';
import { getPredictor } from '@/lib/ml/InstancePredictor';
import { getNewsSentiment } from '@/lib/news/NewsSentimentScorer';

export async function POST(req: Request) {
  try {
    const { strategyType, exchangeId, symbol, timeframe, startDate, endDate, initialCapital, config } = await req.json();

    if (!strategyType || !exchangeId || !symbol || !timeframe || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required backtest parameters' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const adapter = await getExchangeAdapter(exchangeId);
    
    // Add caching or direct loading
    console.log(`[Backtest] Fetching historical data for ${symbol} on ${timeframe}...`);
    const candles = await loadHistoricalData(adapter, symbol, timeframe, start, end);
    console.log(`[Backtest] Loaded ${candles.length} candles.`);

    if (candles.length < 50) {
      return NextResponse.json({ error: `Not enough historical data returned (only ${candles.length} candles). Please select a longer date range.` }, { status: 400 });
    }

    const strategy = createStrategy(strategyType, {
      exchangeId,
      symbol,
      timeframe,
      ...config,
    });

    // No initialize() needed for backtest — the engine feeds candles sequentially
    // which naturally warms up the strategy.

    let predictor: any = null;
    if (strategyType === 'POWER_TRADER') {
      try {
        predictor = await getPredictor(symbol);
      } catch (e) {
        console.warn(`[Backtest] Could not load ML predictor for ${symbol}:`, e);
      }
    }

    const metrics = await runBacktest(strategy, {
      candles,
      initialCapital: initialCapital || 1000,
      commissionRate: 0.001, // 0.1% typical spot fee
      slippagePct: 0.05,     // 0.05% typical slippage
      onBeforeCandle: async (strat: any, candle: any) => {
        if (strategyType === 'POWER_TRADER' && typeof strat.setNeuralLevels === 'function') {
          let longLvl = 0;
          let shortLvl = 0;
          if (predictor && predictor.isTrainedFor(timeframe)) {
            const pred = predictor.predict(timeframe, candle, candle.close);
            longLvl = pred.longSignalCount;
            shortLvl = pred.shortSignalCount;
          }
          strat.setNeuralLevels(longLvl, shortLvl);

          // Simulated neutral backtest news sentiment
          if (typeof strat.setNewsSentiment === 'function') {
            strat.setNewsSentiment(0, 'Neutral');
          }
        }
      }
    });

    return NextResponse.json({
      metrics,
      candleCount: candles.length,
      start: candles[0].timestamp,
      end: candles[candles.length - 1].timestamp
    });
  } catch (error) {
    console.error('[Backtest API Error]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
