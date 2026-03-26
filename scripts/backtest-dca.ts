import { ExchangeAdapter } from '../lib/exchange/ExchangeAdapter';
import { loadHistoricalData } from '../lib/backtesting/HistoricalDataLoader';
import { BacktestBroker } from '../lib/backtesting/BacktestBroker';
import { DayTraderStrategy } from '../lib/strategies/implementations/DayTraderStrategy';
import { InstancePredictor } from '../lib/ml/InstancePredictor';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function runBacktest() {
  console.log('--- Starting DCA Bot Backtest ---');

  const symbol = 'BTC/USDT';
  const timeframe = '1h';
  const endDate = new Date(); // now
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  // Fixed arguments for ExchangeAdapter
  const adapter = new ExchangeAdapter('binance', process.env.BINANCE_API_KEY || '', process.env.BINANCE_API_SECRET || '', true);

  console.log(`Loading historical data for ${symbol} from ${startDate.toISOString()} to ${endDate.toISOString()}...`);
  const candles = await loadHistoricalData(adapter, symbol, timeframe, startDate, endDate);
  console.log(`Loaded ${candles.length} candles.`);

  if (candles.length === 0) {
    console.log('No data loaded. Exiting.');
    return;
  }

  // Create strategy config with enhancements enabled
  const strategyConfig = {
    symbol,
    timeframe,
    accountEquity: 1000, // Initial capital in base curr
    riskPct: 1.0,        // Risk 1% per trade using ATR sizing
    atrWindow: 14,
    shortMaPeriod: 5,
    longMaPeriod: 20,
    feePct: 0.1,         // 0.1% maker/taker fee
    slippagePct: 0.05,   // 0.05% slippage
    stopLossPct: 1.5,
    takeProfitPct: 2.0,
    entrySignalMin: 3,
    maxTradesPerDay: 5,
    newsBlockThresh: -0.4,
  };

  const strategy = new DayTraderStrategy(strategyConfig);
  await strategy.initialize(async () => candles.slice(0, 50)); // Mock adapter hook

  const predictor = new InstancePredictor(symbol);
  await predictor.loadFromDB();
  
  // BacktestBroker does not have updatePrice/executeMarketBuy/getResults
  // We adapt to BacktestBroker's real methods: submitOrder, settlePendingOrders
  const broker = new BacktestBroker(1000, strategyConfig.feePct / 100, strategyConfig.slippagePct / 100);

  console.log('Running simulation...');
  const warmup = 10;
  
  let signalCount = 0;

  for (let i = warmup; i < candles.length - 1; i++) {
    const currentCandles = candles.slice(0, i + 1);
    const latest = currentCandles[currentCandles.length - 1];
    
    // Inject mock predictions just for testing
    strategy.setNeuralLevels(3, 0); 
    strategy.setNewsSentiment(0.5, 'Positive');

    const nextCandleOpen = candles[i + 1].open;

    // We call computeSignal directly to avoid StrategyRunner which relies on DB
    const signal = strategy.computeSignal(currentCandles);

    if (signal && signal.action !== 'hold') {
      signalCount++;
      // Actually submit order to broker
      broker.submitOrder(signal, nextCandleOpen);
    }
    
    broker.settlePendingOrders(nextCandleOpen, latest.timestamp);
  }

  broker.closeAllPositions(candles[candles.length - 1].close);

  const trades = broker.getTrades();
  const finalCapital = broker.getCapital();
  const netProfit = finalCapital - 1000;
  const returnPct = (netProfit / 1000) * 100;
  
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const losingTrades = trades.filter(t => t.pnl <= 0).length;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  console.log('\n--- Backtest Results ---');
  console.log(`Total Signals Triggered: ${signalCount}`);
  console.log(`Total Trades Executed: ${trades.length}`);
  console.log(`Winning Trades: ${winningTrades}`);
  console.log(`Losing Trades: ${losingTrades}`);
  console.log(`Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`Initial Capital: $1000.00`);
  console.log(`Final Capital: $${finalCapital.toFixed(2)}`);
  console.log(`Net Profit: $${netProfit.toFixed(2)} (${returnPct.toFixed(2)}%)`);
  
  console.log('\nDone.');
  process.exit(0);
}

runBacktest().catch(console.error);
