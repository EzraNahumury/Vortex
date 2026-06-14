"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar, AppBackground } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { ArrowLeft, ArrowRight, ShieldCheck, Layers, TrendingUp, Wallet, Activity } from "lucide-react";

export default function VaultDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { vaults, isLoadingVaults, fetchVaults } = useAppStore();

  useEffect(() => {
    if (vaults.length === 0) fetchVaults();
  }, [vaults.length, fetchVaults]);

  const vault = vaults.find((v) => v.id === id);

  // Defensive fallbacks: real mode / partial data may omit fields, and
  // formatNumber/formatPercentage call .toFixed() which throws on undefined.
  const asset = vault?.asset || "—";
  const assetSlug = (vault?.asset || "token").toLowerCase();
  const assetBadge = (vault?.asset || "?").slice(0, 2);
  const exposure = vault?.exposure ?? [];

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] font-display">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 mx-auto max-w-5xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <Link
          href="/earn"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Vaults
        </Link>

        {isLoadingVaults && !vault ? (
          <div className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-16 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
              <span className="animate-pulse">Loading vault…</span>
            </div>
          </div>
        ) : !vault ? (
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-12 text-center backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-white/[0.02]">
              <Layers className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
            </div>
            <p className="mb-2 text-lg font-semibold text-[hsl(var(--foreground))]">Vault not found</p>
            <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
              This vault (<span className="font-mono">{id}</span>) is not available.
            </p>
            <Link href="/earn" className="lp-btn-neon inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold">
              Browse vaults <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* ============================ HEADER ============================ */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-[hsl(var(--primary))]/15 ring-1 ring-[hsl(var(--border))]">
                  <img
                    src={`/token/${assetSlug}.png`}
                    alt={asset}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = "none";
                      if (t.parentElement) {
                        t.parentElement.innerHTML = `<span class="absolute inset-0 flex items-center justify-center text-base font-bold text-[hsl(var(--primary))]">${assetBadge}</span>`;
                      }
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-bold leading-tight text-[hsl(var(--foreground))] sm:text-4xl">
                    {vault.name || "Unnamed vault"}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {asset}
                    </span>
                    {vault.curatorVerified && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--success))]/15 px-3 py-1 text-xs font-medium text-[hsl(var(--success))]">
                        <ShieldCheck className="h-3.5 w-3.5" /> Verified curator
                      </span>
                    )}
                    {vault.curator && (
                      <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                        by {vault.curator}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Link href="/earn" className="lp-btn-neon inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold">
                <Wallet className="mr-2 h-4 w-4" /> Deposit via Aggregator
              </Link>
            </div>

            {/* ============================ STATS ============================ */}
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { icon: TrendingUp, label: "APY", value: formatPercentage(vault.apy ?? 0), accent: true },
                { icon: Layers, label: "Total Deposits", value: `${formatNumber(vault.deposits ?? 0)} ${asset}` },
                { icon: Activity, label: "Liquidity", value: `${formatNumber(vault.liquidity ?? 0)} ${asset}` },
                { icon: ShieldCheck, label: "Curator", value: vault.curator || "—" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]"
                >
                  <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                    <s.icon className="h-3.5 w-3.5" />
                    <span className="text-xs uppercase tracking-wide">{s.label}</span>
                  </div>
                  <p className={`mt-3 text-2xl font-bold ${s.accent ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--foreground))]"}`}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* ============================ EXPOSURE ============================ */}
            <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Market exposure</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Assets this vault routes capital across.
              </p>
              {exposure.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  {exposure.map((exp, i) => (
                    <span
                      key={`${exp}-${i}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3.5 py-2"
                    >
                      <span className="relative h-6 w-6 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
                        <img
                          src={`/token/${(exp || "token").toLowerCase()}.png`}
                          alt={exp}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement;
                            t.style.display = "none";
                            if (t.parentElement) {
                              t.parentElement.innerHTML = `<span class="absolute inset-0 flex items-center justify-center text-[10px] font-medium">${(exp || "?").slice(0, 1)}</span>`;
                            }
                          }}
                        />
                      </span>
                      <span className="text-sm text-[hsl(var(--foreground))]">{exp}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">
                  No market exposure data available for this vault.
                </p>
              )}
            </div>

            {/* ============================ NOTE ============================ */}
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white/[0.02] p-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/12">
                <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
              </span>
              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                Deposits route through the <span className="text-[hsl(var(--foreground))]">Nautilus aggregator vault</span> — the
                off-chain enclave designs the allocation plan and signs each leg, and the vault only moves
                capital after verifying those signatures on-chain.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
