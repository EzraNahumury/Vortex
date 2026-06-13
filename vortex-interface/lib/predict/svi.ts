/**
 * SVI volatility-surface math for the live surface viewer.
 * Raw SVI total variance: w(k) = a + b * ( rho*(k - m) + sqrt((k - m)^2 + sigma^2) )
 * with k = log-moneyness ln(strike / forward). Implied vol = sqrt(w / T).
 */
import { predictConfig } from "./config";
import type { SVISnapshot } from "./server";

const SCALE = predictConfig.floatScaling;
const MS_PER_YEAR = 31_536_000_000;

export interface SmilePoint {
  strikeUsd: number;
  logMoneyness: number;
  totalVariance: number;
  impliedVol: number; // annualized, as a fraction (0.65 = 65%)
}

/** Descale a raw on-chain SVI field (1e9 fixed-point). */
function d(v: number): number {
  return v / SCALE;
}

export function computeSmile(
  svi: SVISnapshot,
  forwardScaled: number,
  strikesScaled: number[],
  expiryMs: number,
  nowMs: number,
): SmilePoint[] {
  const a = d(svi.a);
  const b = d(svi.b);
  const rho = d(svi.rho);
  const m = d(svi.m);
  const sigma = d(svi.sigma);
  const fwd = forwardScaled / SCALE;
  const T = Math.max((expiryMs - nowMs) / MS_PER_YEAR, 1 / MS_PER_YEAR);

  return strikesScaled
    .map((sScaled) => {
      const strikeUsd = sScaled / SCALE;
      if (strikeUsd <= 0 || fwd <= 0) return null;
      const k = Math.log(strikeUsd / fwd);
      const w = a + b * (rho * (k - m) + Math.sqrt((k - m) * (k - m) + sigma * sigma));
      const variance = Math.max(w, 0);
      const iv = Math.sqrt(variance / T);
      return {
        strikeUsd,
        logMoneyness: k,
        totalVariance: variance,
        impliedVol: Number.isFinite(iv) ? iv : 0,
      } as SmilePoint;
    })
    .filter((p): p is SmilePoint => p !== null);
}
