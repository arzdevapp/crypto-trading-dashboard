'use client';
import { useState } from 'react';
import { BacktestForm } from '@/components/backtesting/BacktestForm';
import { BacktestResults } from '@/components/backtesting/BacktestResults';
import type { BacktestMetrics } from '@/types/backtest';
import { FlaskConical } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';

export default function BacktestingPage() {
  const [results, setResults] = useState<BacktestMetrics | null>(null);

  return (
    <div className="h-full flex flex-col xl:flex-row gap-2 p-2 overflow-y-auto xl:overflow-hidden" style={{ background: '#070B10' }}>

      {/* Left: form — fixed width on desktop, full on mobile */}
      <div className="xl:w-64 flex-shrink-0 flex flex-col gap-2 xl:overflow-y-auto">
        <div className="flex items-center gap-2 flex-shrink-0 px-1">
          <FlaskConical className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
          <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Backtesting</span>
          <PageHelp
            title="Backtesting"
            description="Simulate a strategy against historical OHLCV data to evaluate its performance before risking real money. Results include P&L, win rate, drawdown, Sharpe ratio and more."
            steps={[
              { label: 'Select a strategy', detail: 'Choose from strategies you have already created in the Strategies page.' },
              { label: 'Set the symbol & timeframe', detail: 'Enter the trading pair (e.g. BTC/USDT) and choose a candle interval. Longer timeframes (1d) run faster.' },
              { label: 'Set the date range', detail: 'Pick start and end dates. The engine fetches OHLCV data for that period from your exchange.' },
              { label: 'Set initial capital', detail: 'Enter the amount in USD/USDT to simulate starting with. This affects absolute P&L figures.' },
              { label: 'Run the backtest', detail: 'Click Run Backtest. Results appear on the right with 12 performance metrics.' },
              { label: 'Read the results', detail: 'Focus on Win Rate (>50% is good), Profit Factor (>1.5 is strong), and Max Drawdown (lower = safer).' },
            ]}
            tips={[
              'Backtests use the same strategy logic as live trading — what you see is what you get.',
              'Run multiple date ranges to check consistency across different market conditions.',
              'High Sharpe Ratio (>1) means good risk-adjusted returns.',
            ]}
          />
        </div>
        <BacktestForm onResult={setResults} />
      </div>

      {/* Right: results — fills remaining space */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {results ? (
          <BacktestResults metrics={results} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center rounded-lg border border-dashed" style={{ borderColor: '#243044' }}>
            <FlaskConical className="w-8 h-8 mb-2" style={{ color: '#243044' }} />
            <p className="text-sm font-mono" style={{ color: '#8B949E' }}>Run a backtest to see results</p>
          </div>
        )}
      </div>

    </div>
  );
}
