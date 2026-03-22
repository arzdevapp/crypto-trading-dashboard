export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchTrendingCoins } from '@/lib/market/trendingCoins';

export async function GET() {
  try {
    const coins = await fetchTrendingCoins();
    return NextResponse.json(coins);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
