'use client';
import { useEffect, useCallback } from 'react';
import { addMessageHandler, subscribe, unsubscribe, subscribeCandle, unsubscribeCandle } from '@/lib/websocket/client';
import type { WsMessage, LiveCandle } from '@/types/websocket';

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

export function useLiveCandle(
  symbol: string,
  timeframe: string,
  exchangeId: string,
  onCandle: (candle: LiveCandle) => void,
) {
  const handler = useCallback((msg: WsMessage) => {
    if (msg.type === 'candle' && msg.symbol === symbol && msg.timeframe === timeframe) {
      onCandle(msg.candle);
    }
  }, [symbol, timeframe, onCandle]);

  useEffect(() => {
    if (!symbol || !timeframe || !exchangeId) return;
    subscribeCandle(symbol, timeframe, exchangeId);
    const remove = addMessageHandler(handler);
    return () => { remove(); unsubscribeCandle(symbol, timeframe); };
  }, [symbol, timeframe, exchangeId, handler]);
}
