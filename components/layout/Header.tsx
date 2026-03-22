'use client';
import { Bell, RefreshCw, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStore } from '@/store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface ExchangeConfig {
  id: string;
  label: string;
  sandbox: boolean;
}

export function Header() {
  const { activeExchangeId, setActiveExchangeId, setMobileMenuOpen } = useStore();
  const queryClient = useQueryClient();

  const { data: exchanges = [] } = useQuery<ExchangeConfig[]>({
    queryKey: ['exchanges'],
    queryFn: async () => {
      const res = await fetch('/api/exchanges');
      return res.json();
    },
  });

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost" size="icon" className="h-8 w-8 xl:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="w-4 h-4" />
        </Button>
        {exchanges.length > 0 ? (
          <Select value={activeExchangeId ?? ''} onValueChange={setActiveExchangeId}>
            <SelectTrigger className="w-32 xl:w-44 h-8 text-xs">
              <SelectValue placeholder="Select exchange" />
            </SelectTrigger>
            <SelectContent>
              {exchanges.map((ex) => (
                <SelectItem key={ex.id} value={ex.id}>
                  <span className="flex items-center gap-2">
                    {ex.label}
                    {ex.sandbox && <Badge variant="secondary" className="text-[10px] py-0 px-1">Testnet</Badge>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">No exchanges configured</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => queryClient.invalidateQueries()}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
}
