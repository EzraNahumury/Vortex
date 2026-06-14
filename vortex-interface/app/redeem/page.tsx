"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { toast } from "sonner";
import { Navbar, AppBackground } from "@/components/shared";
import { predictConfig, fromQuoteBase, fromPriceScaled } from "@/lib/predict/config";
import { fetchManagerPositions } from "@/lib/predict/server";
import { buildRedeemHedgeTx } from "@/lib/predict/transactions";
import { ShieldCheck, RefreshCw, ExternalLink, Lock, TrendingDown } from "lucide-react";

interface PositionSummary {
  oracle_id: string;
  underlying_asset?: string;
  expiry: number;
  strike: number;
  is_up: boolean;
  minted_quantity: number;
  redeemed_quantity: number;
  open_quantity: number;
  total_payout?: number;
  status?: string;
}

export default function RedeemPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [keeper, setKeeper] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [raw, vaultObj] = await Promise.all([
        fetchManagerPositions(predictConfig.managerId),
        suiClient.getObject({ id: predictConfig.vaultId, options: { showContent: true } }),
      ]);
      const list = (Array.isArray(raw) ? raw : []) as unknown as PositionSummary[];
      setPositions(list);
      const f = (vaultObj.data?.content as { fields?: Record<string, string> })?.fields;
      setKeeper(f?.keeper ?? null);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    load();
  }, [load]);

  const isKeeper = !!account?.address && !!keeper && account.address === keeper;

  const handleRedeem = async (p: PositionSummary) => {
    if (!account?.address) return toast.error("Connect wallet");
    if (!isKeeper) return toast.error("Redeem is keeper-gated — connect the vault keeper wallet");
    setBusy(p.oracle_id + p.strike);
    try {
      const tx = buildRedeemHedgeTx({
        oracleId: p.oracle_id,
        expiry: BigInt(p.expiry),
        strike: BigInt(p.strike),
        isUp: p.is_up,
        quantity: BigInt(p.open_quantity),
      });
      const res = await signAndExecute({ transaction: tx });
      toast.success(
        <span>
          Redeemed ·{" "}
          <a className="underline" href={`https://suiscan.xyz/testnet/tx/${res.digest}`} target="_blank" rel="noreferrer">tx</a>
        </span>,
      );
      setTimeout(load, 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Redeem failed");
    } finally {
      setBusy(null);
    }
  };

  const open = positions.filter((p) => Number(p.open_quantity) > 0);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] font-display">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 mx-auto max-w-4xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
              <span className="text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Settle hedges · on-chain</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight text-[hsl(var(--foreground))] sm:text-5xl">
              Redeem <span className="text-[hsl(var(--primary))]">hedges.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
              Open hedge positions held by the vault. Once an oracle settles, redeem sweeps the payout
              back into the vault. Redeem is keeper-gated (the vault keeper signs it).
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-4 py-2 text-sm text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary)/0.4)] hover:bg-white/[0.05]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {!isKeeper && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[hsl(var(--warning))]/25 bg-[hsl(var(--warning))]/10 px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
            <p className="text-xs text-[hsl(var(--warning))]">
              Redeem is keeper-gated. Connect the vault keeper wallet to redeem, or run{" "}
              <code className="rounded bg-black/30 px-1">scripts/keeper.mts redeem</code>.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-16 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
              <span className="animate-pulse">Loading hedge positions…</span>
            </div>
          </div>
        ) : open.length === 0 ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-12 text-center backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)]">
              <ShieldCheck className="h-6 w-6 text-[hsl(var(--primary))]" />
            </div>
            <p className="mb-2 text-lg font-semibold text-[hsl(var(--foreground))]">No open hedges</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">All hedge positions are settled and redeemed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {open.map((p) => {
              const settled = Date.now() > Number(p.expiry);
              const mins = Math.max(0, Math.round((Number(p.expiry) - Date.now()) / 60000));
              const id = p.oracle_id + p.strike;
              return (
                <div key={id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-5 backdrop-blur-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/12">
                        <TrendingDown className="h-5 w-5 text-[hsl(var(--primary))]" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                          {p.underlying_asset ?? "BTC"} {p.is_up ? "UP" : "DOWN"} @ ${fromPriceScaled(String(p.strike)).toFixed(0)}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          qty {fromQuoteBase(String(p.open_quantity)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ·{" "}
                          <a className="font-mono text-[hsl(var(--primary))] hover:underline" href={`https://suiscan.xyz/testnet/object/${p.oracle_id}`} target="_blank" rel="noreferrer">
                            oracle <ExternalLink className="inline h-3 w-3" />
                          </a>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${settled ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"}`}>
                        {settled ? "Settled · ready" : `Settles in ${mins}m`}
                      </span>
                      <button
                        onClick={() => handleRedeem(p)}
                        disabled={!settled || !isKeeper || busy === id}
                        className="inline-flex items-center rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy === id ? "Redeeming…" : "Redeem"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
