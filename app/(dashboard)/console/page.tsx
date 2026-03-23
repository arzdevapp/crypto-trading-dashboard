'use client';

import dynamic from 'next/dynamic';

const TerminalClient = dynamic(() => import('@/components/console/TerminalClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-black">
      <span className="text-green-400 font-mono text-sm animate-pulse">Initializing terminal…</span>
    </div>
  ),
});

export default function ConsolePage() {
  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-zinc-400 font-mono text-xs ml-2">Container Terminal</span>
      </div>
      <div className="flex-1 min-h-0">
        <TerminalClient />
      </div>
    </div>
  );
}
