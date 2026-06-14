"use client";

import { useEffect, useState } from "react";
import { Navbar, AppBackground } from "@/components/shared";
import { VestingDepositForm, VestingPositionsTable } from "@/components/pages/vesting";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils/format";
import { Lock, Sparkles, Shield, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { VestingPosition } from "@/lib/types";
import { executeLockVesting, executeUnlockVesting } from "@/lib/sui/transaction-executor";
import { isMockMode, env } from "@/lib/config";

export default function VestingPage() {
  const {
    vestingPositions,
    user,
    isLoadingVesting,
    fetchVestingPositions,
    addVestingPosition,
    unlockVestingPosition,
  } = useAppStore();

  const { address, isConnected } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);

  useEffect(() => {
    fetchVestingPositions();
  }, [fetchVestingPositions]);

  const activePositions = vestingPositions.filter((p) => p.status !== "unlocked");
  const unlockedPositions = vestingPositions.filter((p) => p.status === "unlocked");

  const totalLocked = activePositions.reduce((acc, p) => acc + p.amount, 0);
  const totalEarned = vestingPositions.reduce((acc, p) => acc + p.earnedRewards, 0);
  const hasActiveLock = activePositions.length > 0;

  const handleDeposit = async (data: { amount: number; lockDuration: number }) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);

    try {
      const subsidyRate = data.lockDuration >= 365 ? 3.5 : data.lockDuration >= 180 ? 2.5 : data.lockDuration >= 90 ? 1.5 : 0.5;
      const baseApy = 4.5;

      // Always execute through the service - it handles Mock/Real switching internally
      const result = await executeLockVesting(
        {
          amount: data.amount,
          lockDurationDays: data.lockDuration,
        },
        address
      );

      if (result.success) {
        setLastTxDigest(result.digest || null);

        const newPosition: VestingPosition = {
          id: result.digest || `vest-${Date.now()}`,
          amount: data.amount,
          lockDate: new Date().toISOString(),
          unlockDate: new Date(Date.now() + data.lockDuration * 24 * 60 * 60 * 1000).toISOString(),
          apy: baseApy + subsidyRate,
          subsidyRate,
          earnedRewards: 0,
          status: "locked",
          zkProofVerified: true,
        };

        addVestingPosition(newPosition);

        toast.success(
          <div className="flex flex-col gap-1">
            <span>Locked {formatNumber(data.amount)} SUI for {data.lockDuration} days</span>
            {result.digest && (
              <a
                href={isMockMode() ? "#" : `https://suiscan.xyz/testnet/tx/${result.digest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                  {isMockMode() ? "View Tx" : "View transaction"} <ExternalLink className="w-3 h-3" />
              </a>
            )}
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
              APY: {(baseApy + subsidyRate).toFixed(1)}% (includes {subsidyRate}% subsidy)
            </span>
          </div>
        );
      } else {
        toast.error(result.error || "Failed to lock tokens");
      }
    } catch (error) {
      console.error("Lock vesting error:", error);
      toast.error("Failed to lock tokens. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async (positionId: string) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);

    try {
      // Always execute through the service
      const result = await executeUnlockVesting(positionId, address);

      if (result.success) {
        setLastTxDigest(result.digest || null);
        unlockVestingPosition(positionId);

        toast.success(
          <div className="flex flex-col gap-1">
            <span>Tokens unlocked successfully</span>
            {result.digest && (
              <a
                href={isMockMode() ? "#" : `https://suiscan.xyz/testnet/tx/${result.digest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                {isMockMode() ? "View Tx" : "View transaction"} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        );
      } else {
        toast.error(result.error || "Failed to unlock tokens");
      }
    } catch (error) {
      console.error("Unlock vesting error:", error);
      toast.error("Failed to unlock tokens. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] font-display">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* ============================ HEADER ============================ */}
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            <span className="lp-muted uppercase">Vesting Vault · Lock to earn</span>
          </div>
          <h1 className="text-[clamp(34px,5vw,56px)] font-bold leading-[1.02] text-[hsl(var(--foreground))]">
            Lock your SUI. <span className="text-[hsl(var(--primary))]">Earn subsidy yield.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Lock your vested SUI tokens to earn subsidy yield and get priority in order matching.
            Longer lock durations earn higher APY rewards.
          </p>

          {/* feature chips */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--foreground))]">
              <Lock className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              Lock to Earn
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--foreground))]">
              <Shield className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
              Priority Matching
            </span>
          </div>

          {lastTxDigest && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${lastTxDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1 text-sm text-[hsl(var(--primary))] hover:underline"
            >
              Last transaction: {lastTxDigest.slice(0, 16)}... <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ============================ MAIN COLUMN ============================ */}
          <div className="space-y-6 lg:col-span-2">
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <p className="mb-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total Locked</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
                    {formatNumber(totalLocked)}
                  </span>
                  <span className="text-sm font-medium text-[hsl(var(--primary))]">SUI</span>
                </div>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <p className="mb-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Total Earned</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[hsl(var(--success))]">
                    +{formatNumber(totalEarned)}
                  </span>
                  <span className="text-sm font-medium text-[hsl(var(--success))]">SUI</span>
                </div>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <p className="mb-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Priority Status</p>
                <div className="flex items-center gap-2">
                  {hasActiveLock && <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))] shadow-[0_0_8px_hsl(var(--success))]" />}
                  <span className={`text-2xl font-bold ${hasActiveLock ? "text-[hsl(var(--success))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                    {hasActiveLock ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
                <p className="mb-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Active Locks</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
                    {activePositions.filter((p) => p.status === "locked").length}
                  </span>
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">positions</span>
                </div>
              </div>
            </div>

            {/* Tabs with Positions Table */}
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="mb-6 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] p-1">
                <TabsTrigger value="positions" className="cursor-pointer rounded-full">
                  Active Positions
                </TabsTrigger>
                <TabsTrigger value="history" className="cursor-pointer rounded-full">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="positions">
                {isLoadingVesting ? (
                  <div className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-14 backdrop-blur-xl">
                    <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading positions...</div>
                  </div>
                ) : (
                  <VestingPositionsTable
                    positions={activePositions}
                    title="Your Positions"
                    onUnlock={handleUnlock}
                    isSubmitting={isSubmitting}
                    emptyMessage="You have no locked vesting positions. Lock your vested SUI to earn subsidy yield."
                  />
                )}
              </TabsContent>

              <TabsContent value="history">
                <VestingPositionsTable
                  positions={unlockedPositions}
                  title="Unlock History"
                  emptyMessage="No unlock history yet"
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* ============================ SIDEBAR ============================ */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <VestingDepositForm onSubmit={handleDeposit} isSubmitting={isSubmitting} />

            {/* Benefits Card */}
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl">
              <h4 className="mb-5 text-sm font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Vault Benefits
              </h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10">
                    <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Subsidy Yield</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Earn up to 3.5% extra APY on locked tokens
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--success))]/10">
                    <Shield className="h-4 w-4 text-[hsl(var(--success))]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Priority Matching</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Get matched first with better rates
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10">
                    <Lock className="h-4 w-4 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Ecosystem Stability</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Reduce sell pressure on SUI
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
