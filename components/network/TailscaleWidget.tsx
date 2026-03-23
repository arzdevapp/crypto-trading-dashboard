'use client';
import { useQuery } from '@tanstack/react-query';
import { Wifi, WifiOff, Monitor, Smartphone, Globe, Laptop } from 'lucide-react';
import type { TailscaleStatus, TailscalePeer } from '@/app/api/tailscale/route';

function osIcon(os: string) {
  const o = os.toLowerCase();
  if (o.includes('ios') || o.includes('android')) return <Smartphone className="w-3 h-3 flex-shrink-0" />;
  if (o.includes('windows') || o.includes('mac') || o.includes('linux')) return <Laptop className="w-3 h-3 flex-shrink-0" />;
  return <Monitor className="w-3 h-3 flex-shrink-0" />;
}

function PeerRow({ peer }: { peer: TailscalePeer }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <span style={{ color: peer.online ? '#22c55e' : '#4b5563' }}>{osIcon(peer.os)}</span>
        <span className="text-[10px] font-mono truncate" style={{ color: peer.online ? '#C7D1DB' : '#4b5563' }}>
          {peer.hostname || peer.dnsName}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>{peer.ip}</span>
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: peer.online ? '#22c55e' : '#374151' }}
        />
      </div>
    </div>
  );
}

/** Full widget — used on the Settings / Network page */
export function TailscaleWidget() {
  const { data, isLoading } = useQuery<TailscaleStatus>({
    queryKey: ['tailscale'],
    queryFn: () => fetch('/api/tailscale').then(r => r.json()),
    refetchInterval: 30000,
    staleTime: 25000,
  });

  const onlinePeers = (data?.peers ?? []).filter(p => p.online);
  const offlinePeers = (data?.peers ?? []).filter(p => !p.online);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: '#0E1626', borderColor: '#243044' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#243044', background: '#070B10' }}>
        <div className="flex items-center gap-2">
          {data?.connected
            ? <Wifi className="w-4 h-4" style={{ color: '#00E5FF' }} />
            : <WifiOff className="w-4 h-4" style={{ color: '#6b7280' }} />}
          <span className="text-sm font-mono font-bold tracking-widest uppercase" style={{ color: data?.connected ? '#00E5FF' : '#6b7280' }}>
            Tailscale
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: data?.connected ? '#22c55e' : '#374151' }}
          />
          <span className="text-[10px] font-mono" style={{ color: data?.connected ? '#22c55e' : '#6b7280' }}>
            {isLoading ? 'Checking...' : data?.connected ? 'Connected' : 'Not running'}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!data?.connected && !isLoading && (
          <div className="rounded px-3 py-3 text-center space-y-2" style={{ background: '#060d18', border: '1px solid #1a2538' }}>
            <WifiOff className="w-6 h-6 mx-auto" style={{ color: '#374151' }} />
            <p className="text-xs font-mono" style={{ color: '#6b7280' }}>Tailscale is not installed or not running</p>
            <p className="text-[10px] font-mono" style={{ color: '#4b5563' }}>
              Run <code className="px-1 rounded" style={{ background: '#121C2F', color: '#00E5FF' }}>bash scripts/setup-tailscale.sh</code> on the server
            </p>
          </div>
        )}

        {data?.connected && (
          <>
            {/* This device */}
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>This device</div>
              <div className="rounded px-3 py-2.5 space-y-1.5" style={{ background: '#060d18', border: '1px solid #1a2538' }}>
                <div className="flex justify-between text-[11px] font-mono">
                  <span style={{ color: '#6b7280' }}>Tailscale IP</span>
                  <span className="font-bold" style={{ color: '#00E5FF' }}>{data.ip ?? '—'}</span>
                </div>
                {data.dnsName && (
                  <div className="flex justify-between text-[11px] font-mono">
                    <span style={{ color: '#6b7280' }}>MagicDNS</span>
                    <span style={{ color: '#9ca3af' }}>{data.dnsName}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] font-mono">
                  <span style={{ color: '#6b7280' }}>Dashboard URL</span>
                  <span style={{ color: '#9ca3af' }}>
                    {data.ip ? `http://${data.ip}:3000` : '—'}
                  </span>
                </div>
                {data.version && (
                  <div className="flex justify-between text-[11px] font-mono">
                    <span style={{ color: '#6b7280' }}>Version</span>
                    <span style={{ color: '#4b5563' }}>v{data.version}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Peers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#4b5563' }}>
                  Devices ({data.peers.length})
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono">
                  <span style={{ color: '#22c55e' }}>{onlinePeers.length} online</span>
                  {offlinePeers.length > 0 && <span style={{ color: '#4b5563' }}>{offlinePeers.length} offline</span>}
                </div>
              </div>

              {data.peers.length === 0 ? (
                <p className="text-[10px] font-mono text-center py-2" style={{ color: '#4b5563' }}>
                  No other devices on this Tailnet
                </p>
              ) : (
                <div className="rounded px-3 py-1 divide-y" style={{ background: '#060d18', border: '1px solid #1a2538', borderColor: '#1a2538' }}>
                  {onlinePeers.map(p => <PeerRow key={p.ip} peer={p} />)}
                  {offlinePeers.map(p => <PeerRow key={p.ip} peer={p} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Compact status dot — used in the sidebar */
export function TailscaleStatusDot({ expanded }: { expanded: boolean }) {
  const { data } = useQuery<TailscaleStatus>({
    queryKey: ['tailscale'],
    queryFn: () => fetch('/api/tailscale').then(r => r.json()),
    refetchInterval: 60000,
    staleTime: 55000,
  });

  const connected = data?.connected ?? false;
  const ip = data?.ip ?? null;

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-md text-xs w-full">
      <div className="relative flex-shrink-0">
        <Globe className="w-4 h-4" style={{ color: connected ? '#00E5FF' : '#374151' }} />
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
          style={{ background: connected ? '#22c55e' : '#374151' }}
        />
      </div>
      {expanded && (
        <span className="font-mono truncate" style={{ color: connected ? '#9ca3af' : '#4b5563' }}>
          {connected && ip ? ip : 'Tailscale off'}
        </span>
      )}
    </div>
  );
}
