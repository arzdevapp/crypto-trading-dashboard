'use client';
import { useBalance } from '@/hooks/usePortfolio';
import { useStore } from '@/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCrypto } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export function BalanceTable() {
  const { activeExchangeId } = useStore();
  const { data: balance, isLoading } = useBalance(activeExchangeId);

  const entries = Object.entries(balance ?? {}).sort((a, b) => b[1].total - a[1].total);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-1 pt-2 px-3 flex-shrink-0">
        <CardTitle className="text-xs">Balances</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Free</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  {activeExchangeId ? 'No balances found' : 'Select an exchange to view balances'}
                </TableCell>
              </TableRow>
            ) : (
              entries.map(([asset, bal]) => (
                <TableRow key={asset}>
                  <TableCell className="font-medium">{asset}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCrypto(bal.free, 6)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatCrypto(bal.used, 6)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">{formatCrypto(bal.total, 6)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
