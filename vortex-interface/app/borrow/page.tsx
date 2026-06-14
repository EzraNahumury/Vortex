"use client";

import { useEffect, useState } from "react";
import { Navbar, AppBackground } from "@/components/shared";
import { BorrowForm, BorrowPositionCard } from "@/components/pages/borrow";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils/format";
import { toast } from "sonner";
import { executeBorrow, executeRepay } from "@/lib/sui/transaction-executor";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";
import { isMockMode, env } from "@/lib/config";
import { ExternalLink, Coins, LineChart } from "lucide-react";

export default function BorrowPage() {
  const {
    positions,
    borrowMarkets,
    prices,
    isLoadingPositions,
    isLoadingMarket,
    fetchPositions,
    fetchMarketData,
  } = useAppStore();

  const { address, isConnected } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions();
    fetchMarketData();
  }, [fetchPositions, fetchMarketData]);

  const borrowPositions = positions.filter(
    (p) => p.type === "borrowing" && p.status === "active"
  );

  const getPrice = (asset: string) => {
    const priceData = prices.find((p) => p.asset === asset);
    return priceData?.price || 0;
  };

  const handleBorrowSubmit = async (data: {
    collateralAsset: string;
    collateralAmount: number;
    collateralCoinId: string;
    borrowAsset: string;
    borrowAmount: number;
    ltv: number;
  }) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);

    try {
      const hasPackageId = Boolean(env.sui.packageId);

      if (hasPackageId && !isMockMode()) {
        // Execute real blockchain transaction
        const result = await executeBorrow(
          {
            collateralCoinId: data.collateralCoinId,
            borrowAsset: data.borrowAsset,
            borrowAmount: data.borrowAmount,
            ltv: data.ltv,
          },
          address
        );

        if (result.success) {
          setLastTxDigest(result.digest || null);
          
          // Refresh positions after successful transaction
          fetchPositions();

          toast.success(
            <div className="flex flex-col gap-1">
              <span>Borrow position created: {formatNumber(data.borrowAmount)} {data.borrowAsset}</span>
              {result.digest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  View transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        } else {
          toast.error(result.error || "Failed to create borrow position");
        }
      } else {
        // Mock mode - simulate success
        await new Promise((resolve) => setTimeout(resolve, 1000));
        toast.success(`Borrow order created: ${formatNumber(data.borrowAmount)} ${data.borrowAsset}`);
      }
    } catch (error) {
      console.error("Borrow submission error:", error);
      toast.error("Failed to create borrow position. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepay = async (positionId: string) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    const pos = borrowPositions.find((p) => p.id === positionId);
    const asset = pos?.asset || "USDC";
    toast.loading("Processing repayment...");
    try {
      // Real mode needs a concrete coin object to pay the debt from; mock mode ignores it.
      let coinObjectId = "0x...coin";
      if (!isMockMode()) {
        const coins = await fetchUserCoins(address, getCoinType(asset));
        const top = [...coins].sort((a, b) => b.balance - a.balance)[0];
        if (!top) {
          toast.dismiss();
          toast.error(`No ${asset} balance to repay with`);
          return;
        }
        coinObjectId = top.objectId;
      }
      const result = await executeRepay(positionId, coinObjectId, asset, address);
      toast.dismiss();
      if (result.success) {
        toast.success("Loan repaid successfully!");
        fetchPositions();
      } else {
        toast.error(result.error || "Repayment failed");
      }
    } catch (error) {
      console.error("Repay error:", error);
      toast.dismiss();
      toast.error("Failed to repay loan");
    }
  };

  const handleAddCollateral = async (positionId: string) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    // TODO: Implement add collateral transaction
    toast.info("Add collateral feature coming soon");
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))]">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            <span className="lp-muted uppercase">Custom-term borrowing</span>
          </div>
          <h1 className="font-display text-[clamp(34px,5vw,56px)] font-bold leading-[1.02] text-[hsl(var(--foreground))]">
            Borrow against your <span className="text-[hsl(var(--primary))]">collateral.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Deposit collateral and borrow assets with custom terms — orders matched via AI
            fairness scoring for the best on-chain rates.
          </p>
          {lastTxDigest && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${lastTxDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] px-3.5 py-1.5 text-xs font-medium text-[hsl(var(--primary))] transition hover:brightness-110"
            >
              Last tx: {lastTxDigest.slice(0, 16)}... <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="mb-6 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-1 backdrop-blur-xl">
                <TabsTrigger value="positions" className="cursor-pointer rounded-full">Your Positions</TabsTrigger>
                <TabsTrigger value="markets" className="cursor-pointer rounded-full">Markets</TabsTrigger>
              </TabsList>

              <TabsContent value="positions">
                {isLoadingPositions ? (
                  <div className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-16 backdrop-blur-xl">
                    <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
                      <span className="animate-pulse">Loading positions...</span>
                    </div>
                  </div>
                ) : borrowPositions.length === 0 ? (
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-12 text-center backdrop-blur-xl">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)]">
                      <Coins className="h-6 w-6 text-[hsl(var(--primary))]" />
                    </div>
                    <p className="mb-2 text-lg font-semibold text-[hsl(var(--foreground))]">
                      No active borrow positions
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Create a borrow position using the form on the right.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {borrowPositions.map((position) => (
                      <BorrowPositionCard
                        key={position.id}
                        position={position}
                        collateralAsset={position.collateralAsset || "SUI"}
                        collateralAmount={position.collateralAmount || 0}
                        currentPrice={getPrice(position.collateralAsset || "SUI")}
                        liquidationPrice={position.liquidationPrice || 0}
                        onRepay={handleRepay}
                        onAddCollateral={handleAddCollateral}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="markets">
                {isLoadingMarket ? (
                  <div className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-16 backdrop-blur-xl">
                    <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
                      <span className="animate-pulse">Loading markets...</span>
                    </div>
                  </div>
                ) : borrowMarkets.length === 0 ? (
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-12 text-center backdrop-blur-xl">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-white/[0.02]">
                      <LineChart className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <p className="text-[hsl(var(--muted-foreground))]">
                      No markets available yet
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[hsl(var(--border))]">
                            <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Asset</th>
                            <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Available</th>
                            <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Borrow APR</th>
                            <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Max LTV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {borrowMarkets.map((market) => (
                            <tr key={market.asset} className="border-b border-[hsl(var(--border))] transition-colors last:border-b-0 hover:bg-white/[0.02]">
                              <td className="px-6 py-5 text-sm font-medium text-[hsl(var(--foreground))]">{market.asset}</td>
                              <td className="px-6 py-5 text-sm text-[hsl(var(--foreground))]">
                                {market.available > 0 ? `$${formatNumber(market.available)}` : "—"}
                              </td>
                              <td className="px-6 py-5 text-sm font-semibold text-[hsl(var(--warning))]">{market.borrowApr}%</td>
                              <td className="px-6 py-5 text-sm text-[hsl(var(--foreground))]">{market.maxLtv}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <BorrowForm onSubmit={handleBorrowSubmit} isSubmitting={isSubmitting} />
          </div>
        </div>
      </main>
    </div>
  );
}
