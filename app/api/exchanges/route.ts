export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET() {
  const exchanges = await prisma.exchangeConfig.findMany({
    select: { id: true, name: true, label: true, sandbox: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(exchanges);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, label, apiKey, apiSecret, sandbox } = body;
  if (!name || !label || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  try {
    const exchange = await prisma.exchangeConfig.create({
      data: { name, label, apiKey: encrypt(apiKey), apiSecret: encrypt(apiSecret), sandbox: sandbox ?? true },
    });
    return NextResponse.json(exchange, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
