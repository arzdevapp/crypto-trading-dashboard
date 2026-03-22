import { prisma } from './db';

export type LogLevel = 'info' | 'warn' | 'error' | 'trade' | 'signal';

export async function log(
  level: LogLevel,
  source: string,
  message: string,
  meta?: Record<string, unknown>
) {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        source,
        message,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch {
    // Never throw — logging must not break callers
    console.error('[logger] failed to write log:', message);
  }
}
