"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { toast } from "sonner";
import { Activity, ShieldCheck, TrendingDown, Layers, Wallet, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectButton } from "@/components/shared/ConnectButton";

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

// Modeled hedge carry as a fraction of PLP yield (from SIMULATION.md: 20% -> 12.75% APY).
const HEDGE_CARRY = 0.36;

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
      setOracles(list);
      if (list.length > 0) setSelected(list[0]);
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
    return buildStrikeLadder(selected, prices.spot, 6, 2);
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
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[hsl(var(--primary))]" />
            <span className="text-lg font-semibold">Vortex</span>
            <span className="rounded-full bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              PLP + Hedge Vault
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              Lending
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {/* Hero */}
        <section>
          <h1 className="text-3xl font-semibold">DeepBook Predict — PLP + Hedge Vault</h1>
          <p className="mt-2 max-w-3xl text-[hsl(var(--muted-foreground))]">
            Deposit dUSDC and earn the Predict LP maker spread, with a small signed hedge sleeve
            that buys out-of-the-money BTC binaries to cap left-tail drawdown. Every allocation is
            authorized by an ed25519 strategist signature and verified on-chain — yield you can
            audit. Your position is a portable <span className="text-[hsl(var(--foreground))]">VAULT_SHARE</span> coin.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <a className="flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" href={explorerObj(predictConfig.vaultId)} target="_blank" rel="noreferrer">
              Vault <ExternalLink className="h-3 w-3" />
            </a>
            <a className="flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" href={explorerObj(predictConfig.predictObjectId)} target="_blank" rel="noreferrer">
              Predict <ExternalLink className="h-3 w-3" />
            </a>
            <a className="flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" href="https://tally.so/r/Xx102L" target="_blank" rel="noreferrer">
              Get testnet dUSDC <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>

        {/* Live yield band */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            icon={<Activity className="h-4 w-4 text-[hsl(var(--success))]" />}
            label="Live PLP APY (protocol)"
            value={`${(plpApy * 100).toFixed(2)}%`}
          />
          <Stat
            icon={<ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />}
            label="Net APY after hedge (est.)"
            value={`${(plpApy * (1 - HEDGE_CARRY) * 100).toFixed(2)}%`}
          />
          <Stat
            icon={<Layers className="h-4 w-4" />}
            label="PLP share price"
            value={summary ? summary.plp_share_price.toFixed(4) : "—"}
          />
          <Stat
            icon={<TrendingDown className="h-4 w-4" />}
            label="Vault utilization"
            value={summary ? `${(summary.utilization * 100).toFixed(2)}%` : "—"}
          />
        </section>
        <p className="-mt-3 text-xs text-[hsl(var(--muted-foreground))]">
          Live PLP APY is annualized from the protocol&apos;s on-chain share-price series. Net APY
          subtracts the modeled crash-hedge carry (~{(HEDGE_CARRY * 100).toFixed(0)}% of yield — see
          SIMULATION.md); the hedge roughly halves left-tail drawdown.
        </p>

        {/* Vault stat row */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={<Layers className="h-4 w-4" />} label="Idle dUSDC" value={vault ? vault.idle.toLocaleString() : "—"} />
          <Stat icon={<Activity className="h-4 w-4" />} label="PLP supplied (Σ)" value={vault ? vault.supplied.toLocaleString() : "—"} />
          <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Hedge spent (Σ)" value={vault ? vault.hedgeSpent.toLocaleString() : "—"} />
          <Stat icon={<Wallet className="h-4 w-4" />} label="Vault shares" value={vault ? vault.shares.toLocaleString() : "—"} />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Deposit / withdraw */}
          <Card className="bg-[hsl(var(--card))]">
            <CardHeader>
              <CardTitle>Your position</CardTitle>
              <CardDescription>
                {account ? (
                  <>dUSDC: {dusdcBalance.toLocaleString()} · shares: {shareBalance.toLocaleString()}</>
                ) : (
                  "Connect a wallet to deposit"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">Deposit dUSDC</label>
                <div className="flex gap-2">
                  <Input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="0.0" type="number" />
                  <Button onClick={handleDeposit} disabled={busy || !account}>
                    <ArrowDownToLine className="mr-1 h-4 w-4" /> Deposit
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">Withdraw (burn shares)</label>
                <div className="flex gap-2">
                  <Input value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} placeholder="0.0" type="number" />
                  <Button variant="outline" onClick={handleWithdraw} disabled={busy || !account}>
                    <ArrowUpFromLine className="mr-1 h-4 w-4" /> Withdraw
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Withdrawals are served from idle dUSDC. Deployed PLP/hedge capital is unwound by the
                keeper first. Shares are a transferable coin you can use elsewhere in Sui DeFi.
              </p>
            </CardContent>
          </Card>

          {/* SVI smile viewer */}
          <Card className="bg-[hsl(var(--card))] lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Live SVI vol surface — {selected?.underlying_asset ?? "BTC"}</CardTitle>
                  <CardDescription>
                    {prices ? (
                      <>spot ${fromPriceScaled(prices.spot).toLocaleString(undefined, { maximumFractionDigits: 0 })} · expiry in {minsToExpiry}m</>
                    ) : (
                      "loading oracle…"
                    )}
                  </CardDescription>
                </div>
                <select
                  className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs"
                  value={selected?.oracle_id ?? ""}
                  onChange={(e) => setSelected(oracles.find((o) => o.oracle_id === e.target.value) ?? null)}
                >
                  {oracles.map((o) => (
                    <option key={o.oracle_id} value={o.oracle_id}>
                      {o.underlying_asset} · {Math.max(0, Math.round((o.expiry - Date.now()) / 60000))}m
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {smile.length === 0 ? (
                <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  Waiting for SVI snapshot from the indexer…
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-end gap-1" style={{ height: 140 }}>
                    {smile.map((p, i) => {
                      const r = ladder[i];
                      const atm = r && Math.abs(r.offsetPct) < 0.5;
                      const hedge = r && r.offsetPct <= -4 && r.offsetPct > -7;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`$${p.strikeUsd.toFixed(0)} · IV ${(p.impliedVol * 100).toFixed(1)}%`}>
                          <div
                            className={`w-full rounded-t ${atm ? "bg-[hsl(var(--primary))]" : hedge ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--muted-foreground))]/40"}`}
                            style={{ height: `${(p.impliedVol / maxIv) * 120}px` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 text-[9px] text-[hsl(var(--muted-foreground))]">
                    {ladder.map((r, i) => (
                      <div key={i} className="flex-1 text-center">
                        {(r.strikeUsd / 1000).toFixed(0)}k
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-[hsl(var(--primary))]" /> ATM</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-[hsl(var(--success))]" /> hedge zone (−4…−7%)</span>
                    {svi && (
                      <span className="ml-auto">SVI a={(svi.a / predictConfig.floatScaling).toFixed(3)} b={(svi.b / predictConfig.floatScaling).toFixed(3)} ρ={(svi.rho / predictConfig.floatScaling).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Strike ladder + hedge */}
        <Card className="bg-[hsl(var(--card))]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Strike ladder & crash-hedge candidates
            </CardTitle>
            <CardDescription>
              The strategist signs a hedge leg buying deep-OTM down binaries; the vault verifies the
              signature and mints via its keeper-owned PredictManager. Supply, hedge and unwind legs
              are executed off-app by the strategist/keeper (<code>scripts/keeper.mts</code>), not
              from this page — deposits and withdrawals are the only user-driven actions here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="py-2">Strike</th>
                    <th>Offset</th>
                    <th>Side</th>
                    <th>IV</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map((r, i) => {
                    const atm = Math.abs(r.offsetPct) < 0.5;
                    const hedge = r.offsetPct <= -4 && r.offsetPct > -7;
                    const iv = smile[i]?.impliedVol ?? 0;
                    return (
                      <tr key={i} className="border-t border-[hsl(var(--border))]">
                        <td className="py-2">${r.strikeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className={r.offsetPct < 0 ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--success))]"}>
                          {r.offsetPct >= 0 ? "+" : ""}{r.offsetPct.toFixed(2)}%
                        </td>
                        <td>{r.isUp ? "UP" : "DOWN"}</td>
                        <td>{(iv * 100).toFixed(1)}%</td>
                        <td className="text-xs">
                          {atm ? <span className="text-[hsl(var(--primary))]">ATM</span> : hedge ? <span className="text-[hsl(var(--success))]">hedge</span> : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {ladder.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[hsl(var(--muted-foreground))]">
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-[hsl(var(--card))]">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
