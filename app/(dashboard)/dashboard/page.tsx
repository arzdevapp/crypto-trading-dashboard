'use client';
import { useState, useCallback } from 'react';
import { PriceChart } from '@/components/charts/PriceChart';
import { NeuralLevelsOverlay } from '@/components/charts/NeuralLevelsOverlay';
import { TickerBar } from '@/components/dashboard/TickerBar';
import { AccountMetrics } from '@/components/dashboard/AccountMetrics';
import { NeuralSignalMatrix } from '@/components/dashboard/NeuralSignalTile';
import { LiveFeed } from '@/components/dashboard/LiveFeed';
import { SentimentPanel } from '@/components/dashboard/SentimentPanel';
import { StrategyStatusPanel } from '@/components/dashboard/StrategyStatusPanel';
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart';
import { BalanceTable } from '@/components/portfolio/BalanceTable';
import { useStore } from '@/store';
import { PageHelp } from '@/components/ui/page-help';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';

export default function DashboardPage() {
  const { activeExchangeId, selectedSymbol } = useStore();
  const [longLevels, setLongLevels] = useState<number[]>([]);
  const [shortLevels, setShortLevels] = useState<number[]>([]);

  const handleLevelsUpdate = useCallback((long: number[], short: number[]) => {
    setLongLevels(long);
    setShortLevels(short);
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: '#070B10' }}>
      {/* Live ticker bar */}
      <div className="flex items-center">
        <div className="flex-1 min-w-0"><TickerBar /></div>
        <div className="px-2 flex-shrink-0">
          <PageHelp
            title="Dashboard"
            description="Your real-time trading command centre. Monitor live prices, account metrics, neural signal predictions, active strategies, and recent trades all in one view."
            steps={[
              { label: 'Select an exchange', detail: 'Use the dropdown in the top header to pick the exchange you added in Settings.' },
              { label: 'Read the ticker bar', detail: 'Live prices for the top 8 pairs update every 30 seconds. Green = up, red = down since 24h open.' },
              { label: 'Check Account metrics', detail: 'Buying power, total P&L, win rate and profit factor are computed from your filled trades.' },
              { label: 'Read Neural Signals', detail: 'Each tile shows L (long) and S (short) bar strength from 0–7. Higher bars = stronger directional signal from the kNN model.' },
              { label: 'Monitor strategies', detail: 'The Strategies panel shows running bots. Use the play/stop buttons to start or pause them.' },
              { label: 'Review the live feed', detail: 'The feed at the bottom of the left column shows your most recent trades with P&L.' },
            ]}
            tips={[
              'The chart shows neural buy/short level lines — blue = long zones, orange = short zones.',
              'Equity curve and balances are in the bottom-right grid.',
              'All panels auto-refresh — no need to reload the page.',
            ]}
          />
        </div>
      </div>

      {/* Main content — fills remaining height */}
      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        <div className="h-full grid grid-cols-1 xl:grid-cols-4 gap-2 items-start" style={{ gridTemplateRows: '100%' }}>

          {/* Left column — scrollable */}
          <div className="flex flex-col gap-2 overflow-y-auto min-h-0 pr-0.5">
            <AccountMetrics />
            <NeuralSignalMatrix />
            <StrategyStatusPanel />
<LiveFeed />
            <SentimentPanel />
          </div>

          {/* Center — 3 cols, flex column */}
          <div className="xl:col-span-3 flex flex-col gap-2 min-h-0">
            {/* Symbol picker bar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <SymbolSearch />
            </div>
            {/* Chart fills available space, min height so it never collapses */}
            <div className="flex-1 min-h-[280px]">
              {activeExchangeId ? (
                <PriceChart
                  exchangeId={activeExchangeId}
                  symbol={selectedSymbol}
                  longLevels={longLevels}
                  shortLevels={shortLevels}
                  overlay={
                    <NeuralLevelsOverlay
                      exchangeId={activeExchangeId}
                      symbol={selectedSymbol}
                      onLevelsUpdate={handleLevelsUpdate}
                    />
                  }
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center rounded-lg border h-full"
                  style={{ borderColor: '#243044', background: '#0E1626' }}
                >
                  <p className="text-sm font-mono" style={{ color: '#8B949E' }}>
                    SELECT AN EXCHANGE TO VIEW LIVE CHART
                  </p>
                  <p className="text-xs font-mono mt-1" style={{ color: '#243044' }}>
                    Use the exchange selector in the header
                  </p>
                </div>
              )}
            </div>

            {/* Bottom row — fixed height so it's always visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-shrink-0 h-[160px]">
              <EquityCurveChart />
              <BalanceTable />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
