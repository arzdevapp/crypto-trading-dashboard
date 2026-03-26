// src/lib/strategies/helpers/feeModel.ts
/**
 * Simple fee and slippage adjustment.
 * `price` is the raw price before fees.
 * `feePct` and `slippagePct` are percentages (e.g., 0.08 for 0.08%).
 * `side` is either 'buy' or 'sell'.
 * For a buy, fees increase the effective cost, so we add the percentages.
 * For a sell, fees reduce the proceeds, so we subtract the percentages.
 */
export function applyFees(
  price: number,
  feePct: number = 0.08,
  slippagePct: number = 0.02,
  side: 'buy' | 'sell',
): number {
  const totalPct = feePct + slippagePct;
  if (side === 'buy') {
    return price * (1 + totalPct / 100);
  }
  // sell side
  return price * (1 - totalPct / 100);
}
