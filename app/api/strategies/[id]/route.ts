export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const strategy = await prisma.strategy.findUnique({ where: { id } });
    if (!strategy) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(strategy);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const allowed = ['name', 'config', 'timeframe', 'symbol']; // status must be changed via start/stop endpoints
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = key === 'config' ? JSON.stringify(body[key]) : body[key];
    }
    const strategy = await prisma.strategy.update({ where: { id }, data });
    return NextResponse.json(strategy);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const CONTROL_BASE = `http://127.0.0.1:${process.env.CONTROL_PORT ?? '8081'}`;

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Stop runner in sidecar if active (strategies run in sidecar, not Next.js process)
    await fetch(`${CONTROL_BASE}/strategy/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId: id }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {}); // non-fatal — sidecar may not be running

    // Delete related records in a transaction (FK constraints)
    await prisma.$transaction([
      prisma.backtestResult.deleteMany({ where: { strategyId: id } }),
      prisma.trade.updateMany({ where: { strategyId: id }, data: { strategyId: null } }),
      prisma.strategy.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
