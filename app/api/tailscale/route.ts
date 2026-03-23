export const dynamic = 'force-dynamic';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

export interface TailscaleStatus {
  connected: boolean;
  ip: string | null;
  hostname: string | null;
  dnsName: string | null;
  version: string | null;
  peers: TailscalePeer[];
}

export interface TailscalePeer {
  hostname: string;
  dnsName: string;
  ip: string;
  os: string;
  online: boolean;
  active: boolean;
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json() as { action: 'up' | 'down' };
    if (action !== 'up' && action !== 'down') {
      return NextResponse.json({ error: 'action must be "up" or "down"' }, { status: 400 });
    }
    await execAsync(`tailscale ${action}`, { timeout: 15000 });
    return NextResponse.json({ success: true, action });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { stdout } = await execAsync('tailscale status --json', { timeout: 5000 });
    const data = JSON.parse(stdout);

    const self = data.Self ?? {};
    const peers: TailscalePeer[] = Object.values(data.Peer ?? {}).map((p: unknown) => {
      const peer = p as Record<string, unknown>;
      return {
        hostname: peer.HostName as string ?? '',
        dnsName: (peer.DNSName as string ?? '').replace(/\.$/, ''),
        ip: ((peer.TailscaleIPs as string[]) ?? [])[0] ?? '',
        os: peer.OS as string ?? '',
        online: peer.Online as boolean ?? false,
        active: peer.Active as boolean ?? false,
      };
    });

    const status: TailscaleStatus = {
      connected: true,
      ip: ((self.TailscaleIPs as string[]) ?? [])[0] ?? null,
      hostname: self.HostName as string ?? null,
      dnsName: (self.DNSName as string ?? '').replace(/\.$/, '') || null,
      version: data.Version as string ?? null,
      peers,
    };

    return NextResponse.json(status);
  } catch {
    // tailscale not installed or not running
    return NextResponse.json({
      connected: false,
      ip: null,
      hostname: null,
      dnsName: null,
      version: null,
      peers: [],
    } satisfies TailscaleStatus);
  }
}
