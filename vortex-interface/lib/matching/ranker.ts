import type { Order } from "@/lib/types";

export interface MatchCandidate {
  lend: Order;
  borrow: Order;
  // Composite ranking score (higher is better). Pure deterministic, not the Nautilus fairness score.
  score: number;
  breakdown: {
    rateGap: number;       // 0..1 — how much wiggle room between borrow and lend rate
    durationFit: number;   // 0..1 — 1.0 means lender duration ≈ borrower duration
    sizeFit: number;       // 0..1 — 1.0 means amounts identical
    age: number;           // 0..1 — older orders prioritised (price-time priority)
  };
  // Why a pair is rejected, if any. When set, this candidate must NOT be executed.
  rejection?: string;
}

export interface RankerOptions {
  // Maximum allowed |lend.amount - borrow.amount| / max(amount) for a pair to be eligible.
  // On-chain currently requires strict equality, so default keeps it tight but lets us
  // surface near-misses to users with a clear error.
  amountTolerance?: number;
  // Reference timestamp used when computing the age signal. Defaults to Date.now() — pass a
  // fixed value for deterministic tests.
  now?: number;
  // Maximum age in ms used to normalise the age signal. Older orders saturate at 1.0.
  maxAgeMs?: number;
}

const DEFAULT_AMOUNT_TOLERANCE = 0.005; // 0.5%
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Score a single (lend, borrow) pair. Returns a rejection reason instead of a score when
 * the pair can never match under the protocol rules (rate, duration, asset).
 */
export function scorePair(
  lend: Order,
  borrow: Order,
  opts: RankerOptions = {},
): MatchCandidate {
  const tolerance = opts.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const maxAge = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const now = opts.now ?? Date.now();

  const empty = {
    lend,
    borrow,
    score: 0,
    breakdown: { rateGap: 0, durationFit: 0, sizeFit: 0, age: 0 },
  };

  if (lend.type !== "lend" || borrow.type !== "borrow") {
    return { ...empty, rejection: "side mismatch" };
  }
  if (lend.asset !== borrow.asset) {
    return { ...empty, rejection: "asset mismatch" };
  }
  // Optional collateral asset filter — only enforce when both sides specify.
  if (lend.collateralAsset && borrow.collateralAsset && lend.collateralAsset !== borrow.collateralAsset) {
    return { ...empty, rejection: "collateral mismatch" };
  }
  if (borrow.interestRate < lend.interestRate) {
    return { ...empty, rejection: "rate gap negative" };
  }
  if (lend.term < borrow.term) {
    return { ...empty, rejection: "lender term too short" };
  }

  const maxAmount = Math.max(lend.amount, borrow.amount);
  const amountDelta = Math.abs(lend.amount - borrow.amount);
  const relativeDelta = maxAmount > 0 ? amountDelta / maxAmount : 1;
  if (relativeDelta > tolerance) {
    return { ...empty, rejection: `amount delta ${(relativeDelta * 100).toFixed(2)}% > tolerance` };
  }

  // Components — all in [0,1].
  // 1. Rate gap: more spread = better economic surplus, but cap at 5% absolute.
  const rateGap = Math.min(1, Math.max(0, (borrow.interestRate - lend.interestRate) / 5));

  // 2. Duration fit: 1 when terms equal, decays linearly toward 0 at 2x.
  const termDiff = Math.abs(lend.term - borrow.term);
  const longest = Math.max(lend.term, borrow.term, 1);
  const durationFit = Math.max(0, 1 - termDiff / longest);

  // 3. Size fit: 1 when identical, scaled by tolerance window.
  const sizeFit = tolerance > 0 ? Math.max(0, 1 - relativeDelta / tolerance) : 1;

  // 4. Age (price-time priority): orders sitting longer get nudged forward.
  const lendAge = now - Date.parse(lend.createdAt || new Date(0).toISOString());
  const borrowAge = now - Date.parse(borrow.createdAt || new Date(0).toISOString());
  const oldestAge = Math.max(lendAge, borrowAge, 0);
  const age = Math.min(1, oldestAge / maxAge);

  // Weighted composite. Sum of weights = 1.
  // Size fit dominates because on-chain demands equality; if we soften that, this can shift.
  const score =
    sizeFit * 0.45 +
    durationFit * 0.25 +
    rateGap * 0.20 +
    age * 0.10;

  return {
    lend,
    borrow,
    score,
    breakdown: { rateGap, durationFit, sizeFit, age },
  };
}

/**
 * Rank all viable (lend, borrow) combinations from the open order book.
 *
 * Returned list is sorted by composite score descending. Candidates with rejections are
 * dropped — callers should pick the best entry and pass it to the executor.
 */
export function rankCandidates(
  orders: Order[],
  opts: RankerOptions = {},
): MatchCandidate[] {
  const lends = orders.filter((o) => o.type === "lend" && o.status === "pending");
  const borrows = orders.filter((o) => o.type === "borrow" && o.status === "pending");

  const out: MatchCandidate[] = [];
  for (const lend of lends) {
    for (const borrow of borrows) {
      const candidate = scorePair(lend, borrow, opts);
      if (!candidate.rejection) out.push(candidate);
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * Pick the top-ranked match and report near-miss diagnostics for UI hints when nothing
 * qualifies. The diagnostics surface the most common rejection reason to help users adjust
 * their order.
 */
export function pickBestMatch(
  orders: Order[],
  opts: RankerOptions = {},
): { match: MatchCandidate | null; nearMissReason?: string; consideredPairs: number } {
  const lends = orders.filter((o) => o.type === "lend" && o.status === "pending");
  const borrows = orders.filter((o) => o.type === "borrow" && o.status === "pending");

  let consideredPairs = 0;
  let best: MatchCandidate | null = null;
  const rejectionTally = new Map<string, number>();

  for (const lend of lends) {
    for (const borrow of borrows) {
      consideredPairs++;
      const c = scorePair(lend, borrow, opts);
      if (c.rejection) {
        rejectionTally.set(c.rejection, (rejectionTally.get(c.rejection) ?? 0) + 1);
        continue;
      }
      if (!best || c.score > best.score) best = c;
    }
  }

  if (best) return { match: best, consideredPairs };

  let nearMissReason: string | undefined;
  let max = 0;
  rejectionTally.forEach((count, reason) => {
    if (count > max) {
      max = count;
      nearMissReason = reason;
    }
  });
  return { match: null, nearMissReason, consideredPairs };
}
