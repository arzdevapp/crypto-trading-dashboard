'use client';
import { useEffect, useCallback } from 'react';
import { addMessageHandler, subscribe, unsubscribe } from '@/lib/websocket/client';
import type { WsMessage } from '@/types/websocket';

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  useEffect(() => {
    const remove = addMessageHandler(onMessage);
    return () => { remove(); };
  }, [onMessage]);
}

export function useTicker(symbol: string, exchangeId: string, onTick: (data: WsMessage & { type: 'ticker' }) => void) {
  const handler = useCallback((msg: WsMessage) => {
    if (msg.type === 'ticker' && msg.symbol === symbol) onTick(msg as WsMessage & { type: 'ticker' });
  }, [symbol, onTick]);

  useEffect(() => {
    if (!symbol) return;
    subscribe('ticker', symbol, exchangeId);
    const remove = addMessageHandler(handler);
    return () => { remove(); unsubscribe('ticker', symbol); };
  }, [symbol, exchangeId, handler]);
}

export function useOrderBook(symbol: string, exchangeId: string, onUpdate: (data: WsMessage & { type: 'orderbook' }) => void) {
  const handler = useCallback((msg: WsMessage) => {
    if (msg.type === 'orderbook' && msg.symbol === symbol) onUpdate(msg as WsMessage & { type: 'orderbook' });
  }, [symbol, onUpdate]);

  useEffect(() => {
    if (!symbol) return;
    subscribe('orderbook', symbol, exchangeId);
    const remove = addMessageHandler(handler);
    return () => { remove(); unsubscribe('orderbook', symbol); };
  }, [symbol, exchangeId, handler]);
}
