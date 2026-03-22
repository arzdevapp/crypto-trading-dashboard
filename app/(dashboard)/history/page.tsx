import { TradeHistoryTable } from '@/components/analytics/TradeHistoryTable';
import { PageHelp } from '@/components/ui/page-help';
import { History } from 'lucide-react';

export default function HistoryPage() {
  return (
    <div className="h-full flex flex-col p-2 gap-2" style={{ background: '#070B10' }}>

      <div className="flex items-center gap-2 flex-shrink-0 px-1">
        <History className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
        <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Trade History</span>
        <PageHelp
          title="Trade History"
          description="A paginated log of every trade recorded in the database — both manual orders and bot-executed trades. Shows entry price, quantity, P&L and status."
          steps={[
            { label: 'Select an exchange', detail: 'The table filters to the active exchange automatically. Switch exchanges in the header to view different accounts.' },
            { label: 'Read the table', detail: 'Each row is one trade. Time, symbol, side (BUY/SELL), type, quantity, price, P&L and status are shown.' },
            { label: 'Check P&L', detail: 'Green P&L = profitable closed trade. Red = loss. A dash (—) means the trade is still open or P&L was not recorded.' },
            { label: 'Navigate pages', detail: 'Use the ‹ › arrows in the top-right of the table to page through older trades. Each page shows 20 trades.' },
          ]}
          tips={[
            'Trades are recorded when orders are placed via the Trading page or by a running strategy.',
            'P&L is only calculated on filled (closed) trades.',
            'Use this page to audit your bot performance trade by trade.',
          ]}
        />
      </div>

      <div className="flex-1 min-h-0">
        <TradeHistoryTable />
      </div>

    </div>
  );
}
