"use client";

import { useEffect, useState, Fragment } from "react";
import { Navbar, AppBackground } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { formatNumber } from "@/lib/utils/format";
import { ChevronDown, ChevronUp, Calendar, DollarSign, Activity, ExternalLink, RefreshCw, AlertTriangle, Wallet, LayersIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { executeRepay, executeLiquidate } from "@/lib/sui/transaction-executor";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";
import { isMockMode } from "@/lib/config";

export default function PositionsPage() {
  const { positions, fetchPositions, repayPosition, liquidatePosition } = useAppStore();
  const { address, isConnected } = useWallet();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const toggleRow = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
    }
  };

  const handleRepay = async (positionId: string, asset: string, amount: number) => {
    // Real mode requires a connected wallet; mock mode simulates without one.
    if (!isMockMode() && !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    setProcessingId(positionId);
    toast.loading("Processing repayment...");

    try {
      // Real mode needs a concrete coin object to pay the debt from; mock mode ignores it.
      let coinObjectId = "0x...coin";
      if (!isMockMode() && address) {
        const coins = await fetchUserCoins(address, getCoinType(asset));
        const top = [...coins].sort((a, b) => b.balance - a.balance)[0];
        if (!top) {
          toast.dismiss();
          toast.error(`No ${asset} balance to repay with`);
          setProcessingId(null);
          return;
        }
        coinObjectId = top.objectId;
      }

      const result = await executeRepay(positionId, coinObjectId, asset, address || "");

      if (result.success) {
        toast.dismiss();
        toast.success("Loan repaid successfully!");
        repayPosition(positionId);
      } else {
        toast.dismiss();
        toast.error(`Repayment failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Repay error:", error);
      toast.dismiss();
      toast.error("Failed to repay loan");
    } finally {
      setProcessingId(null);
    }
  };

  const handleLiquidate = async (positionId: string, asset: string) => {
    // Real mode requires a connected wallet; mock mode simulates without one.
    if (!isMockMode() && !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    setProcessingId(positionId);
    toast.loading("Processing liquidation...");

    try {
      // For liquidation, we also need to pay the debt to seize collateral.
      let coinObjectId = "0x...coin";
      if (!isMockMode() && address) {
        const coins = await fetchUserCoins(address, getCoinType(asset));
        const top = [...coins].sort((a, b) => b.balance - a.balance)[0];
        if (!top) {
          toast.dismiss();
          toast.error(`No ${asset} balance to liquidate with`);
          setProcessingId(null);
          return;
        }
        coinObjectId = top.objectId;
      }

      const result = await executeLiquidate(positionId, coinObjectId, asset, address || "");

      if (result.success) {
        toast.dismiss();
        toast.success("Loan liquidated successfully!");
        liquidatePosition(positionId);
      } else {
        toast.dismiss();
        toast.error(`Liquidation failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Liquidate error:", error);
      toast.dismiss();
      toast.error("Failed to liquidate loan");
    } finally {
      setProcessingId(null);
    }
  };

  const isOverdue = (endDate?: string) => {
    if (!endDate) return false;
    const t = new Date(endDate).getTime();
    return Number.isFinite(t) && t < Date.now();
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  // Presentational-only derived summary (no data flow changes).
  const lendingCount = positions.filter((p) => p.type === "lending").length;
  const borrowingCount = positions.filter((p) => p.type === "borrowing").length;
  const totalValue = positions.reduce((sum, p) => sum + (p.amount || 0), 0);

  // In mock mode the demo wallet isn't auto-connected, so we still show the
  // populated portfolio; real mode requires an actual wallet connection.
  const canViewPositions = isMockMode() || isConnected;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))]">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* ============================ HEADER ============================ */}
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            <span className="text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Portfolio · On-chain</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.02] text-[hsl(var(--foreground))]">
            Your <span className="text-[hsl(var(--primary))]">positions.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            Track every active lend &amp; borrow leg. Expand any row to inspect the timeline,
            financials, and on-chain contract — all verifiable on Sui.
          </p>
        </div>

        {!canViewPositions ? (
          <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-12 sm:p-16 flex flex-col items-center justify-center text-center">
            <span className="lp-glow pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 opacity-40" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary))]/20">
              <Wallet className="h-6 w-6 text-[hsl(var(--primary))]" />
            </span>
            <p className="relative mt-5 text-lg font-semibold text-[hsl(var(--foreground))]">Connect your wallet</p>
            <p className="relative mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
              Please connect your wallet to view positions.
            </p>
          </div>
        ) : (
          <>
            {/* ========================= SUMMARY STATS ========================= */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <LayersIcon className="h-3.5 w-3.5" />
                  <span className="text-xs uppercase tracking-wide">Total Positions</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-[hsl(var(--foreground))]">{positions.length}</p>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="text-xs uppercase tracking-wide">Total Value</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-[hsl(var(--foreground))]">${formatNumber(totalValue)}</p>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                  <span className="text-xs uppercase tracking-wide">Lending</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-[hsl(var(--success))]">{lendingCount}</p>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                  <span className="text-xs uppercase tracking-wide">Borrowing</span>
                </div>
                <p className="mt-3 text-3xl font-bold text-[hsl(var(--warning))]">{borrowingCount}</p>
              </div>
            </div>

            {/* ========================= POSITIONS TABLE ========================= */}
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-white/[0.02]">
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-b border-[hsl(var(--border))]">Type</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-b border-[hsl(var(--border))]">Asset</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-b border-[hsl(var(--border))]">Amount</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-b border-[hsl(var(--border))]">Rate</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-b border-[hsl(var(--border))]">Status</th>
                      <th className="px-6 py-4 text-right text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-b border-[hsl(var(--border))]">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-white/[0.02]">
                              <LayersIcon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                            </span>
                            <p className="mt-4 text-sm font-medium text-[hsl(var(--foreground))]">No active positions found.</p>
                            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Your lend &amp; borrow legs will appear here.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      positions.map((pos) => (
                        <Fragment key={pos.id}>
                          <tr
                            onClick={() => toggleRow(pos.id)}
                            className={cn(
                              "group cursor-pointer transition-colors",
                              expandedRow === pos.id ? "bg-[hsl(var(--primary)/0.04)]" : "hover:bg-white/[0.025]"
                            )}
                          >
                            <td className="px-6 py-5 whitespace-nowrap border-b border-[hsl(var(--border))]/60">
                              <span className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1",
                                pos.type === 'lending'
                                  ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] ring-[hsl(var(--success))]/20"
                                  : "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] ring-[hsl(var(--warning))]/20"
                              )}>
                                {pos.type === 'lending'
                                  ? <TrendingUp className="h-3 w-3" />
                                  : <TrendingDown className="h-3 w-3" />}
                                {pos.type === 'lending' ? 'Lend' : 'Borrow'}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap text-sm font-semibold text-[hsl(var(--foreground))] border-b border-[hsl(var(--border))]/60">
                              {pos.asset}
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-[hsl(var(--foreground))] border-b border-[hsl(var(--border))]/60">
                              ${formatNumber(pos.amount)}
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap text-sm font-semibold text-[hsl(var(--primary))] border-b border-[hsl(var(--border))]/60">
                              {pos.interestRate ?? 0}%
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap border-b border-[hsl(var(--border))]/60">
                              <span className="inline-flex items-center gap-1.5 text-sm capitalize text-[hsl(var(--muted-foreground))]">
                                <span className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  pos.status === 'active' ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted-foreground))]"
                                )} />
                                {pos.status}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap text-right border-b border-[hsl(var(--border))]/60">
                              <span className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                                expandedRow === pos.id
                                  ? "border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] group-hover:border-[hsl(var(--primary)/0.3)]"
                              )}>
                                {expandedRow === pos.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </span>
                            </td>
                          </tr>
                          {expandedRow === pos.id && (
                            <tr className="bg-[hsl(var(--primary)/0.02)]">
                              <td colSpan={6} className="px-6 py-7 border-b border-[hsl(var(--border))]">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                  {/* ----------------- Timeline ----------------- */}
                                  <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5 space-y-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))] flex items-center gap-2">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                                        <Calendar className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                                      </span>
                                      Timeline
                                    </h4>
                                    <div className="space-y-2.5">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-[hsl(var(--muted-foreground))]">Start Date</span>
                                        <span className="text-[hsl(var(--foreground))] font-medium">{formatDate(pos.startDate)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-[hsl(var(--muted-foreground))]">End Date</span>
                                        <span className="text-[hsl(var(--foreground))] font-medium">{formatDate(pos.endDate)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-[hsl(var(--muted-foreground))]">Duration</span>
                                        <span className="text-[hsl(var(--foreground))] font-medium">{pos.term} days</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* ----------------- Financials ----------------- */}
                                  <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5 space-y-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))] flex items-center gap-2">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--success))]/10">
                                        <DollarSign className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                                      </span>
                                      Financials
                                    </h4>
                                    <div className="space-y-2.5">
                                      {pos.type === 'lending' && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-[hsl(var(--muted-foreground))]">Earned Interest</span>
                                          <span className="text-[hsl(var(--success))] font-semibold">+{formatNumber(pos.earnedInterest || 0)} {pos.asset}</span>
                                        </div>
                                      )}
                                      {pos.type === 'borrowing' && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-[hsl(var(--muted-foreground))]">Paid Interest</span>
                                          <span className="text-[hsl(var(--destructive))] font-semibold">-{formatNumber(pos.paidInterest || 0)} {pos.asset}</span>
                                        </div>
                                      )}

                                      {pos.status === 'active' && (
                                        <div className="mt-4">
                                          {pos.type === 'borrowing' ? (
                                            <Button
                                              onClick={() => handleRepay(pos.id, pos.asset, pos.amount)}
                                              disabled={!!processingId}
                                              className="w-full rounded-full bg-[hsl(var(--primary))] hover:brightness-110 text-[hsl(var(--primary-foreground))] font-semibold"
                                            >
                                              {processingId === pos.id ? (
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                              ) : (
                                                <DollarSign className="w-4 h-4 mr-2" />
                                              )}
                                              Repay Loan
                                            </Button>
                                          ) : (
                                            <Button
                                              variant="outline"
                                              disabled
                                              className="w-full rounded-full border-[hsl(var(--success))/20] text-[hsl(var(--success))]"
                                            >
                                              <Activity className="w-4 h-4 mr-2" />
                                              Earning Interest
                                            </Button>
                                          )}
                                          {(pos.type === 'lending' && isOverdue(pos.endDate)) && (
                                            <Button
                                              onClick={() => handleLiquidate(pos.id, pos.asset)}
                                              disabled={!!processingId}
                                              variant="destructive"
                                              className="w-full mt-2 rounded-full"
                                            >
                                              {processingId === pos.id ? (
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                              ) : (
                                                <AlertTriangle className="w-4 h-4 mr-2" />
                                              )}
                                              Liquidate (Overdue)
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* ----------------- Risk & Collateral ----------------- */}
                                  <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5 space-y-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))] flex items-center gap-2">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--warning))]/10">
                                        <Activity className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                                      </span>
                                      Risk &amp; Collateral
                                    </h4>
                                    <div className="space-y-2.5">
                                      {pos.type === 'borrowing' && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-[hsl(var(--muted-foreground))]">LTV (Raw)</span>
                                          <span className="text-[hsl(var(--foreground))] font-medium tooltip" title="Ratio of Loan Amount to Collateral Amount (Price agnostic)">
                                            {(pos.ltv ?? 0).toFixed(2)}%
                                          </span>
                                        </div>
                                      )}

                                      {/* Single Collateral Display (Contract is Single Collateral) */}
                                      {pos.collateralAsset && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-[hsl(var(--muted-foreground))]">Collateral</span>
                                          <span className="text-[hsl(var(--foreground))] font-medium">{formatNumber(pos.collateralAmount || 0)} {pos.collateralAsset}</span>
                                        </div>
                                      )}

                                      <div className="flex justify-between text-sm items-center pt-3 mt-1 border-t border-[hsl(var(--border))]/60">
                                        <span className="text-[hsl(var(--muted-foreground))]">Contract ID</span>
                                        <a
                                          href={isMockMode() ? "#" : `https://suiscan.xyz/testnet/object/${pos.id.split('-')[0]}`} // Handle suffix
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-mono text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                                        >
                                          {pos.id.split('-')[0].slice(0, 8)}...{pos.id.split('-')[0].slice(-6)}
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
