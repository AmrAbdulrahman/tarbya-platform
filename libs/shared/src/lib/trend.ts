/** BR-TRK-5: every trackable shows whether it is improving, getting worse or holding steady. */
export type Trend = 'IMPROVING' | 'STEADY' | 'WORSE' | 'NEW';

export interface TrendOptions {
  /** Values in each half of the comparison (setting trackables.trendWindow). */
  window: number;
  /** A change smaller than this share of the scale counts as steady (trackables.trendSteadyBand). */
  steadyBand: number;
  higherIsBetter: boolean;
  /** The target, which sets the scale. */
  target: number;
}

export interface TrendResult {
  trend: Trend;
  /** Average of the recent readings minus the average of the ones before; 0 when NEW. */
  change: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Compares the average of the latest readings with the same number before them
 * (up to `window` each). Fewer than two readings is NEW: nothing to compare yet.
 * Values are in the order they were recorded.
 */
export function trend(values: number[], options: TrendOptions): TrendResult {
  const k = Math.min(options.window, Math.floor(values.length / 2));
  if (k < 1) return { trend: 'NEW', change: 0 };
  const recent = mean(values.slice(-k));
  const before = mean(values.slice(-2 * k, -k));
  const change = recent - before;
  const scale = Math.max(Math.abs(options.target), Math.abs(before), 1);
  if (Math.abs(change) / scale <= options.steadyBand)
    return { trend: 'STEADY', change };
  const better = options.higherIsBetter ? change > 0 : change < 0;
  return { trend: better ? 'IMPROVING' : 'WORSE', change };
}
