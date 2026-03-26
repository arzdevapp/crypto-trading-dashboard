export const dynamic = 'force-dynamic';
import { prisma as db } from '@/lib/db';
import { stopStrategy } from '@/lib/strategies/StrategyRunner';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const strategy = await db.strategy.findUnique({ where: { id } });
    if (!strategy) return Response.json({ error: 'Not found' }, { status: 404 });
    if (strategy.status !== 'running') {
      return Response.json({ error: 'Not running' }, { status: 409 });
    }

    await stopStrategy(id);
    return Response.json({ status: 'stopped' });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
