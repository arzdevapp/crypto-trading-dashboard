import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';

const shell = process.env.SHELL ?? (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

export function createTerminalServer(port: number) {
  let pty: typeof import('node-pty') | null = null;
  try {
    pty = require('node-pty');
  } catch {
    console.warn('Terminal server unavailable (node-pty not installed)');
    return null;
  }

  const ptyCopy = pty!;
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    const ptyProcess = ptyCopy.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME ?? process.cwd(),
      env: process.env as Record<string, string>,
    });

    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit' }));
        ws.close();
      }
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input') {
          ptyProcess.write(msg.data);
        } else if (msg.type === 'resize') {
          ptyProcess.resize(msg.cols, msg.rows);
        }
      } catch {
        // ignore bad JSON
      }
    });

    ws.on('close', () => {
      try { ptyProcess.kill(); } catch { /* already dead */ }
    });

    ws.on('error', () => {
      try { ptyProcess.kill(); } catch { /* already dead */ }
    });
  });

  console.log(`Terminal server running on port ${port}`);
  return wss;
}
