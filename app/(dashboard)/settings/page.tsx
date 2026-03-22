'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SUPPORTED_EXCHANGES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Settings, Plug, RefreshCw, GitBranch, CheckCircle2, AlertCircle } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';

interface ExchangeConfig {
  id: string;
  name: string;
  label: string;
  sandbox: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [name, setName] = useState('binance');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [sandbox, setSandbox] = useState(true);
  const queryClient = useQueryClient();

  const { data: exchanges = [] } = useQuery<ExchangeConfig[]>({
    queryKey: ['exchanges'],
    queryFn: async () => {
      const res = await fetch('/api/exchanges');
      return res.json();
    },
  });

  const { mutate: addExchange, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, label, apiKey, apiSecret, sandbox }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed to add exchange'); }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Exchange added');
      setLabel(''); setApiKey(''); setApiSecret('');
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
    },
    onError: (err) => toast.error(err.message),
  });

  // --- System update state ---
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updating, setUpdating]   = useState(false);

  const { data: versionInfo, refetch: refetchVersion } = useQuery<{
    commit: string; branch: string; upToDate: boolean | null; logLines: string[]; error?: string;
  }>({
    queryKey: ['version'],
    queryFn:  async () => {
      const res = await fetch('/api/admin/update');
      return res.json();
    },
    refetchInterval: updating ? 4000 : false,
  });

  async function triggerUpdate() {
    setUpdating(true);
    setUpdateLog(['Starting update...']);
    try {
      const res = await fetch('/api/admin/update', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      setUpdateLog(prev => [...prev, data.message, 'Watching deploy log...']);
      // Poll log for 90s then stop
      let ticks = 0;
      const poll = setInterval(async () => {
        ticks++;
        await refetchVersion();
        if (ticks >= 22) { clearInterval(poll); setUpdating(false); }
      }, 4000);
    } catch (err) {
      setUpdateLog(prev => [...prev, `Error: ${(err as Error).message}`]);
      setUpdating(false);
    }
  }

  const { mutate: removeExchange } = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/exchanges/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
    },
    onSuccess: () => {
      toast.success('Exchange removed');
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
    },
  });

  return (
    <div className="h-full grid xl:grid-cols-2 grid-cols-1 auto-rows-min gap-2 p-2 overflow-y-auto" style={{ background: '#070B10' }}>

      {/* Left: connected exchanges */}
      <div className="flex flex-col gap-2 order-2 xl:order-1">
        <div className="rounded-lg border flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: '#243044', background: '#070B10' }}>
            <Plug className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Connected Exchanges</span>
            <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#121C2F', color: '#8B949E' }}>
              {exchanges.length} configured
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {exchanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Plug className="w-8 h-8" style={{ color: '#243044' }} />
                <p className="text-xs font-mono" style={{ color: '#8B949E' }}>No exchanges configured</p>
                <p className="text-[11px] font-mono" style={{ color: '#243044' }}>Add one using the form →</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#243044' }}>
                {exchanges.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-[#121C2F] transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium" style={{ color: '#C7D1DB' }}>{ex.label}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{ex.name}</Badge>
                        {ex.sandbox && <Badge variant="secondary" className="text-[10px] py-0">Testnet</Badge>}
                      </div>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: '#8B949E' }}>
                        Added {new Date(ex.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => removeExchange(ex.id)}>
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#8B949E' }} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: add exchange form — on mobile shows first */}
      <div className="order-1 xl:order-2">
        <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
            <Settings className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>Add Exchange</span>
            <PageHelp
              title="Settings — Add Exchange"
              description="Connect your exchange API keys so the app can read balances, place orders, and fetch live market data. Keys are stored locally in the app's database."
              steps={[
                { label: 'Choose your exchange', detail: 'Select from the supported list (Binance, Kraken, Bybit, etc.).' },
                { label: 'Give it a label', detail: 'A friendly name like "Binance Main" or "Kraken Test" to identify it in the header dropdown.' },
                { label: 'Enter API Key & Secret', detail: 'Generate these in your exchange account under API Management. Copy both values carefully.' },
                { label: 'Set Testnet mode', detail: 'Enable to use the exchange sandbox (fake money, no real orders). Disable only when ready to trade live.' },
                { label: 'Click Add Exchange', detail: 'The exchange appears in the left panel. Select it in the header dropdown to activate it.' },
              ]}
              tips={[
                'For Kraken: enable Query Funds + Create & Modify Orders permissions on the API key.',
                'Kraken has no public sandbox — use read-only keys to test safely.',
                'You can connect multiple exchanges and switch between them in the header.',
                'To update keys, delete the exchange entry and re-add it.',
              ]}
            />
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>Exchange</Label>
                <Select value={name} onValueChange={setName}>
                  <SelectTrigger className="h-7 mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_EXCHANGES.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>Label</Label>
                <Input className="h-7 mt-1 text-xs" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My Binance" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>API Key</Label>
              <Input className="h-7 mt-1 text-xs font-mono" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Your API key" />
            </div>
            <div>
              <Label className="text-[10px] font-mono" style={{ color: '#8B949E' }}>API Secret</Label>
              <Input className="h-7 mt-1 text-xs font-mono" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Your API secret" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={sandbox} onCheckedChange={setSandbox} id="sandbox" />
              <Label htmlFor="sandbox" className="text-[10px] font-mono" style={{ color: '#8B949E' }}>Testnet / Sandbox</Label>
            </div>
            <Button
              size="sm" className="w-full gap-1 text-xs"
              disabled={isPending || !label || !apiKey || !apiSecret}
              onClick={() => addExchange()}
            >
              <Plus className="w-3.5 h-3.5" /> Add Exchange
            </Button>
          </div>
        </div>
      </div>

      {/* System Update panel — full width below the two columns */}
      <div className="xl:col-span-2 order-3 w-full">
        <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
            <RefreshCw className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: '#00E5FF' }}>System Update</span>
            {versionInfo?.upToDate === true && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-mono" style={{ color: '#3FB950' }}>
                <CheckCircle2 className="w-3 h-3" /> Up to date
              </span>
            )}
            {versionInfo?.upToDate === false && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-mono" style={{ color: '#F0883E' }}>
                <AlertCircle className="w-3 h-3" /> Update available
              </span>
            )}
          </div>
          <div className="p-3 space-y-3">
            {/* Version info */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-3 h-3" style={{ color: '#8B949E' }} />
                <span className="text-[11px] font-mono" style={{ color: '#8B949E' }}>Branch:</span>
                <span className="text-[11px] font-mono" style={{ color: '#C7D1DB' }}>{versionInfo?.branch ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono" style={{ color: '#8B949E' }}>Commit:</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#121C2F', color: '#79C0FF' }}>
                  {versionInfo?.commit ?? '—'}
                </span>
              </div>
              <Button
                size="sm"
                className="ml-auto gap-1.5 text-xs h-7"
                disabled={updating}
                onClick={triggerUpdate}
                style={{ background: updating ? '#121C2F' : '#1B3A6B', color: '#C7D1DB', border: '1px solid #243044' }}
              >
                <RefreshCw className={`w-3 h-3 ${updating ? 'animate-spin' : ''}`} />
                {updating ? 'Updating…' : 'Update Now'}
              </Button>
            </div>

            {/* Deploy log */}
            {(updateLog.length > 0 || (versionInfo?.logLines?.length ?? 0) > 0) && (
              <div
                className="rounded text-[10px] font-mono p-2 max-h-40 overflow-y-auto space-y-0.5"
                style={{ background: '#070B10', border: '1px solid #243044', color: '#8B949E' }}
              >
                {(updateLog.length > 0 ? updateLog : versionInfo?.logLines ?? []).map((line, i) => (
                  <div key={i} style={{ color: line.toLowerCase().includes('error') ? '#F85149' : line.includes('complete') ? '#3FB950' : '#8B949E' }}>
                    {line}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] font-mono" style={{ color: '#3a4a5e' }}>
              Pulls latest code from GitHub, runs migrations, rebuilds, and reloads PM2. App will restart briefly.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
