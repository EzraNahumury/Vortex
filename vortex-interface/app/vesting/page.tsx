"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/shared";
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
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_hsla(220,50%,20%,0.3)_0%,_transparent_70%)] pointer-events-none" />

      <main className="relative pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-semibold text-[hsl(var(--foreground))]">Vesting</h1>
                <span className="text-4xl font-semibold text-[hsl(var(--muted-foreground))]">Vault</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                  <Lock className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                  <span className="text-xs text-[hsl(var(--foreground))]">Lock to Earn</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                  <Shield className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                  <span className="text-xs text-[hsl(var(--foreground))]">Priority Matching</span>
                </div>
              </div>

              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-8 max-w-2xl">
                Lock your vested SUI tokens to earn subsidy yield and get priority in order matching. 
                Longer lock durations earn higher APY rewards.
              </p>

              {lastTxDigest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${lastTxDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1 mb-4"
                >
                  Last transaction: {lastTxDigest.slice(0, 16)}... <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Stats Row - Dashboard Style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-b border-[hsl(var(--border))]">
              <div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Total Locked</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                    {formatNumber(totalLocked)}
                  </span>
                  <span className="text-lg text-[hsl(var(--primary))]">SUI</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Total Earned</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-[hsl(var(--accent))]">
                    +{formatNumber(totalEarned)}
                  </span>
                  <span className="text-lg text-[hsl(var(--accent))]">SUI</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Priority Status</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-semibold ${hasActiveLock ? "text-[hsl(var(--success))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                    {hasActiveLock ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Active Locks</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                    {activePositions.filter((p) => p.status === "locked").length}
                  </span>
                  <span className="text-lg text-[hsl(var(--muted-foreground))]">positions</span>
                </div>
              </div>
            </div>

            {/* Tabs with Positions Table */}
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="bg-transparent border-b border-[hsl(var(--border))] rounded-none p-0 h-auto">
                <TabsTrigger
                  value="positions"
                  className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
                >
                  Active Positions
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
                >
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="positions" className="mt-6">
                {isLoadingVesting ? (
                  <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
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

              <TabsContent value="history" className="mt-6">
                <VestingPositionsTable
                  positions={unlockedPositions}
                  title="Unlock History"
                  emptyMessage="No unlock history yet"
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Deposit Panel */}
          <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
            <VestingDepositForm onSubmit={handleDeposit} isSubmitting={isSubmitting} />

            {/* Benefits Card */}
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-5">
              <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-4">Vault Benefits</h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent))]/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[hsl(var(--accent))]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">Subsidy Yield</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Earn up to 3.5% extra APY on locked tokens
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--success))]/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-[hsl(var(--success))]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">Priority Matching</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Get matched first with better rates
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))]/20 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">Ecosystem Stability</p>
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
