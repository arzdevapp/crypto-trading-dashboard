'use client';
import { PriceChart } from '@/components/charts/PriceChart';
import { OrderForm } from '@/components/trading/OrderForm';
import { OpenOrdersList } from '@/components/trading/OpenOrdersList';
import { SymbolSelector } from '@/components/trading/SymbolSelector';
import { useStore } from '@/store';
import { PageHelp } from '@/components/ui/page-help';

export default function TradingPage() {
  const { activeExchangeId, selectedSymbol, setSelectedSymbol } = useStore();

  if (!activeExchangeId) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#070B10' }}>
        <p className="text-sm font-mono" style={{ color: '#8B949E' }}>
          SELECT AN EXCHANGE IN THE HEADER TO START TRADING
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-2 p-2" style={{ background: '#070B10' }}>

      {/* Left panel — symbol + order form */}
      <div className="flex flex-col gap-2 w-56 flex-shrink-0">

        {/* Symbol selector */}
        <div className="rounded-lg border overflow-hidden flex-shrink-0" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#243044', background: '#070B10' }}>
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Trading</span>
            <PageHelp
              title="Trading"
              description="Place manual buy and sell orders directly on your connected exchange. Supports market, limit and stop orders."
              steps={[
                { label: 'Pick a symbol', detail: 'Search the list on the left (e.g. BTC/USDT). Click any pair to load its chart.' },
                { label: 'Choose order type', detail: 'Market executes instantly at current price. Limit lets you set a target price. Stop triggers at a stop price then fills at the limit price.' },
                { label: 'Select Buy or Sell', detail: 'Green = buy (long). Red = sell (short/close position).' },
                { label: 'Enter amount', detail: 'Amount is in the base asset (e.g. BTC for BTC/USDT). Check your balance in the Dashboard first.' },
                { label: 'Submit the order', detail: 'Click the Buy/Sell button. The order appears in Open Orders below the chart.' },
                { label: 'Cancel an order', detail: 'Click the X button next to any open order to cancel it on the exchange.' },
              ]}
              tips={[
                'Market orders fill immediately but may have slippage on low-liquidity pairs.',
                'Your exchange must have Order permission enabled on the API key.',
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

      {/* Right panel — chart + open orders */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">

        {/* Chart fills available space */}
        <div className="flex-1 min-h-0">
          <PriceChart exchangeId={activeExchangeId} symbol={selectedSymbol} />
        </div>

        {/* Open orders — compact, max height capped */}
        <div className="flex-shrink-0 max-h-[160px] overflow-hidden">
          <OpenOrdersList exchangeId={activeExchangeId} symbol={selectedSymbol} />
        </div>

      </div>
    </div>
  );
}
