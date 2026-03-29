import type { ExchangeAdapter } from './ExchangeAdapter';
import type { Order, PlaceOrderParams } from '@/types/order';

export interface SmartOrderConfig {
  /** How long to wait for the limit order to fill before falling back to market (ms). */
  limitTimeoutMs: number;
  /** Offset from best bid/ask in basis points (1 bp = 0.01%). 0 = at the quote. */
  limitPriceOffsetBps: number;
  /** How often to poll for fill status (ms). */
  pollIntervalMs: number;
  /** Master switch — when false, immediately places a market order. */
  enabled: boolean;
}

export interface SmartOrderResult {
  order: Order;
  executionType: 'limit' | 'market_fallback';
  fillTimeMs: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Attempt a limit order at best bid/ask, poll for fill, then fall back to a
 * market order if the limit is not filled within the configured timeout.
 *
 * This reduces slippage on every trade — especially important for altcoins
 * and larger order sizes where market orders chew through the book.
 *
 * Flow:
 * 1. Fetch ticker → compute limit price (best bid for buy, best ask for sell,
 *    adjusted by `limitPriceOffsetBps`).
 * 2. Place limit order.
 * 3. Poll `fetchOpenOrders` every `pollIntervalMs` to check if it filled.
 * 4. If filled → return the order.
 * 5. If timeout → cancel the limit order, place a market order as fallback.
 */
export async function executeSmartOrder(
  adapter: ExchangeAdapter,
  params: PlaceOrderParams,
  config: SmartOrderConfig,
  logger: (msg: string) => Promise<void>,
): Promise<SmartOrderResult> {
  const start = Date.now();

  // ── Compute limit price ────────────────────────────────────────────────
  const ticker = await adapter.fetchTicker(params.symbol);
  const offsetMul = config.limitPriceOffsetBps / 10_000; // bps → fraction

  let limitPrice: number;
  if (params.side === 'buy') {
    // Place slightly above best bid to increase fill probability
    limitPrice = ticker.bid * (1 + offsetMul);
    // But never exceed the ask (that would just be a market cross)
    if (limitPrice >= ticker.ask && ticker.ask > 0) {
      limitPrice = ticker.bid; // stay at bid
    }
  } else {
    // Place slightly below best ask
    limitPrice = ticker.ask * (1 - offsetMul);
    // But never go below the bid
    if (limitPrice <= ticker.bid && ticker.bid > 0) {
      limitPrice = ticker.ask; // stay at ask
    }
  }

  // Guard: if ticker returned 0s (exchange issue), fall through to market
  if (limitPrice <= 0) {
    await logger('Smart order: invalid ticker prices — falling back to market');
    const order = await adapter.placeOrder({ ...params, type: 'market' });
    return { order, executionType: 'market_fallback', fillTimeMs: Date.now() - start };
  }

  // ── Place limit order ──────────────────────────────────────────────────
  let limitOrder: Order;
  try {
    limitOrder = await adapter.placeOrder({
      ...params,
      type: 'limit',
      price: limitPrice,
    });
    await logger(`Limit order placed: ${params.side} ${params.amount} @ ${limitPrice.toFixed(8)} (id: ${limitOrder.id})`);
  } catch (err) {
    // Limit placement failed — fall through to market immediately
    const msg = err instanceof Error ? err.message : String(err);
    await logger(`Limit order failed (${msg}) — falling back to market`);
    const order = await adapter.placeOrder({ ...params, type: 'market' });
    return { order, executionType: 'market_fallback', fillTimeMs: Date.now() - start };
  }

  // ── Poll for fill ──────────────────────────────────────────────────────
  const deadline = start + config.limitTimeoutMs;

  while (Date.now() < deadline) {
    await sleep(config.pollIntervalMs);

    try {
      const openOrders = await adapter.fetchOpenOrders(params.symbol);
      const stillOpen = openOrders.some(o => o.id === limitOrder.id);

      if (!stillOpen) {
        // Order no longer open → filled (or cancelled externally, but we didn't cancel it)
        await logger(`Limit order filled in ${Date.now() - start}ms`);
        return { order: limitOrder, executionType: 'limit', fillTimeMs: Date.now() - start };
      }
    } catch {
      // Poll failed (network blip) — continue waiting rather than cancelling prematurely
    }
  }

  // ── Timeout: cancel limit, place market ────────────────────────────────
  let cancelledSuccessfully = false;
  try {
    await adapter.cancelOrder(limitOrder.id, params.symbol);
    cancelledSuccessfully = true;
    await logger(`Limit order timed out after ${config.limitTimeoutMs}ms — cancelled`);
  } catch {
    // Cancel may fail if the order filled in the instant between check and cancel.
    // Verify by checking open orders one more time.
    try {
      const openOrders = await adapter.fetchOpenOrders(params.symbol);
      const stillOpen = openOrders.some(o => o.id === limitOrder.id);
      if (!stillOpen) {
        // Filled between last poll and cancel attempt
        await logger('Limit order filled during cancel — no market fallback needed');
        return { order: limitOrder, executionType: 'limit', fillTimeMs: Date.now() - start };
      }
    } catch {
      // Can't determine state — proceed with market to ensure execution
    }
  }

  // Determine how much was filled before the cancel.
  // If cancel succeeded, the order is no longer in open orders, so we can't
  // check remaining via fetchOpenOrders — use the original amount minus any
  // partial fill reported at placement time.
  let remainingAmount = params.amount;
  if (cancelledSuccessfully) {
    // limitOrder.filled reflects the amount filled at placement time (usually 0
    // for a limit).  For a partial fill that happened during the poll window,
    // the exchange may have updated it — but we only have the initial snapshot.
    // Subtracting filled gives us a safe upper bound; sending a bit extra to
    // market is better than leaving unfilled quantity hanging.
    const alreadyFilled = limitOrder.filled ?? 0;
    remainingAmount = params.amount - alreadyFilled;
  } else {
    // Cancel failed — order might still be open.  Try to fetch remaining.
    try {
      const openOrders = await adapter.fetchOpenOrders(params.symbol);
      const leftover = openOrders.find(o => o.id === limitOrder.id);
      if (leftover) {
        remainingAmount = leftover.remaining;
        try { await adapter.cancelOrder(limitOrder.id, params.symbol); } catch { /* ignore */ }
      } else {
        // Not open anymore — must have filled
        await logger('Limit order filled after cancel race — no market fallback needed');
        return { order: limitOrder, executionType: 'limit', fillTimeMs: Date.now() - start };
      }
    } catch {
      // Can't check — send full amount to market as worst case
    }
  }

  // If everything was already filled (e.g. partial fill = full amount), skip market
  if (remainingAmount <= 0) {
    await logger('Limit order fully filled (partial fills covered full amount)');
    return { order: limitOrder, executionType: 'limit', fillTimeMs: Date.now() - start };
  }

  await logger(`Placing market fallback for ${remainingAmount} ${params.symbol}`);
  const marketOrder = await adapter.placeOrder({
    ...params,
    type: 'market',
    amount: remainingAmount,
  });

  return { order: marketOrder, executionType: 'market_fallback', fillTimeMs: Date.now() - start };
}
