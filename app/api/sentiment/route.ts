export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchFearGreed } from '@/lib/sentiment/fearGreed';
import { fetchCryptoNews } from '@/lib/sentiment/cryptoNews';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeNews = url.searchParams.get('news') !== 'false';
  try {
    const [fearGreed, news] = await Promise.all([
      fetchFearGreed(),
      includeNews ? fetchCryptoNews(15) : Promise.resolve([]),
    ]);
    return NextResponse.json({ fearGreed, news });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
