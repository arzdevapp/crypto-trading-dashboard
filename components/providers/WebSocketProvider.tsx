'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { addMessageHandler, addConnectionHandler, sendMessage } from '@/lib/websocket/client';
import type { WsMessage } from '@/types/websocket';

interface WsContextValue {
  connected: boolean;
  subscribe: (channel: 'ticker' | 'orderbook', symbol: string, exchangeId: string) => void;
  unsubscribe: (channel: 'ticker' | 'orderbook', symbol: string) => void;
  lastMessage: WsMessage | null;
}

const WsContext = createContext<WsContextValue>({
  connected: false,
  subscribe: () => {},
  unsubscribe: () => {},
  lastMessage: null,
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);

  useEffect(() => {
    const unsubMsg = addMessageHandler((msg) => setLastMessage(msg));
    const unsubConn = addConnectionHandler((c) => setConnected(c));
    return () => {
      unsubMsg();
      unsubConn();
    };
  }, []);

  const subscribe = (channel: 'ticker' | 'orderbook', symbol: string, exchangeId: string) => {
    sendMessage({ type: 'subscribe', channel, symbol, exchangeId });
  };

  const unsubscribe = (channel: 'ticker' | 'orderbook', symbol: string) => {
    sendMessage({ type: 'unsubscribe', channel, symbol });
  };

  return (
    <WsContext.Provider value={{ connected, subscribe, unsubscribe, lastMessage }}>
      {children}
    </WsContext.Provider>
  );
}

export const useWebSocket = () => useContext(WsContext);
