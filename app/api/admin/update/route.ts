export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const APP_DIR   = process.env.APP_DIR ?? '/opt/crypto-trading-dashboard';
const LOG_FILE  = `${APP_DIR}/logs/deploy.log`;
const SCRIPT    = `${APP_DIR}/scripts/deploy.sh`;

// GET — return current version info + last deploy log lines
export async function GET() {
  let commit   = 'unknown';
  let branch   = 'unknown';
  let logLines: string[] = [];

  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: APP_DIR }).toString().trim();
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: APP_DIR }).toString().trim();
  } catch { /* git not available or not a repo */ }

  try {
    // Check if remote has newer commits
    execSync(`git fetch origin ${branch} --quiet`, { cwd: APP_DIR });
    const local  = execSync('git rev-parse HEAD',          { cwd: APP_DIR }).toString().trim();
    const remote = execSync(`git rev-parse origin/${branch}`, { cwd: APP_DIR }).toString().trim();
    const upToDate = local === remote;

    if (existsSync(LOG_FILE)) {
      const raw  = readFileSync(LOG_FILE, 'utf8');
      logLines   = raw.split('\n').filter(Boolean).slice(-40); // last 40 lines
    }

    return NextResponse.json({ commit, branch, upToDate, logLines });
  } catch (err) {
    return NextResponse.json({ commit, branch, upToDate: null, logLines, error: (err as Error).message });
  }
}

// POST — trigger the deploy script as a detached background process.
// Detached so the process survives when PM2 restarts Next.js mid-deploy.
export async function POST() {
  if (!existsSync(SCRIPT)) {
    return NextResponse.json(
      { error: `Deploy script not found at ${SCRIPT}. Run scripts/setup-proxmox.sh first.` },
      { status: 404 }
    );
  }

  const child = spawn('bash', [SCRIPT], {
    detached: true,
    stdio:    'ignore',
    cwd:      APP_DIR,
  });
  child.unref();

  return NextResponse.json({ started: true, message: 'Deploy started — check logs for progress.' });
}
