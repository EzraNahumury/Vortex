"use client";

import { useCallback, useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { Navbar, AppBackground } from "@/components/shared";
import { predictConfig, fromQuoteBase, fromPriceScaled } from "@/lib/predict/config";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity as ActivityIcon,
  ShieldCheck,
  TrendingDown,
  RotateCcw,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface VaultEvent {
  kind: string;
  digest: string;
  timestampMs: number | null;
  sender: string;
  fields: Record<string, unknown>;
}

const SHORT = (s: string) => (s && s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);

function relTime(ms: number | null): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function describe(e: VaultEvent): { label: string; detail: string; icon: React.ReactNode; tint: string } {
  const f = e.fields;
  const q = (k: string) => fromQuoteBase(String(f[k] ?? "0")).toLocaleString(undefined, { maximumFractionDigits: 2 });
  switch (e.kind) {
    case "Deposited":
      return { label: "Deposit", detail: `${q("amount")} dUSDC → ${q("shares_minted")} VAULT_SHARE`, icon: <ArrowDownToLine className="h-4 w-4 text-[hsl(var(--success))]" />, tint: "bg-[hsl(var(--success))]/15" };
    case "Withdrawn":
      return { label: "Withdraw", detail: `${q("shares_burned")} shares → ${q("amount")} dUSDC`, icon: <ArrowUpFromLine className="h-4 w-4 text-[hsl(var(--warning))]" />, tint: "bg-[hsl(var(--warning))]/15" };
    case "SupplyLegExecuted":
      return { label: "Supply → PLP", detail: `${q("amount")} dUSDC supplied to the Predict pool`, icon: <ActivityIcon className="h-4 w-4 text-[hsl(var(--primary))]" />, tint: "bg-[hsl(var(--primary))]/15" };
    case "HedgeLegExecuted":
      return { label: "Hedge minted", detail: `OTM ${f["is_up"] ? "up" : "down"} binary @ $${fromPriceScaled(String(f["strike"] ?? "0")).toFixed(0)} · budget ${q("budget")} dUSDC`, icon: <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />, tint: "bg-[hsl(var(--primary))]/15" };
    case "WithdrawPlpLegExecuted":
      return { label: "Unwind PLP", detail: `→ ${q("quote_received")} dUSDC returned to idle`, icon: <RotateCcw className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />, tint: "bg-white/[0.05]" };
    case "HedgeRedeemed":
      return { label: "Hedge redeemed", detail: `payout ${q("returned_to_vault")} dUSDC → vault`, icon: <TrendingDown className="h-4 w-4 text-[hsl(var(--success))]" />, tint: "bg-[hsl(var(--success))]/15" };
    case "VaultCreated":
      return { label: "Vault created", detail: "PredictVault initialized", icon: <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />, tint: "bg-[hsl(var(--primary))]/15" };
    default:
      return { label: e.kind, detail: "", icon: <ActivityIcon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />, tint: "bg-white/[0.05]" };
  }
}

const FILTERS: { key: string; label: string; kind: string | null }[] = [
  { key: "all", label: "All", kind: null },
  { key: "deposit", label: "Deposit", kind: "Deposited" },
  { key: "withdraw", label: "Withdraw", kind: "Withdrawn" },
  { key: "supply", label: "Supply", kind: "SupplyLegExecuted" },
  { key: "hedge", label: "Hedge", kind: "HedgeLegExecuted" },
  { key: "unwind", label: "Unwind", kind: "WithdrawPlpLegExecuted" },
  { key: "redeem", label: "Redeem", kind: "HedgeRedeemed" },
];

export default function ActivityPage() {
  const suiClient = useSuiClient();
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await suiClient.queryEvents({
        query: { MoveModule: { package: predictConfig.vaultPackageId, module: "vault" } },
        order: "descending",
        limit: 50,
      });
      // Keep only our vault's own events (the same tx also emits DeepBook Predict
      // protocol events like Supplied / PositionMinted / BalanceEvent — filter those out).
      const prefix = `${predictConfig.vaultPackageId}::vault::`;
      const mapped: VaultEvent[] = (res.data ?? [])
        .filter((e) => (e.type || "").startsWith(prefix))
        .map((e) => ({
          kind: (e.type || "").split("::").pop() || "Event",
          digest: e.id.txDigest,
          timestampMs: e.timestampMs ? Number(e.timestampMs) : null,
          sender: e.sender || "",
          fields: (e.parsedJson as Record<string, unknown>) ?? {},
        }));
      setEvents(mapped);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    load();
  }, [load]);

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const shown = activeFilter?.kind ? events.filter((e) => e.kind === activeFilter.kind) : events;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] font-display">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 mx-auto max-w-4xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
              <span className="text-[hsl(var(--muted-foreground))] uppercase tracking-wider">On-chain · live</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight text-[hsl(var(--foreground))] sm:text-5xl">
              Vault <span className="text-[hsl(var(--primary))]">activity.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
              Every deposit, supply, hedge, unwind &amp; redeem on the PredictVault — read straight from
              on-chain events. Click any row to verify on Suiscan.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-4 py-2 text-sm text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary)/0.4)] hover:bg-white/[0.05]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* filter pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count = f.kind ? events.filter((e) => e.kind === f.kind).length : events.length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  filter === f.key
                    ? "border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
                    : "border border-[hsl(var(--border))] bg-white/[0.02] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-xs opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-16 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
              <span className="animate-pulse">Loading on-chain activity…</span>
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-12 text-center backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-white/[0.02]">
              <ActivityIcon className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
            </div>
            <p className="text-[hsl(var(--muted-foreground))]">
              {events.length === 0 ? "No vault activity yet." : `No ${activeFilter?.label.toLowerCase()} activity.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {shown.map((e, i) => {
              const d = describe(e);
              return (
                <a
                  key={`${e.digest}-${i}`}
                  href={`https://suiscan.xyz/testnet/tx/${e.digest}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-4 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${d.tint}`}>{d.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{d.label}</p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{d.detail || SHORT(e.sender)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="flex items-center justify-end gap-1 text-xs font-mono text-[hsl(var(--primary))]">
                      {SHORT(e.digest)} <ExternalLink className="h-3 w-3" />
                    </p>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{relTime(e.timestampMs)}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
