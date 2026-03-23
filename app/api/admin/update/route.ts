import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const { stdout, stderr } = await execAsync('git pull', {
      cwd: process.cwd(),
      timeout: 30000,
    });

    const output = (stdout + stderr).trim();
    const alreadyUpToDate = output.includes('Already up to date');

    return NextResponse.json({
      success: true,
      output,
      alreadyUpToDate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
