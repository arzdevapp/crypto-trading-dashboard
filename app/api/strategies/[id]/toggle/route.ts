export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { startStrategy, stopStrategy } from '@/lib/strategies/StrategyRunner';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json();

  try {
    if (action === 'start') await startStrategy(id);
    else if (action === 'stop') await stopStrategy(id);
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
