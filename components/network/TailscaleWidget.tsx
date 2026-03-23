'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wifi, WifiOff, Monitor, Smartphone, Globe, Laptop, Loader2 } from 'lucide-react';
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
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: peer.online ? '#22c55e' : '#374151' }} />
      </div>
    </div>
  );
}

function ToggleSwitch({ connected, loading, onToggle }: { connected: boolean; loading: boolean; onToggle: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      title={connected ? 'Disconnect Tailscale' : 'Connect Tailscale'}
      className="relative flex-shrink-0 transition-opacity"
      style={{ opacity: loading ? 0.6 : 1 }}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6b7280' }} />
      ) : (
        <div
          className="w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5"
          style={{ background: connected ? '#00E5FF30' : '#1e2d45', border: `1px solid ${connected ? '#00E5FF60' : '#243044'}` }}
        >
          <div
            className="w-3.5 h-3.5 rounded-full transition-all duration-200"
            style={{
              background: connected ? '#00E5FF' : '#374151',
              transform: connected ? 'translateX(16px)' : 'translateX(0)',
              boxShadow: connected ? '0 0 6px #00E5FF80' : 'none',
            }}
          />
        </div>
      )}
    </button>
  );
}

/** Full widget — used on the Settings page */
export function TailscaleWidget() {
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(false);

  const { data, isLoading } = useQuery<TailscaleStatus>({
    queryKey: ['tailscale'],
    queryFn: () => fetch('/api/tailscale').then(r => r.json()),
    refetchInterval: 30000,
    staleTime: 25000,
  });

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data || toggling) return;
    setToggling(true);
    try {
      await fetch('/api/tailscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: data.connected ? 'down' : 'up' }),
      });
      // Give Tailscale a moment to change state then refetch
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tailscale'] });
        setToggling(false);
      }, 1500);
    } catch {
      setToggling(false);
    }
  };

  const onlinePeers  = (data?.peers ?? []).filter(p => p.online);
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
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono" style={{ color: data?.connected ? '#22c55e' : '#6b7280' }}>
            {isLoading || toggling ? 'Working...' : data?.connected ? 'Connected' : 'Disconnected'}
          </span>
          <ToggleSwitch connected={!!data?.connected} loading={isLoading || toggling} onToggle={handleToggle} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!data?.connected && !isLoading && !toggling && (
          <div className="rounded px-3 py-3 text-center space-y-2" style={{ background: '#060d18', border: '1px solid #1a2538' }}>
            <WifiOff className="w-6 h-6 mx-auto" style={{ color: '#374151' }} />
            <p className="text-xs font-mono" style={{ color: '#6b7280' }}>Tailscale is not installed or not running</p>
            <p className="text-[10px] font-mono" style={{ color: '#4b5563' }}>
              Run <code className="px-1 rounded" style={{ background: '#121C2F', color: '#00E5FF' }}>bash scripts/setup-tailscale.sh</code> on the server
            </p>
          </div>
        )}

        {toggling && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00E5FF' }} />
            <span className="text-xs font-mono" style={{ color: '#6b7280' }}>
              {data?.connected ? 'Disconnecting...' : 'Connecting...'}
            </span>
          </div>
        )}

        {data?.connected && !toggling && (
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
                  <span style={{ color: '#9ca3af' }}>{data.ip ? `http://${data.ip}:3000` : '—'}</span>
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
                <p className="text-[10px] font-mono text-center py-2" style={{ color: '#4b5563' }}>No other devices on this Tailnet</p>
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

/** Compact status dot + toggle — used in the sidebar */
export function TailscaleStatusDot({ expanded }: { expanded: boolean }) {
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(false);

  const { data } = useQuery<TailscaleStatus>({
    queryKey: ['tailscale'],
    queryFn: () => fetch('/api/tailscale').then(r => r.json()),
    refetchInterval: 60000,
    staleTime: 55000,
  });

  const connected = data?.connected ?? false;
  const ip = data?.ip ?? null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    try {
      await fetch('/api/tailscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: connected ? 'down' : 'up' }),
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tailscale'] });
        setToggling(false);
      }, 1500);
    } catch {
      setToggling(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-md text-xs w-full">
      <div className="relative flex-shrink-0">
        <Globe className="w-4 h-4" style={{ color: connected ? '#00E5FF' : '#374151' }} />
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
          style={{ background: toggling ? '#f59e0b' : connected ? '#22c55e' : '#374151' }}
        />
      </div>
      {expanded && (
        <>
          <span className="font-mono truncate flex-1" style={{ color: connected ? '#9ca3af' : '#4b5563' }}>
            {toggling ? 'Working...' : connected && ip ? ip : 'Tailscale off'}
          </span>
          <ToggleSwitch connected={connected} loading={toggling} onToggle={handleToggle} />
        </>
      )}
    </div>
  );
}
