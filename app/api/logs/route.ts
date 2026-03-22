export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const level = searchParams.get('level') ?? undefined;
  const source = searchParams.get('source') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
  const cursor = searchParams.get('cursor') ?? undefined;

  try {
    const logs = await prisma.systemLog.findMany({
      where: {
        ...(level && level !== 'all' ? { level } : {}),
        ...(source ? { source: { contains: source } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const nextCursor = logs.length === limit ? logs[logs.length - 1].id : null;
    return NextResponse.json({ logs, nextCursor });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const level = searchParams.get('level') ?? undefined;

  try {
    const result = await prisma.systemLog.deleteMany({
      where: level && level !== 'all' ? { level } : {},
    });
    return NextResponse.json({ deleted: result.count });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
