export const dynamic = 'force-dynamic';
import { prisma as db } from '@/lib/db';
import { startStrategy } from '@/lib/strategies/StrategyRunner';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const strategy = await db.strategy.findUnique({ where: { id } });
  if (!strategy) return Response.json({ error: 'Not found' }, { status: 404 });
  if (strategy.status === 'running') {
    return Response.json({ error: 'Already running' }, { status: 409 });
  }

  try {
    await startStrategy(id);
    return Response.json({ status: 'running' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start';
    return Response.json({ error: message }, { status: 500 });
  }
}
