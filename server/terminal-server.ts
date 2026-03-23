import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import os from 'os';

const shell = process.env.SHELL ?? (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

export function createTerminalServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    // Spawn a PTY process
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME ?? process.cwd(),
      env: process.env as Record<string, string>,
    });

    // PTY → WebSocket
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

    // WebSocket → PTY
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
