"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { toast } from "sonner";
import { Activity, ShieldCheck, TrendingDown, Layers, Wallet, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppBackground, Navbar } from "@/components/shared";

import { predictConfig, SHARE_TYPE, fromQuoteBase, toQuoteBase, fromPriceScaled } from "@/lib/predict/config";
import {
  fetchActiveOracles,
  fetchSviLatest,
  fetchPricesLatest,
  fetchVaultSummary,
  fetchVaultPerformance,
  computePlpApy,
  buildStrikeLadder,
  type OracleEntry,
  type SVISnapshot,
  type PriceSnapshot,
  type VaultSummary,
} from "@/lib/predict/server";
import { computeSmile, type SmilePoint } from "@/lib/predict/svi";
import { buildVaultDepositTx, buildVaultWithdrawTx } from "@/lib/predict/transactions";

interface VaultState {
  idle: number;
  plp: number;
  shares: number;
  supplied: number;
  hedgeSpent: number;
}

function explorerTx(d: string) {
  return `https://suiscan.xyz/testnet/tx/${d}`;
}
function explorerObj(id: string) {
  return `https://suiscan.xyz/testnet/object/${id}`;
}

export default function PredictPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [vault, setVault] = useState<VaultState | null>(null);
  const [oracles, setOracles] = useState<OracleEntry[]>([]);
  const [selected, setSelected] = useState<OracleEntry | null>(null);
  const [svi, setSvi] = useState<SVISnapshot | null>(null);
  const [prices, setPrices] = useState<PriceSnapshot | null>(null);

  const [summary, setSummary] = useState<VaultSummary | null>(null);
  const [plpApy, setPlpApy] = useState(0);

  const [dusdcBalance, setDusdcBalance] = useState(0);
  const [shareBalance, setShareBalance] = useState(0);
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshVault = useCallback(async () => {
    try {
      const obj = await suiClient.getObject({ id: predictConfig.vaultId, options: { showContent: true } });
      const f = (obj.data?.content as { fields?: Record<string, string> })?.fields;
      if (f) {
        setVault({
          idle: fromQuoteBase(f.idle ?? "0"),
          plp: Number(f.plp ?? "0"),
          shares: fromQuoteBase(f.total_shares ?? "0"),
          supplied: fromQuoteBase(f.supplied ?? "0"),
          hedgeSpent: fromQuoteBase(f.hedge_budget_spent ?? "0"),
        });
      }
    } catch {
      /* ignore */
    }
  }, [suiClient]);

  const refreshBalances = useCallback(async () => {
    if (!account?.address) {
      setDusdcBalance(0);
      setShareBalance(0);
      return;
    }
    try {
      const [d, s] = await Promise.all([
        suiClient.getBalance({ owner: account.address, coinType: predictConfig.dusdcType }),
        suiClient.getBalance({ owner: account.address, coinType: SHARE_TYPE }),
      ]);
      setDusdcBalance(fromQuoteBase(d.totalBalance));
      setShareBalance(fromQuoteBase(s.totalBalance));
    } catch {
      /* ignore */
    }
  }, [account?.address, suiClient]);

  // Initial load: oracles + vault.
  useEffect(() => {
    fetchActiveOracles().then((list) => {
      const now = Date.now();
      // Soonest-expiring first so the dropdown is ordered sensibly.
      const sorted = [...list].sort((a, b) => Number(a.expiry) - Number(b.expiry));
      setOracles(sorted);
      // Default to the soonest oracle with a real live window (>=45m). The indexer still lists
      // settled-but-unswept oracles with a past/0m expiry; selecting one makes the SVI smile
      // degenerate (flat). Fall back to the furthest-out oracle if none qualify.
      const live = sorted.find((o) => Number(o.expiry) - now >= 45 * 60_000);
      setSelected(live ?? sorted[sorted.length - 1] ?? null);
    });
    fetchVaultSummary().then(setSummary);
    fetchVaultPerformance("ALL").then((p) => setPlpApy(computePlpApy(p)));
    refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Selected oracle: SVI + spot.
  useEffect(() => {
    if (!selected) return;
    fetchSviLatest(selected.oracle_id).then(setSvi);
    fetchPricesLatest(selected.oracle_id).then(setPrices);
  }, [selected]);

  const ladder = useMemo(() => {
    if (!selected || !prices) return [];
    // Space strikes ~2% of spot per rung. The tick is $1, so the old fixed 2-tick ($2) step
    // clustered every strike at spot and flattened the smile; this spreads a real ±~12% ladder.
    const stepTicks = Math.max(1, Math.round((prices.spot * 0.02) / selected.tick_size));
    return buildStrikeLadder(selected, prices.spot, 6, stepTicks);
  }, [selected, prices]);

  const smile: SmilePoint[] = useMemo(() => {
    if (!selected || !svi || !prices || ladder.length === 0) return [];
    return computeSmile(
      svi,
      prices.forward,
      ladder.map((r) => r.strike),
      selected.expiry,
      Date.now(),
    );
  }, [selected, svi, prices, ladder]);

  const maxIv = useMemo(() => Math.max(0.0001, ...smile.map((s) => s.impliedVol)), [smile]);

  const handleDeposit = async () => {
    if (!account?.address) return toast.error("Connect wallet");
    const amt = Number(depositAmt);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const coins = await suiClient.getCoins({ owner: account.address, coinType: predictConfig.dusdcType });
      if (coins.data.length === 0) {
        toast.error("No dUSDC. Request testnet dUSDC via the DeepBook Predict form.");
        return;
      }
      // Use the largest coin; split exact inside the tx.
      const top = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance))[0];
      const tx = buildVaultDepositTx(top.coinObjectId, toQuoteBase(amt));
      const res = await signAndExecute({ transaction: tx });
      toast.success(
        <span>
          Deposited {amt} dUSDC ·{" "}
          <a className="underline" href={explorerTx(res.digest)} target="_blank" rel="noreferrer">
            tx
          </a>
        </span>,
      );
      setDepositAmt("");
      setTimeout(() => {
        refreshVault();
        refreshBalances();
      }, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!account?.address) return toast.error("Connect wallet");
    const amt = Number(withdrawAmt);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const coins = await suiClient.getCoins({ owner: account.address, coinType: SHARE_TYPE });
      if (coins.data.length === 0) {
        toast.error("No vault shares to withdraw");
        return;
      }
      const top = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance))[0];
      const tx = buildVaultWithdrawTx(top.coinObjectId, toQuoteBase(amt));
      const res = await signAndExecute({ transaction: tx });
      toast.success(
        <span>
          Withdrew shares ·{" "}
          <a className="underline" href={explorerTx(res.digest)} target="_blank" rel="noreferrer">
            tx
          </a>
        </span>,
      );
      setWithdrawAmt("");
      setTimeout(() => {
        refreshVault();
        refreshBalances();
      }, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  };

  const minsToExpiry = selected ? Math.max(0, Math.round((selected.expiry - Date.now()) / 60000)) : 0;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <AppBackground />

      <Navbar />

      <main className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 pb-20 pt-24 sm:px-6">
        {/* Hero */}
        <section>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            <span className="text-[hsl(var(--muted-foreground))]">VERIFIABLE YIELD · DEEPBOOK PREDICT</span>
          </div>
          <h1 className="font-display text-[clamp(32px,5vw,52px)] font-bold leading-[1.02]">
            PLP + Hedge Vault,<br className="hidden sm:block" />{" "}
            <span className="text-[hsl(var(--primary))]">minus the crash.</span>
          </h1>
          <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Deposit dUSDC and earn the Predict LP maker spread, with a small signed hedge sleeve
            that buys out-of-the-money BTC binaries to cap left-tail drawdown. Every allocation is
            authorized by an ed25519 strategist signature and verified on-chain — yield you can
            audit. Your position is a portable <span className="text-[hsl(var(--foreground))]">VAULT_SHARE</span> coin.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <a className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3.5 py-1.5 text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary)/0.3)] hover:bg-white/[0.05] hover:text-[hsl(var(--foreground))]" href={explorerObj(predictConfig.vaultId)} target="_blank" rel="noreferrer">
              Vault <ExternalLink className="h-3 w-3" />
            </a>
            <a className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3.5 py-1.5 text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary)/0.3)] hover:bg-white/[0.05] hover:text-[hsl(var(--foreground))]" href={explorerObj(predictConfig.predictObjectId)} target="_blank" rel="noreferrer">
              Predict <ExternalLink className="h-3 w-3" />
            </a>
            <a className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-3.5 py-1.5 font-semibold text-[hsl(var(--primary-foreground))] transition hover:brightness-110" href="https://tally.so/r/Xx102L" target="_blank" rel="noreferrer">
              Get testnet dUSDC <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>

        {/* Live yield band */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            <span className="h-1 w-1 rounded-full bg-[hsl(var(--primary))]" />
            Live yield
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat
              icon={<Activity className="h-4 w-4 text-[hsl(var(--success))]" />}
              label="Live PLP APY (protocol)"
              value={`${(plpApy * 100).toFixed(2)}%`}
              accent="success"
            />
            <Stat
              icon={<Layers className="h-4 w-4" />}
              label="PLP share price"
              value={Number.isFinite(summary?.plp_share_price) ? summary!.plp_share_price.toFixed(4) : "—"}
            />
            <Stat
              icon={<TrendingDown className="h-4 w-4" />}
              label="Vault utilization"
              value={Number.isFinite(summary?.utilization) ? `${(summary!.utilization * 100).toFixed(2)}%` : "—"}
            />
          </div>
          <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            Live PLP APY is annualized from the protocol&apos;s on-chain share-price series. The signed
            hedge sleeve gives up a slice of this carry to roughly halve left-tail drawdown (see
            SIMULATION.md for the modeled trade-off).
          </p>
        </section>

        {/* Vault stat row */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            <span className="h-1 w-1 rounded-full bg-[hsl(var(--primary))]" />
            Vault composition
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={<Layers className="h-4 w-4" />} label="Idle dUSDC" value={vault ? vault.idle.toLocaleString() : "—"} />
            <Stat icon={<Activity className="h-4 w-4" />} label="PLP supplied (Σ)" value={vault ? vault.supplied.toLocaleString() : "—"} />
            <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Hedge spent (Σ)" value={vault ? vault.hedgeSpent.toLocaleString() : "—"} />
            <Stat icon={<Wallet className="h-4 w-4" />} label="Vault shares" value={vault ? vault.shares.toLocaleString() : "—"} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Deposit / withdraw */}
          <Card className="rounded-2xl border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl transition hover:border-[hsl(var(--primary)/0.3)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]">
                  <Wallet className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                </span>
                Your position
              </CardTitle>
              <CardDescription>
                {account ? (
                  <>dUSDC: <span className="text-[hsl(var(--foreground))]">{dusdcBalance.toLocaleString()}</span> · shares: <span className="text-[hsl(var(--foreground))]">{shareBalance.toLocaleString()}</span></>
                ) : (
                  "Connect a wallet to deposit"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Deposit dUSDC</label>
                <div className="flex gap-2">
                  <Input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="0.0" type="number" />
                  <Button onClick={handleDeposit} disabled={busy || !account}>
                    <ArrowDownToLine className="mr-1 h-4 w-4" /> Deposit
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Withdraw (burn shares)</label>
                <div className="flex gap-2">
                  <Input value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} placeholder="0.0" type="number" />
                  <Button variant="outline" onClick={handleWithdraw} disabled={busy || !account}>
                    <ArrowUpFromLine className="mr-1 h-4 w-4" /> Withdraw
                  </Button>
                </div>
              </div>
              <p className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                Withdrawals are served from idle dUSDC. Deployed PLP/hedge capital is unwound by the
                keeper first. Shares are a transferable coin you can use elsewhere in Sui DeFi.
              </p>
            </CardContent>
          </Card>

          {/* SVI smile viewer */}
          <Card className="rounded-2xl border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl transition hover:border-[hsl(var(--primary)/0.3)] lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]">
                      <Activity className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    </span>
                    Live SVI vol surface — {selected?.underlying_asset ?? "BTC"}
                  </CardTitle>
                  <CardDescription>
                    {prices && Number.isFinite(prices.spot) ? (
                      <>spot <span className="text-[hsl(var(--foreground))]">${fromPriceScaled(prices.spot).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> · expiry in {minsToExpiry}m</>
                    ) : (
                      "loading oracle…"
                    )}
                  </CardDescription>
                </div>
                <select
                  className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary)/0.3)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.4)]"
                  value={selected?.oracle_id ?? ""}
                  onChange={(e) => setSelected(oracles.find((o) => o.oracle_id === e.target.value) ?? null)}
                >
                  {oracles.map((o) => (
                    <option key={o.oracle_id} value={o.oracle_id} style={{ backgroundColor: "#0d1311", color: "#f4f7f5" }}>
                      {o.underlying_asset} · {Math.max(0, Math.round((o.expiry - Date.now()) / 60000))}m
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {smile.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[hsl(var(--border))] bg-white/[0.01] py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  <Activity className="h-5 w-5 text-[hsl(var(--muted-foreground))]/60" />
                  Waiting for SVI snapshot from the indexer…
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-end gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4" style={{ height: 168 }}>
                    {smile.map((p, i) => {
                      const r = ladder[i];
                      const atm = r && Math.abs(r.offsetPct) < 0.5;
                      const hedge = r && r.offsetPct <= -4 && r.offsetPct > -7;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`$${p.strikeUsd.toFixed(0)} · IV ${(p.impliedVol * 100).toFixed(1)}%`}>
                          <div
                            className={`w-full rounded-t-md transition-[height] duration-500 ${atm ? "bg-[hsl(var(--primary))] shadow-[0_0_18px_-2px_hsl(var(--primary)/0.6)]" : hedge ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--muted-foreground))]/30"}`}
                            style={{ height: `${(p.impliedVol / maxIv) * 120}px` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5 px-4 text-[9px] text-[hsl(var(--muted-foreground))]">
                    {ladder.map((r, i) => (
                      <div key={i} className="flex-1 text-center">
                        {(r.strikeUsd / 1000).toFixed(0)}k
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded bg-[hsl(var(--primary))]" /> ATM</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded bg-[hsl(var(--success))]" /> hedge zone (−4…−7%)</span>
                    {svi && (
                      <span className="ml-auto rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px]">SVI a={(svi.a / predictConfig.floatScaling).toFixed(3)} b={(svi.b / predictConfig.floatScaling).toFixed(3)} ρ={(svi.rho / predictConfig.floatScaling).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Strike ladder + hedge */}
        <Card className="rounded-2xl border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl transition hover:border-[hsl(var(--primary)/0.3)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]">
                <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              </span>
              Strike ladder &amp; crash-hedge candidates
            </CardTitle>
            <CardDescription>
              The strategist signs a hedge leg buying deep-OTM down binaries; the vault verifies the
              signature and mints via its keeper-owned PredictManager. Supply, hedge and unwind legs
              are executed off-app by the strategist/keeper (<code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--foreground))]">scripts/keeper.mts</code>), not
              from this page — deposits and withdrawals are the only user-driven actions here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-white/[0.02]">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  <tr className="border-b border-[hsl(var(--border))]">
                    <th className="px-4 py-3 font-medium">Strike</th>
                    <th className="px-4 py-3 font-medium">Offset</th>
                    <th className="px-4 py-3 font-medium">Side</th>
                    <th className="px-4 py-3 font-medium">IV</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map((r, i) => {
                    const atm = Math.abs(r.offsetPct) < 0.5;
                    const hedge = r.offsetPct <= -4 && r.offsetPct > -7;
                    const iv = smile[i]?.impliedVol ?? 0;
                    return (
                      <tr key={i} className="border-t border-[hsl(var(--border))] transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium tabular-nums">${r.strikeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className={`px-4 py-3 tabular-nums ${r.offsetPct < 0 ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--success))]"}`}>
                          {r.offsetPct >= 0 ? "+" : ""}{r.offsetPct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isUp ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" : "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]"}`}>
                            {r.isUp ? "UP" : "DOWN"}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{(iv * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-xs">
                          {atm ? <span className="rounded-full bg-[hsl(var(--primary)/0.12)] px-2 py-0.5 font-medium text-[hsl(var(--primary))]">ATM</span> : hedge ? <span className="rounded-full bg-[hsl(var(--success)/0.12)] px-2 py-0.5 font-medium text-[hsl(var(--success))]">hedge</span> : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {ladder.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">
                        No active oracle / spot price yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  featured = false,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  featured?: boolean;
  accent?: "success" | "primary";
}) {
  if (featured) {
    return (
      <Card className="rounded-2xl border-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[#9fe600] text-[hsl(var(--primary-foreground))] shadow-[0_24px_70px_-30px_hsl(var(--primary)/0.6)] transition hover:-translate-y-0.5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--primary-foreground))]/70">
            {icon}
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="rounded-2xl border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {icon}
          {label}
        </div>
        <div className={`mt-2 text-2xl font-bold ${accent === "success" ? "text-[hsl(var(--success))]" : accent === "primary" ? "text-[hsl(var(--primary))]" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
