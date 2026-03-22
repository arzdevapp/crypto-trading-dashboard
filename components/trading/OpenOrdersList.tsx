'use client';
import { useOpenOrders, useCancelOrder } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCrypto } from '@/lib/utils';

interface OpenOrdersListProps {
  exchangeId: string;
  symbol?: string;
}

export function OpenOrdersList({ exchangeId, symbol }: OpenOrdersListProps) {
  const { data: orders = [], isLoading } = useOpenOrders(exchangeId, symbol);
  const { mutate: cancelOrder } = useCancelOrder();

  const handleCancel = (orderId: string, sym: string) => {
    cancelOrder(
      { orderId, symbol: sym, exchangeId },
      {
        onSuccess: () => toast.success('Order cancelled'),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Open Orders {orders.length > 0 && `(${orders.length})`}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-auto max-h-[110px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Symbol</TableHead>
              <TableHead className="text-xs">Side</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs text-right">Amount</TableHead>
              <TableHead className="text-xs text-right">Price</TableHead>
              <TableHead className="text-xs text-right">Filled</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-4">Loading...</TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-4">No open orders</TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="text-xs font-medium">{order.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={order.side === 'buy' ? 'default' : 'destructive'} className="text-[10px] py-0">
                      {order.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{order.type}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{formatCrypto(order.amount, 6)}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{order.price ? formatCrypto(order.price, 2) : 'MKT'}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{formatCrypto(order.filled, 6)}</TableCell>
                  <TableCell>
                    <Button
                      size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => handleCancel(order.id, order.symbol)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
