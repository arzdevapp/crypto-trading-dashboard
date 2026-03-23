'use client';
import { useBalance } from '@/hooks/usePortfolio';
import { useStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { Wallet, RefreshCw } from 'lucide-react';

interface WalletPanelProps {
  /** If provided, % buttons call this so the parent can fill an input */
  onSelectPct?: (pct: number, amountBase: number, amountQuote: number) => void;
  /** compact = no label rows, just the key numbers */
  compact?: boolean;
}

const PCT_STEPS = [25, 50, 75, 100] as const;

export function WalletPanel({ onSelectPct, compact = false }: WalletPanelProps) {
  const { activeExchangeId, selectedSymbol } = useStore();
  const quoteAsset = selectedSymbol.split('/')[1] ?? 'USDT';
  const baseAsset  = selectedSymbol.split('/')[0];

  const { data: balanceData, isLoading, isError, refetch, isFetching } = useBalance(activeExchangeId);

  const { data: ticker } = useQuery<{ last: number }>({
    queryKey: ['ticker', activeExchangeId, selectedSymbol],
    queryFn: () => fetch(`/api/exchanges/${activeExchangeId}/ticker/${encodeURIComponent(selectedSymbol)}`).then(r => r.json()),
    enabled: !!activeExchangeId,
    refetchInterval: 10000,
    staleTime: 9000,
  });

  // Get all assets with non-zero balance
  const heldAssets = Object.entries(balanceData || {})
    .filter(([_, balance]) => (balance?.free ?? 0) > 0)
    .sort(([a], [b]) => {
      // Prioritize quote asset, then base asset, then alphabetical
      if (a === quoteAsset) return -1;
      if (b === quoteAsset) return 1;
      if (a === baseAsset) return -1;
      if (b === baseAsset) return 1;
      return a.localeCompare(b);
    });

  const livePrice  = ticker?.last ?? 0;
  const freeQuote  = balanceData?.[quoteAsset]?.free  ?? 0;
  const usedQuote  = balanceData?.[quoteAsset]?.used  ?? 0;
  const totalQuote = balanceData?.[quoteAsset]?.total ?? 0;
  const freeBase   = balanceData?.[baseAsset]?.free   ?? 0;
  const usedBase   = balanceData?.[baseAsset]?.used   ?? 0;
  const totalBase  = balanceData?.[baseAsset]?.total  ?? 0;

  const usedPctQuote  = totalQuote > 0 ? (usedQuote  / totalQuote)  * 100 : 0;
  const heldPctBase   = totalBase  > 0 ? (freeBase   / totalBase)   * 100 : 0;

  const baseValueUsd  = livePrice > 0 ? freeBase  * livePrice : 0;
  const totalValueUsd = freeQuote + baseValueUsd +
    (usedQuote) +
    (livePrice > 0 ? usedBase * livePrice : 0);

  const handlePct = (pct: number) => {
    if (!onSelectPct) return;
    const allocQuote = (freeQuote * pct) / 100;
    const allocBase  = (freeBase  * pct) / 100;
    onSelectPct(pct, allocBase, allocQuote);
  };

  if (!activeExchangeId) {
    return (
      <div className="rounded-lg border px-3 py-3" style={{ background: '#0E1626', borderColor: '#243044' }}>
        <p className="text-[10px] font-mono text-center" style={{ color: '#374151' }}>Select an exchange to view wallet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
        <div className="flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
          <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Wallet</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1 rounded transition-colors hover:bg-white/5"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} style={{ color: '#6b7280' }} />
        </button>
      </div>

      <div className="p-2.5 space-y-2.5">
        {isLoading ? (
          <div className="space-y-1.5">
            {[1,2,3].map(i => (
              <div key={i} className="h-4 rounded animate-pulse" style={{ background: '#121C2F' }} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <p className="text-[10px] font-mono text-center" style={{ color: '#ef4444' }}>Failed to load balance</p>
            <button
              onClick={() => refetch()}
              className="text-[9px] font-mono px-2 py-0.5 rounded"
              style={{ background: '#121C2F', color: '#00E5FF', border: '1px solid #1e2d45' }}
            >
              Retry
            </button>
          </div>
        ) : heldAssets.length === 0 ? (
          <p className="text-[10px] font-mono text-center py-2" style={{ color: '#4b5563' }}>No holdings</p>
        ) : compact ? (
          // Compact mode — list all assets
          <div className="space-y-1.5">
            {heldAssets.map(([asset, balance]) => (
              <div key={asset} className="flex justify-between text-[10px] font-mono">
                <span style={{ color: '#6b7280' }}>{asset}</span>
                <span style={{ color: '#C7D1DB' }}>
                  {(balance?.free ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: asset === quoteAsset ? 2 : 0,
                    maximumFractionDigits: asset === quoteAsset ? 2 : 6
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          // Full mode — detailed view
          <>
            {heldAssets.map(([asset, balance]) => {
              const free = balance?.free ?? 0;
              const used = balance?.used ?? 0;
              const total = balance?.total ?? 0;
              const usedPct = total > 0 ? (used / total) * 100 : 0;

              return (
                <div key={asset} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span style={{ color: '#6b7280' }}>{asset}</span>
                    <span style={{ color: free > 0 ? '#C7D1DB' : '#6b7280' }}>
                      {free.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}
                    </span>
                  </div>
                  {used > 0 && (
                    <div className="flex justify-between text-[10px] font-mono">
                      <span style={{ color: '#4b5563' }}>In orders</span>
                      <span style={{ color: '#6b7280' }}>
                        {used.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </span>
                    </div>
                  )}
                  {total > 0 && (
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: '#121C2F' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, 100 - usedPct)}%`,
                          background: free / total > 0.5 ? '#22c55e' : free / total > 0.2 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* % quick-select — only shown if parent wants them */}
            {onSelectPct && (freeQuote > 0 || freeBase > 0) && (
              <div className="pt-0.5">
                <div className="text-[9px] font-mono mb-1.5" style={{ color: '#4b5563' }}>Quick allocate</div>
                <div className="grid grid-cols-4 gap-1">
                  {PCT_STEPS.map(pct => {
                    const quotePortion = (freeQuote * pct) / 100;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handlePct(pct)}
                        className="flex flex-col items-center py-1 rounded transition-all"
                        style={{ background: '#121C2F', border: '1px solid #1e2d45' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#00E5FF40';
                          e.currentTarget.style.color = '#00E5FF';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#1e2d45';
                          e.currentTarget.style.color = '';
                        }}
                      >
                        <span className="text-[9px] font-mono font-bold" style={{ color: '#00E5FF' }}>
                          {pct === 100 ? 'MAX' : `${pct}%`}
                        </span>
                        {quotePortion > 0 && (
                          <span className="text-[8px] font-mono" style={{ color: '#4b5563' }}>
                            ${quotePortion >= 1000
                              ? `${(quotePortion / 1000).toFixed(1)}k`
                              : quotePortion.toFixed(0)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
