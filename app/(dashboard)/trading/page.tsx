'use client';
import { PriceChart } from '@/components/charts/PriceChart';
import { OrderForm } from '@/components/trading/OrderForm';
import { OpenOrdersList } from '@/components/trading/OpenOrdersList';
import { SymbolSelector } from '@/components/trading/SymbolSelector';
import { HorizontalSplit, VerticalSplit } from '@/components/ui/resizable';
import { useStore } from '@/store';
import { PageHelp } from '@/components/ui/page-help';
import { useQuery } from '@tanstack/react-query';

export default function TradingPage() {
  const { activeExchangeId, selectedSymbol, setSelectedSymbol, activeIndicators } = useStore();

  const { data: ticker } = useQuery<{ last: number; change24h: number; percentage: number }>({
    queryKey: ['ticker', activeExchangeId, selectedSymbol],
    queryFn: async () => {
      const r = await fetch(`/api/exchanges/${activeExchangeId}/ticker/${encodeURIComponent(selectedSymbol)}`);
      if (!r.ok) throw new Error('Ticker fetch failed');
      return r.json();
    },
    enabled: !!activeExchangeId,
    refetchInterval: 10000,
    staleTime: 9000,
    retry: 1,
  });

  if (!activeExchangeId) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#070B10' }}>
        <p className="text-sm font-mono" style={{ color: '#8B949E' }}>
          SELECT AN EXCHANGE IN THE HEADER TO START TRADING
        </p>
      </div>
    );
  }

  const sidebar = (
    <div className="flex flex-col gap-2 h-full overflow-y-auto p-2 pr-0 xl:pr-0">
      {/* Symbol selector */}
      <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>
        <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#243044', background: '#070B10' }}>
          <div className="flex flex-col">
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Trading</span>
            {ticker && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-mono font-bold" style={{ color: '#C7D1DB' }}>
                  ${ticker.last?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </span>
                <span className="text-[10px] font-mono" style={{ color: (ticker.percentage ?? 0) >= 0 ? '#00FF66' : '#ef4444' }}>
                  {(ticker.percentage ?? 0) >= 0 ? '+' : ''}{(ticker.percentage ?? 0).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <PageHelp
            title="Trading"
            description="Place manual buy and sell orders directly on your connected exchange."
            steps={[
              { label: 'Pick a symbol', detail: 'Search the list on the left (e.g. BTC/USDT).' },
              { label: 'Choose order type', detail: 'Market, Limit, or Stop.' },
              { label: 'Select Buy or Sell', detail: 'Green = buy. Red = sell.' },
              { label: 'Enter amount', detail: 'Amount is in the base asset.' },
              { label: 'Submit the order', detail: 'Click the Buy/Sell button.' },
              { label: 'Cancel an order', detail: 'Click X next to any open order.' },
            ]}
            tips={[
              'Market orders fill immediately but may have slippage.',
              'Your exchange API key needs Order permission.',
              'Sandbox/Testnet exchanges will NOT place real orders.',
            ]}
          />
        </div>
        <div className="p-2">
          <SymbolSelector exchangeId={activeExchangeId} value={selectedSymbol} onChange={setSelectedSymbol} />
        </div>
      </div>

      {/* Order form */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <OrderForm exchangeId={activeExchangeId} symbol={selectedSymbol} />
      </div>
    </div>
  );

  const mainArea = (
    <VerticalSplit
      className="h-full"
      defaultBottomHeight={140}
      minBottom={60}
      maxBottom={300}
      top={
        <div className="h-full p-2 pl-0 pb-0">
          <PriceChart exchangeId={activeExchangeId} symbol={selectedSymbol} indicators={activeIndicators} />
        </div>
      }
      bottom={
        <div className="h-full p-2 pl-0 pt-0 overflow-auto">
          <OpenOrdersList exchangeId={activeExchangeId} symbol={selectedSymbol} />
        </div>
      }
    />
  );

  return (
    <div className="h-full" style={{ background: '#070B10' }}>
      {/* Mobile: stacked, scrollable */}
      <div className="xl:hidden h-full overflow-y-auto flex flex-col gap-2 p-2">
        <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#243044', background: '#070B10' }}>
            <div className="flex flex-col">
              <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Trading</span>
              {ticker && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-mono font-bold" style={{ color: '#C7D1DB' }}>
                    ${ticker.last?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: (ticker.percentage ?? 0) >= 0 ? '#00FF66' : '#ef4444' }}>
                    {(ticker.percentage ?? 0) >= 0 ? '+' : ''}{(ticker.percentage ?? 0).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="p-2">
            <SymbolSelector exchangeId={activeExchangeId} value={selectedSymbol} onChange={setSelectedSymbol} />
          </div>
        </div>
        <div className="h-[350px] flex-shrink-0">
          <PriceChart exchangeId={activeExchangeId} symbol={selectedSymbol} indicators={activeIndicators} />
        </div>
        <OrderForm exchangeId={activeExchangeId} symbol={selectedSymbol} />
        <OpenOrdersList exchangeId={activeExchangeId} symbol={selectedSymbol} />
      </div>

      {/* Desktop: resizable panels */}
      <div className="hidden xl:block h-full">
        <HorizontalSplit
          className="h-full"
          defaultLeftWidth={240}
          minLeft={180}
          maxLeft={400}
          left={sidebar}
          right={mainArea}
        />
      </div>
    </div>
  );
}
