export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getNewsSentiment } from '@/lib/news/NewsSentimentScorer';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  try {
    const sentiment = await getNewsSentiment(symbol);
    return NextResponse.json(sentiment);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
