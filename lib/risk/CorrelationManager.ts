/**
 * Cross-strategy correlation tracking.
 *
 * Before entering a new position, checks whether other running strategies
 * already hold correlated assets.  If aggregate correlated exposure exceeds
 * a configurable threshold, the entry is blocked to prevent concentrated
 * directional risk across the portfolio.
 */

// ── Static Correlation Matrix ───────────────────────────────────────────────
// Symmetric lookup — only needs one side; getCorrelation() handles both
// directions.  Values are Pearson-ish approximations from historical daily
// returns (2023-2025).  Unknown pairs default to 0.
const MATRIX: Record<string, Record<string, number>> = {
  BTC:  { ETH: 0.85, SOL: 0.75, AVAX: 0.70, BNB: 0.65, DOGE: 0.60, XRP: 0.55, ADA: 0.60, DOT: 0.65, MATIC: 0.65, LINK: 0.65, NEAR: 0.65, ATOM: 0.55, LTC: 0.70, UNI: 0.60 },
  ETH:  { SOL: 0.80, AVAX: 0.75, BNB: 0.60, DOGE: 0.50, XRP: 0.50, ADA: 0.55, DOT: 0.60, MATIC: 0.70, LINK: 0.70, NEAR: 0.70, ATOM: 0.55, LTC: 0.60, UNI: 0.70 },
  SOL:  { AVAX: 0.70, NEAR: 0.65, MATIC: 0.60, DOT: 0.55, LINK: 0.55 },
  AVAX: { NEAR: 0.60, DOT: 0.55 },
};

/**
 * Return the correlation coefficient between the base assets of two symbols.
 * For the same base asset the result is 1.0; for unknown pairs it is 0.
 */
export function getCorrelation(symbolA: string, symbolB: string): number {
  const baseA = symbolA.split('/')[0];
  const baseB = symbolB.split('/')[0];
  if (baseA === baseB) return 1.0;

  return MATRIX[baseA]?.[baseB] ?? MATRIX[baseB]?.[baseA] ?? 0;
}

// ── Exposure computation ────────────────────────────────────────────────────

export interface CorrelatedPosition {
  strategyId: string;
  symbol: string;
  correlation: number;
  exposurePct: number;   // position value as % of portfolio, weighted by correlation
}

export interface CorrelatedExposure {
  /** Sum of correlation-weighted position % across all correlated runners. */
  totalCorrelatedPct: number;
  positions: CorrelatedPosition[];
}

interface RunnerLike {
  strategyId: string;
  strategy: {
    getConfig(): { symbol?: string } & Record<string, unknown>;
    getState?: () => Record<string, unknown>;
  };
}

/**
 * Walk every running strategy and compute the aggregate correlation-weighted
 * exposure relative to `targetSymbol`.
 *
 * @param targetSymbol  The symbol the new trade wants to enter (e.g. "BTC/USDT")
 * @param runners       The live runner map from StrategyRunner
 * @param portfolioValue Total portfolio value in quote currency
 */
export function computeCorrelatedExposure(
  targetSymbol: string,
  runners: Map<string, RunnerLike>,
  portfolioValue: number,
): CorrelatedExposure {
  const positions: CorrelatedPosition[] = [];
  let totalCorrelatedPct = 0;

  if (portfolioValue <= 0) return { totalCorrelatedPct: 0, positions };

  for (const [id, runner] of runners) {
    // Skip strategies that don't expose state (no position tracking)
    if (typeof runner.strategy.getState !== 'function') continue;
    const state = runner.strategy.getState() as Record<string, unknown>;

    const inPosition = state.inPosition === true;
    if (!inPosition) continue;

    const cfg = runner.strategy.getConfig();
    const runnerSymbol = (cfg.symbol as string) ?? '';
    if (!runnerSymbol) continue;

    const correlation = getCorrelation(targetSymbol, runnerSymbol);
    if (correlation <= 0) continue;

    // Estimate position value from whatever state fields are available
    const positionSize = (state.positionSize as number) ?? (state.quantity as number) ?? 0;
    const costBasis = (state.avgCostBasis as number) ?? (state.entryPrice as number) ?? 0;
    if (positionSize <= 0 || costBasis <= 0) continue;

    const positionValue = positionSize * costBasis;
    const exposurePct = (positionValue / portfolioValue) * 100 * correlation;

    positions.push({ strategyId: id, symbol: runnerSymbol, correlation, exposurePct });
    totalCorrelatedPct += exposurePct;
  }

  return { totalCorrelatedPct, positions };
}
