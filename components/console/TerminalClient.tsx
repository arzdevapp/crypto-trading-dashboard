'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

const TERMINAL_WS_URL =
  typeof window !== 'undefined'
    ? `ws://${window.location.hostname}:${process.env.NEXT_PUBLIC_TERMINAL_PORT ?? '8082'}`
    : '';

export default function TerminalClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const connect = useCallback(() => {
    setTimeout(() => setStatus('connecting'), 0);

    const term = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#e5e7eb',
        cursor: '#10b981',
        selectionBackground: '#374151',
        black: '#1f2937',
        brightBlack: '#374151',
        red: '#ef4444',
        brightRed: '#f87171',
        green: '#10b981',
        brightGreen: '#34d399',
        yellow: '#f59e0b',
        brightYellow: '#fbbf24',
        blue: '#3b82f6',
        brightBlue: '#60a5fa',
        magenta: '#8b5cf6',
        brightMagenta: '#a78bfa',
        cyan: '#06b6d4',
        brightCyan: '#22d3ee',
        white: '#d1d5db',
        brightWhite: '#f9fafb',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    termRef.current = term;
    fitRef.current = fit;

    if (containerRef.current) {
      term.open(containerRef.current);
      fit.fit();
    }

    const ws = new WebSocket(TERMINAL_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Send initial size
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') term.write(msg.data);
        else if (msg.type === 'exit') {
          term.writeln('\r\n\x1b[33m[session ended]\x1b[0m');
          setStatus('disconnected');
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[31m[disconnected]\x1b[0m');
    };

    ws.onerror = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[31m[connection error — is the server running?]\x1b[0m');
    };

    // Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const reconnect = () => {
    wsRef.current?.close();
    termRef.current?.dispose();
    connect();
  };

  return (
    <div className="relative h-full w-full bg-black">
      {/* Status bar */}
      <div className="absolute top-2 right-3 z-10 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${
          status === 'connected' ? 'bg-green-500' :
          status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
          'bg-red-500'
        }`} />
        <span className="text-zinc-500 font-mono text-xs">{status}</span>
        {status === 'disconnected' && (
          <button
            onClick={reconnect}
            className="text-zinc-400 hover:text-white font-mono text-xs border border-zinc-700 hover:border-zinc-500 px-2 py-0.5 rounded transition-colors"
          >
            reconnect
          </button>
        )}
      </div>

      {/* xterm container */}
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ padding: '8px' }}
      />
    </div>
  );
}
