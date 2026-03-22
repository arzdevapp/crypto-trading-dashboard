'use client';
import { useState } from 'react';
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

export function OrderForm({ exchangeId, symbol }: OrderFormProps) {
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const { mutate: placeOrder, isPending } = usePlaceOrder();

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
              onClick={() => setSide('buy')} size="sm"
            >Buy</Button>
            <Button
              type="button" variant={side === 'sell' ? 'default' : 'outline'}
              className={side === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
              onClick={() => setSide('sell')} size="sm"
            >Sell</Button>
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">Amount</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number" step="any" min="0"
              />
            </div>
            {(orderType === 'limit' || orderType === 'stop') && (
              <div>
                <Label className="text-xs">{orderType === 'stop' ? 'Limit Price' : 'Price'}</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  placeholder="0.00"
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
          </div>

          <Button
            type="submit" disabled={isPending} size="sm"
            className={`w-full ${side === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {isPending ? 'Placing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol.split('/')[0]}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
