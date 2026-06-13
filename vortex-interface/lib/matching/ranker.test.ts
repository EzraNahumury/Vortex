import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/types";
import { pickBestMatch, rankCandidates, scorePair } from "./ranker";

const NOW = Date.parse("2026-05-05T12:00:00.000Z");

function makeOrder(partial: Partial<Order> & { id: string; type: Order["type"] }): Order {
  return {
    id: partial.id,
    creator: partial.creator ?? "0xcreator",
    type: partial.type,
    asset: partial.asset ?? "USDC",
    collateralAsset: partial.collateralAsset,
    amount: partial.amount ?? 1000,
    interestRate: partial.interestRate ?? 5,
    ltv: partial.ltv ?? 0.7,
    term: partial.term ?? 30,
    status: partial.status ?? "pending",
    createdAt: partial.createdAt ?? new Date(NOW - 60_000).toISOString(),
    isHidden: partial.isHidden ?? false,
    fairnessScore: partial.fairnessScore,
  };
}

describe("scorePair", () => {
  it("rejects when borrow rate below lend rate", () => {
    const lend = makeOrder({ id: "L", type: "lend", interestRate: 6 });
    const borrow = makeOrder({ id: "B", type: "borrow", interestRate: 5 });
    expect(scorePair(lend, borrow).rejection).toBe("rate gap negative");
  });

  it("rejects asset mismatch", () => {
    const lend = makeOrder({ id: "L", type: "lend", asset: "USDC" });
    const borrow = makeOrder({ id: "B", type: "borrow", asset: "ETH" });
    expect(scorePair(lend, borrow).rejection).toBe("asset mismatch");
  });

  it("rejects when lender term shorter than borrower term", () => {
    const lend = makeOrder({ id: "L", type: "lend", term: 7 });
    const borrow = makeOrder({ id: "B", type: "borrow", term: 30 });
    expect(scorePair(lend, borrow).rejection).toBe("lender term too short");
  });

  it("rejects amount delta beyond tolerance", () => {
    const lend = makeOrder({ id: "L", type: "lend", amount: 1000 });
    const borrow = makeOrder({ id: "B", type: "borrow", amount: 1500 });
    const candidate = scorePair(lend, borrow, { amountTolerance: 0.005 });
    expect(candidate.rejection).toMatch(/amount delta/);
  });

  it("scores well when amounts match exactly", () => {
    const lend = makeOrder({ id: "L", type: "lend", amount: 1000, interestRate: 4 });
    const borrow = makeOrder({ id: "B", type: "borrow", amount: 1000, interestRate: 6 });
    const candidate = scorePair(lend, borrow, { now: NOW });
    expect(candidate.rejection).toBeUndefined();
    expect(candidate.breakdown.sizeFit).toBeCloseTo(1, 5);
    expect(candidate.breakdown.rateGap).toBeGreaterThan(0);
    expect(candidate.score).toBeGreaterThan(0.5);
  });

  it("respects collateral asset filter when both sides specify", () => {
    const lend = makeOrder({ id: "L", type: "lend", collateralAsset: "SUI" });
    const borrow = makeOrder({ id: "B", type: "borrow", collateralAsset: "ETH" });
    expect(scorePair(lend, borrow).rejection).toBe("collateral mismatch");
  });
});

describe("pickBestMatch", () => {
  it("returns null with diagnostic when no candidates qualify", () => {
    const orders: Order[] = [
      makeOrder({ id: "L1", type: "lend", interestRate: 8 }),
      makeOrder({ id: "B1", type: "borrow", interestRate: 5 }),
    ];
    const result = pickBestMatch(orders);
    expect(result.match).toBeNull();
    expect(result.nearMissReason).toBe("rate gap negative");
    expect(result.consideredPairs).toBe(1);
  });

  it("picks highest-scoring candidate, not the first encountered", () => {
    const orders: Order[] = [
      // First-encountered pair has weaker rate spread.
      makeOrder({ id: "L1", type: "lend", interestRate: 5, term: 30 }),
      makeOrder({ id: "B1", type: "borrow", interestRate: 5.1, term: 30 }),
      // Better rate spread, identical amounts.
      makeOrder({ id: "L2", type: "lend", interestRate: 4, term: 30 }),
      makeOrder({ id: "B2", type: "borrow", interestRate: 7, term: 30 }),
    ];
    const result = pickBestMatch(orders);
    expect(result.match).not.toBeNull();
    expect(result.match!.lend.id).toBe("L2");
    expect(result.match!.borrow.id).toBe("B2");
  });

  it("handles 1 lender many borrowers — best borrower wins", () => {
    const orders: Order[] = [
      makeOrder({ id: "L", type: "lend", amount: 1000, interestRate: 4, term: 60 }),
      makeOrder({ id: "B-far", type: "borrow", amount: 800, interestRate: 5, term: 60 }), // amount too off
      makeOrder({ id: "B-mid", type: "borrow", amount: 1005, interestRate: 4.5, term: 60 }),
      makeOrder({ id: "B-best", type: "borrow", amount: 1000, interestRate: 8, term: 60 }),
    ];
    const result = pickBestMatch(orders, { amountTolerance: 0.01 });
    expect(result.match?.borrow.id).toBe("B-best");
  });

  it("breaks ties by score deterministically across runs", () => {
    const orders: Order[] = [
      makeOrder({ id: "L", type: "lend", amount: 1000, interestRate: 5 }),
      makeOrder({ id: "B1", type: "borrow", amount: 1000, interestRate: 6 }),
      makeOrder({ id: "B2", type: "borrow", amount: 1000, interestRate: 6 }),
    ];
    const r1 = pickBestMatch(orders, { now: NOW });
    const r2 = pickBestMatch(orders, { now: NOW });
    expect(r1.match?.borrow.id).toBe(r2.match?.borrow.id);
  });
});

describe("rankCandidates 100-order simulation", () => {
  // Deterministic xorshift RNG so the simulation is repeatable.
  function rng(seed: number) {
    let state = seed >>> 0;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 1_000_000) / 1_000_000;
    };
  }

  it("returns a non-empty ranked list and the top entry beats the median", () => {
    const next = rng(42);
    const orders: Order[] = [];
    for (let i = 0; i < 100; i++) {
      const isLend = next() < 0.5;
      const baseAmount = 500 + Math.floor(next() * 2000);
      orders.push(
        makeOrder({
          id: `${isLend ? "L" : "B"}${i}`,
          type: isLend ? "lend" : "borrow",
          amount: baseAmount,
          interestRate: 3 + next() * 6,
          term: 7 + Math.floor(next() * 60),
          createdAt: new Date(NOW - Math.floor(next() * 3_600_000)).toISOString(),
        }),
      );
    }
    const ranked = rankCandidates(orders, { amountTolerance: 0.05, now: NOW });
    expect(ranked.length).toBeGreaterThan(0);
    const top = ranked[0];
    const median = ranked[Math.floor(ranked.length / 2)];
    expect(top.score).toBeGreaterThanOrEqual(median.score);
    // Top match must satisfy the protocol's hard preconditions.
    expect(top.borrow.interestRate).toBeGreaterThanOrEqual(top.lend.interestRate);
    expect(top.lend.term).toBeGreaterThanOrEqual(top.borrow.term);
  });
});
