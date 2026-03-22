export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const strategies = await prisma.strategy.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(strategies);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, type, symbol, timeframe, config, exchangeId } = body;
    if (!name || !type || !symbol || !timeframe || !config || !exchangeId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const strategy = await prisma.strategy.create({
      data: { name, type, symbol, timeframe, config: JSON.stringify(config), exchangeId },
    });
    return NextResponse.json(strategy, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
