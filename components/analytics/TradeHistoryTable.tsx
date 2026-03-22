'use client';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { formatCurrency, formatCrypto } from '@/lib/utils';
import { useStore } from '@/store';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function TradeHistoryTable() {
  const { activeExchangeId } = useStore();
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data } = useQuery({
    queryKey: ['trades', activeExchangeId, page],
    queryFn: async () => {
      const url = `/api/trades?limit=${limit}&offset=${page * limit}${activeExchangeId ? `&exchangeId=${activeExchangeId}` : ''}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const trades = data?.trades ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Trade History ({total})</CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="text-xs text-muted-foreground">{page + 1}/{Math.max(totalPages, 1)}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Time</TableHead>
              <TableHead className="text-xs">Symbol</TableHead>
              <TableHead className="text-xs">Side</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs text-right">Qty</TableHead>
              <TableHead className="text-xs text-right">Price</TableHead>
              <TableHead className="text-xs text-right">P&L</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-8">
                  No trades yet
                </TableCell>
              </TableRow>
            ) : trades.map((trade: {
              id: string; openedAt: string; symbol: string; side: string; type: string;
              quantity: number; price: number; pnl: number | null; status: string;
            }) => (
              <TableRow key={trade.id}>
                <TableCell className="text-xs font-mono">{format(new Date(trade.openedAt), 'MM/dd HH:mm')}</TableCell>
                <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                <TableCell>
                  <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'} className="text-[10px] py-0">
                    {trade.side.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs capitalize">{trade.type}</TableCell>
                <TableCell className="text-xs text-right font-mono">{formatCrypto(trade.quantity, 6)}</TableCell>
                <TableCell className="text-xs text-right font-mono">{formatCurrency(trade.price)}</TableCell>
                <TableCell className={`text-xs text-right font-mono ${trade.pnl == null ? '' : trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {trade.pnl == null ? '—' : formatCurrency(trade.pnl)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] py-0">{trade.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
