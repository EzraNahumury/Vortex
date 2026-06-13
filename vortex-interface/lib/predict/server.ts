/**
 * Client for the public DeepBook Predict indexer
 * (https://predict-server.testnet.mystenlabs.com). Render-ready market, oracle, SVI, vault
 * and manager data. All calls are best-effort: on failure they return null / [] so the UI
 * degrades gracefully instead of throwing.
 */
import { predictConfig, fromPriceScaled } from "./config";

const BASE = predictConfig.serverBaseUrl;

export interface OracleEntry {
  predict_id: string;
  oracle_id: string;
  oracle_cap_id: string;
  underlying_asset: string;
  expiry: number;
  min_strike: number;
  tick_size: number;
  status: "active" | "settled" | string;
  activated_at: number | null;
  settlement_price: number | null;
  settled_at: number | null;
  created_checkpoint?: number;
}

export interface SVISnapshot {
  oracle_id: string;
  a: number;
  b: number;
  rho: number;
  m: number;
  sigma: number;
  timestamp: number;
}

export interface PriceSnapshot {
  oracle_id: string;
  spot: number;
  forward: number;
  timestamp: number;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchOracles(): Promise<OracleEntry[]> {
  // Documented route is predict-scoped; the bare /oracles also works on testnet.
  const scoped = await get<OracleEntry[]>(`/predicts/${predictConfig.predictObjectId}/oracles`);
  if (scoped && Array.isArray(scoped)) return scoped;
  const all = await get<OracleEntry[]>(`/oracles`);
  return all && Array.isArray(all) ? all : [];
}

export async function fetchActiveOracles(): Promise<OracleEntry[]> {
  const all = await fetchOracles();
  return all
    .filter((o) => o.status === "active")
    .sort((a, b) => a.expiry - b.expiry);
}

export async function fetchSviLatest(oracleId: string): Promise<SVISnapshot | null> {
  return get<SVISnapshot>(`/oracles/${oracleId}/svi/latest`);
}

export async function fetchPricesLatest(oracleId: string): Promise<PriceSnapshot | null> {
  return get<PriceSnapshot>(`/oracles/${oracleId}/prices/latest`);
}

export async function fetchOracleState(oracleId: string): Promise<Record<string, unknown> | null> {
  return get(`/oracles/${oracleId}/state`);
}

export interface VaultSummary {
  vault_balance: number;
  vault_value: number;
  total_mtm: number;
  total_max_payout: number;
  available_liquidity: number;
  available_withdrawal: number;
  plp_total_supply: number;
  plp_share_price: number;
  utilization: number;
  max_payout_utilization: number;
  net_deposits: number;
  total_supplied: number;
  total_withdrawn: number;
}

export interface PerfPoint {
  timestamp_ms: number;
  share_price: number;
  vault_value: number;
  total_shares: number;
}

export async function fetchVaultSummary(): Promise<VaultSummary | null> {
  return get<VaultSummary>(`/predicts/${predictConfig.predictObjectId}/vault/summary`);
}

export async function fetchVaultPerformance(range = "ALL"): Promise<PerfPoint[]> {
  const r = await get<PerfPoint[]>(`/predicts/${predictConfig.predictObjectId}/vault/performance?range=${range}`);
  return Array.isArray(r) ? r : [];
}

const MS_PER_YEAR = 31_536_000_000;

/** Annualize the realized PLP yield from the share-price time series. */
export function computePlpApy(perf: PerfPoint[]): number {
  if (perf.length < 2) return 0;
  const a = perf[0];
  const b = perf[perf.length - 1];
  const dt = b.timestamp_ms - a.timestamp_ms;
  if (dt <= 0 || a.share_price <= 0) return 0;
  const growth = b.share_price / a.share_price;
  const years = dt / MS_PER_YEAR;
  if (years <= 0) return 0;
  return Math.pow(growth, 1 / years) - 1;
}

export async function fetchManagerPositions(managerId: string): Promise<Record<string, unknown> | null> {
  return get(`/managers/${managerId}/positions/summary`);
}

export async function fetchStatus(): Promise<Record<string, unknown> | null> {
  return get(`/status`);
}

/** A single rung of the strike ladder around the at-the-money spot. */
export interface StrikeRung {
  strike: number;        // scaled (on-chain units)
  strikeUsd: number;     // human USD
  offsetPct: number;     // distance from spot, signed %
  isUp: boolean;         // suggested side for a crash hedge
}

/**
 * Build a strike ladder centered on spot from an oracle's grid. Returns `count` rungs each
 * side of ATM, snapped to the oracle tick size. Down-side rungs are flagged is_up=false
 * (the OTM puts a crash-hedge wants).
 */
export function buildStrikeLadder(
  oracle: OracleEntry,
  spotScaled: number,
  count = 6,
  stepTicks = 2,
): StrikeRung[] {
  const tick = oracle.tick_size;
  const step = tick * stepTicks;
  const atm = Math.round(spotScaled / tick) * tick;
  const rungs: StrikeRung[] = [];
  for (let i = -count; i <= count; i++) {
    const strike = atm + i * step;
    if (strike < oracle.min_strike) continue;
    rungs.push({
      strike,
      strikeUsd: fromPriceScaled(strike),
      offsetPct: spotScaled > 0 ? ((strike - spotScaled) / spotScaled) * 100 : 0,
      isUp: strike >= atm,
    });
  }
  return rungs;
}
