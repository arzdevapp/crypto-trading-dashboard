'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlaceOrder } from '@/hooks/useOrders';
import { toast } from 'sonner';

interface OrderFormProps {
  exchangeId: string;
  symbol: string;
}

const PCT_STEPS = [25, 50, 75, 100];

export function OrderForm({ exchangeId, symbol }: OrderFormProps) {
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const { mutate: placeOrder, isPending } = usePlaceOrder();

  const quoteAsset = symbol.split('/')[1] ?? 'USDT';
  const baseAsset  = symbol.split('/')[0];

  // Live balance
  const { data: balanceData } = useQuery<Record<string, { free: number; used: number; total: number }>>({
    queryKey: ['balance', exchangeId],
    queryFn: () => fetch(`/api/exchanges/${exchangeId}/balance`).then(r => r.json()),
    enabled: !!exchangeId,
    refetchInterval: 30000,
    staleTime: 25000,
  });
  const freeQuote = balanceData?.[quoteAsset]?.free ?? 0;
  const freeBase  = balanceData?.[baseAsset]?.free  ?? 0;

  // Live price for cost estimates
  const { data: ticker } = useQuery<{ last: number }>({
    queryKey: ['ticker', exchangeId, symbol],
    queryFn: () => fetch(`/api/exchanges/${exchangeId}/ticker/${encodeURIComponent(symbol)}`).then(r => r.json()),
    enabled: !!exchangeId,
    refetchInterval: 10000,
    staleTime: 9000,
  });
  const livePrice = ticker?.last ?? 0;

  const execPrice = orderType === 'limit' && price ? parseFloat(price) : livePrice;

  // Derived
  const parsedAmount = parseFloat(amount);
  const estimatedCost  = !isNaN(parsedAmount) && parsedAmount > 0 && execPrice > 0 ? parsedAmount * execPrice : 0;
  const availableForBuy  = freeQuote;
  const availableForSell = freeBase;

  const applyPct = (pct: number) => {
    if (side === 'buy') {
      if (freeQuote <= 0 || execPrice <= 0) return;
      const usdt = (freeQuote * pct) / 100;
      setAmount(((usdt) / execPrice).toFixed(6));
    } else {
      if (freeBase <= 0) return;
      setAmount(((freeBase * pct) / 100).toFixed(6));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    placeOrder(
      {
        exchangeId,
        symbol,
        type: orderType,
        side,
        amount: parseFloat(amount),
        price: price ? parseFloat(price) : undefined,
        stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${side.toUpperCase()} order placed`);
          setAmount('');
          setPrice('');
          setStopPrice('');
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Place Order — {symbol}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as typeof orderType)}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="market" className="flex-1 text-xs">Market</TabsTrigger>
              <TabsTrigger value="limit" className="flex-1 text-xs">Limit</TabsTrigger>
              <TabsTrigger value="stop" className="flex-1 text-xs">Stop</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button" variant={side === 'buy' ? 'default' : 'outline'}
              className={side === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
              onClick={() => { setSide('buy'); setAmount(''); }} size="sm"
            >Buy</Button>
            <Button
              type="button" variant={side === 'sell' ? 'default' : 'outline'}
              className={side === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={() => { setSide('sell'); setAmount(''); }} size="sm"
            >Sell</Button>
          </div>

          {/* Available balance */}
          <div className="rounded px-2.5 py-2 space-y-1" style={{ background: '#0d1220', border: '1px solid #1e2d45' }}>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-foreground">Available {quoteAsset}</span>
              <span style={{ color: freeQuote > 0 ? '#9ca3af' : '#374151' }}>
                {freeQuote > 0
                  ? `$${freeQuote.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </span>
            </div>
            {freeBase > 0 && (
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Available {baseAsset}</span>
                <span style={{ color: '#9ca3af' }}>
                  {freeBase.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })} {baseAsset}
                </span>
              </div>
            )}
          </div>

          {/* % quick-select */}
          {((side === 'buy' && availableForBuy > 0) || (side === 'sell' && availableForSell > 0)) && (
            <div className="grid grid-cols-4 gap-1">
              {PCT_STEPS.map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyPct(pct)}
                  className="py-1 rounded text-[10px] font-mono font-bold transition-all"
                  style={{ background: '#121C2F', border: '1px solid #1e2d45', color: '#6b7280' }}
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    el.style.color = side === 'buy' ? '#22c55e' : '#ef4444';
                    el.style.borderColor = side === 'buy' ? '#22c55e40' : '#ef444440';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    el.style.color = '#6b7280';
                    el.style.borderColor = '#1e2d45';
                  }}
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {(orderType === 'limit' || orderType === 'stop') && (
              <div>
                <Label className="text-xs">{orderType === 'stop' ? 'Limit Price' : 'Price'}</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder={livePrice > 0 ? livePrice.toFixed(2) : '0.00'}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number" step="any" min="0"
                />
              </div>
            )}
            {orderType === 'stop' && (
              <div>
                <Label className="text-xs">Stop Price</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="0.00"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  type="number" step="any" min="0"
                />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Amount ({baseAsset})</Label>
                {livePrice > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    @ ${livePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <Input
                className="h-8 text-xs"
                placeholder="0.000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number" step="any" min="0"
              />
            </div>
          </div>

          {/* Estimated cost / proceeds */}
          {estimatedCost > 0 && (
            <div className="rounded px-2.5 py-1.5 space-y-0.5" style={{ background: '#060d18', border: '1px solid #1a2538' }}>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">
                  {side === 'buy' ? 'Estimated cost' : 'Estimated proceeds'}
                </span>
                <span style={{ color: side === 'buy' ? '#f59e0b' : '#22c55e' }}>
                  ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {quoteAsset}
                </span>
              </div>
              {side === 'buy' && freeQuote > 0 && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">% of balance</span>
                  <span style={{ color: estimatedCost / freeQuote > 0.9 ? '#ef4444' : '#6b7280' }}>
                    {Math.min(100, (estimatedCost / freeQuote) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              {side === 'sell' && freeBase > 0 && parsedAmount > 0 && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">% of holdings</span>
                  <span style={{ color: '#6b7280' }}>
                    {Math.min(100, (parsedAmount / freeBase) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit" disabled={isPending} size="sm"
            className={`w-full ${side === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {isPending ? 'Placing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${baseAsset}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
