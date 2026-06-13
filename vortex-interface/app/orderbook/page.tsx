"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/shared";
import { CreateOrderForm, OrderbookTable, OrdersTable } from "@/components/pages/orderbook";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, EyeOff, Shield, Zap, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@/lib/types";
import { executeCreateOrder, executeMatchOrders } from "@/lib/sui/transaction-executor";
import { calculateFairnessScore } from "@/lib/sui/blockchain-service";
import { isMockMode, env } from "@/lib/config";
import { formatNumber } from "@/lib/utils/format";
import { pickBestMatch, type MatchCandidate } from "@/lib/matching/ranker";

export default function OrderbookPage() {
  const { orders, user, isLoadingOrders, fetchOrders, addOrder, vestingPositions } = useAppStore();
  const { address, isConnected } = useWallet();

  const [orderType, setOrderType] = useState<"lend" | "borrow">("lend");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<MatchCandidate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const lendOrders = orders.filter((o) => o.type === "lend");
  const borrowOrders = orders.filter((o) => o.type === "borrow");
  const userOrders = orders.filter((o) => o.status === "pending" || o.status === "matched");

  // Calculate market stats
  const totalLendVolume = lendOrders.reduce((acc, o) => acc + o.amount, 0);
  const totalBorrowVolume = borrowOrders.reduce((acc, o) => acc + o.amount, 0);
  const avgLendRate = lendOrders.length > 0 
    ? lendOrders.reduce((acc, o) => acc + o.interestRate, 0) / lendOrders.length 
    : 0;
  const avgBorrowRate = borrowOrders.length > 0 
    ? borrowOrders.reduce((acc, o) => acc + o.interestRate, 0) / borrowOrders.length 
    : 0;

  const generateZkProofHash = (): string => {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).slice(2, 18);
    return `0x${timestamp}${random}`.padEnd(66, "0").slice(0, 66);
  };

  const handleOrderSubmit = async (orderData: {
    asset: string;
    amount: number;
    interestRate: number;
    ltv: number;
    term: number;
    isHidden: boolean;
    coinObjectId?: string;
    collateralAmount?: number;
    collateral?: string;
    collateralCoinId?: string;
    collaterals?: { asset: string; amount: number }[];
  }) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);

    try {
      const isVested = vestingPositions.some(vp => vp.status === "locked" || vp.status === "unlockable");
      const fairnessResult = await calculateFairnessScore(
        orderData.amount,
        address,
        isVested
      );

      const zkProofHash = orderData.isHidden ? generateZkProofHash() : undefined;

      // Always execute through the service - it handles Mock/Real switching internally
      const result = await executeCreateOrder(
        {
          type: orderType,
          ...orderData,
        },
        address
      );

      if (result.success) {
        setLastTxDigest(result.digest || null);
        
        // Optimistic UI update
        const newOrder: Order = {
          id: result.digest || `order-${Date.now()}`,
          type: orderType,
          asset: orderData.asset,
          amount: orderData.amount,
          interestRate: orderData.interestRate,
          ltv: orderData.ltv,
          term: orderData.term,
          status: "pending",
          createdAt: new Date().toISOString(),
          isHidden: orderData.isHidden,
          zkProofHash,
          fairnessScore: fairnessResult.score,
          collaterals: orderData.collaterals,
        };

        addOrder(newOrder);
        setIsDialogOpen(false);

        toast.success(
          <div className="flex flex-col gap-1">
            <span>{orderType === "lend" ? "Lend" : "Borrow"} order placed successfully!</span>
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
              Fairness Score: {fairnessResult.score}/100
            </span>
          </div>
        );
      } else {
        toast.error(result.error || "Failed to create order");
      }
    } catch (error) {
      console.error("Order submission error:", error);
      toast.error("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFindMatch = () => {
    if (!address) return;

    const { match, nearMissReason, consideredPairs } = pickBestMatch(orders, {
      amountTolerance: 0.005,
    });

    if (!match) {
      if (consideredPairs === 0) {
        toast.info("Not enough open orders to match.");
      } else {
        toast.info(`No qualifying match across ${consideredPairs} pairs (${nearMissReason ?? "criteria mismatch"}).`);
      }
      return;
    }

    setPreviewCandidate(match);
    setIsPreviewOpen(true);
  };

  const handleConfirmMatch = async () => {
    if (!address || !previewCandidate) return;

    setIsMatching(true);
    setIsPreviewOpen(false);

    try {
      const { lend, borrow } = previewCandidate;

      // Borrower-side vesting drives the priority boost — not the caller's positions.
      const borrowerAddress = borrow.creator || address;
      const isVested = borrowerAddress === address
        ? vestingPositions.some((vp) => vp.status === "locked" || vp.status === "unlockable")
        : false;

      const result = await executeMatchOrders(
        lend.id,
        borrow.id,
        lend.asset,
        address,
        {
          collateral: lend.collateralAsset || borrow.collateralAsset || "SUI",
          lendAmount: lend.amount,
          borrowAmount: borrow.amount,
          lendRate: lend.interestRate,
          borrowRate: borrow.interestRate,
          lenderAddress: lend.creator || address,
          borrowerAddress,
          isVested,
        },
      );

      if (result.success) {
        setLastTxDigest(result.digest || null);
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Orders matched successfully.</span>
            {result.fairnessScore !== undefined && (
              <span className="text-xs text-emerald-400">
                Nautilus fairness {result.fairnessScore}/100
                {result.finalRate !== undefined && ` • rate ${result.finalRate.toFixed(2)}%`}
              </span>
            )}
            {result.digest && (
              <a
                href={isMockMode() ? "#" : `https://suiscan.xyz/testnet/tx/${result.digest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                {isMockMode() ? "View tx" : "View transaction"} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>,
        );
        setTimeout(() => fetchOrders(), 2000);
      } else {
        toast.error(`Match failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Match error:", error);
      toast.error("Failed to execute match");
    } finally {
      setIsMatching(false);
      setPreviewCandidate(null);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_hsla(220,50%,20%,0.3)_0%,_transparent_70%)] pointer-events-none" />

      <main className="relative pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-6 mb-8">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-semibold text-[hsl(var(--foreground))]">Order</h1>
                <span className="text-4xl font-semibold text-[hsl(var(--muted-foreground))]">Book</span>
              </div>
              <div className="flex items-center gap-2">
                {address && (
                  <Button
                    variant="outline"
                    onClick={handleFindMatch}
                    disabled={isMatching}
                    className="cursor-pointer border-[hsl(var(--primary))/20] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/10]"
                  >
                    <Zap className={`w-4 h-4 mr-2 ${isMatching ? 'animate-spin' : ''}`} />
                    {isMatching ? "Matching..." : "Auto-Match"}
                  </Button>
                )}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="cursor-pointer bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
                    <Plus className="w-4 h-4 mr-2" />
                    New Order
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] bg-[hsl(var(--card))] border-[hsl(var(--border))]">
                  <DialogHeader>
                    <DialogTitle className="text-[hsl(var(--foreground))]">Create New Order</DialogTitle>
                  </DialogHeader>
                  <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "lend" | "borrow")}>
                    <TabsList className="mb-4 w-full bg-[hsl(var(--secondary))]">
                      <TabsTrigger value="lend" className="flex-1 cursor-pointer">Lend</TabsTrigger>
                      <TabsTrigger value="borrow" className="flex-1 cursor-pointer">Borrow</TabsTrigger>
                    </TabsList>
                    <TabsContent value="lend">
                      <CreateOrderForm 
                        type="lend" 
                        onSubmit={handleOrderSubmit} 
                        isSubmitting={isSubmitting}
                      />
                    </TabsContent>
                    <TabsContent value="borrow">
                      <CreateOrderForm 
                        type="borrow" 
                        onSubmit={handleOrderSubmit}
                        isSubmitting={isSubmitting}
                      />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                <EyeOff className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                <span className="text-xs text-[hsl(var(--foreground))]">ZK Hidden Orders</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                <Shield className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                <span className="text-xs text-[hsl(var(--foreground))]">AI Fair Matching</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                <Zap className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                <span className="text-xs text-[hsl(var(--foreground))]">~400ms Finality</span>
              </div>
            </div>

            <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-2xl">
              Central limit order book for DeFi lending. Place custom orders with ZK privacy protection, 
              get AI-verified fair matching via Nautilus, and experience fast finality on Sui.
            </p>

            {lastTxDigest && (
              <a
                href={isMockMode() ? "#" : `https://suiscan.xyz/testnet/tx/${lastTxDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1 mt-2"
              >
                Last transaction: {lastTxDigest.slice(0, 16)}... <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Market Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-b border-[hsl(var(--border))]">
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Bid Volume</p>
              <div className="flex items-baseline gap-1">
                <TrendingUp className="w-4 h-4 text-[hsl(var(--success))] mr-1" />
                <span className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                  ${formatNumber(totalLendVolume)}
                </span>
              </div>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{lendOrders.length} orders</span>
            </div>
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Ask Volume</p>
              <div className="flex items-baseline gap-1">
                <TrendingDown className="w-4 h-4 text-[hsl(var(--destructive))] mr-1" />
                <span className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                  ${formatNumber(totalBorrowVolume)}
                </span>
              </div>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{borrowOrders.length} orders</span>
            </div>
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Avg Lend Rate</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-[hsl(var(--success))]">
                  {avgLendRate.toFixed(2)}
                </span>
                <span className="text-lg text-[hsl(var(--success))]">%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">Avg Borrow Rate</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-[hsl(var(--warning))]">
                  {avgBorrowRate.toFixed(2)}
                </span>
                <span className="text-lg text-[hsl(var(--warning))]">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Book Table - Exchange Style */}
        <div className="mb-8">
          <OrderbookTable
            bids={lendOrders}
            asks={borrowOrders}
            isLoading={isLoadingOrders}
          />
        </div>

        {/* User Orders with Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-transparent border-b border-[hsl(var(--border))] rounded-none p-0 h-auto mb-6">
            <TabsTrigger
              value="all"
              className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              All Orders
            </TabsTrigger>
            <TabsTrigger
              value="lend"
              className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              Lend Orders
            </TabsTrigger>
            <TabsTrigger
              value="borrow"
              className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              Borrow Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <OrdersTable
              orders={orders}
              title="All Orders"
              emptyMessage="No orders yet. Create your first order to start lending or borrowing."
            />
          </TabsContent>

          <TabsContent value="lend">
            <OrdersTable
              orders={lendOrders}
              title="Lend Orders"
              emptyMessage="No lend orders yet"
            />
          </TabsContent>

          <TabsContent value="borrow">
            <OrdersTable
              orders={borrowOrders}
              title="Borrow Orders"
              emptyMessage="No borrow orders yet"
            />
          </TabsContent>
        </Tabs>

        {/* How It Works Section - Cleaned up */}
        <div className="mt-12 p-6 bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))]">
          <h3 className="text-base font-medium text-[hsl(var(--foreground))] mb-6">How DeepBook-Style Matching Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/20 flex items-center justify-center shrink-0">
                <EyeOff className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <div>
                <h4 className="font-medium text-[hsl(var(--foreground))] mb-1">Place Orders</h4>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Set your rate, LTV, and term with optional ZK privacy protection
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--success))]/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[hsl(var(--success))]" />
              </div>
              <div>
                <h4 className="font-medium text-[hsl(var(--foreground))] mb-1">AI Fair Matching</h4>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Nautilus AI ensures fair matching with priority for retail users
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--warning))]/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <h4 className="font-medium text-[hsl(var(--foreground))] mb-1">Fast Finality</h4>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Orders matched on-chain via Mysticeti with ~400ms finality
                </p>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={isPreviewOpen} onOpenChange={(open) => { setIsPreviewOpen(open); if (!open) setPreviewCandidate(null); }}>
          <DialogContent className="sm:max-w-[520px] bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <DialogHeader>
              <DialogTitle className="text-[hsl(var(--foreground))]">Match Preview</DialogTitle>
            </DialogHeader>
            {previewCandidate && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[hsl(var(--border))] p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">Lender</div>
                    <div className="font-mono text-xs truncate">{previewCandidate.lend.creator || "—"}</div>
                    <div className="mt-1">{formatNumber(previewCandidate.lend.amount)} {previewCandidate.lend.asset}</div>
                    <div className="text-xs">@ {previewCandidate.lend.interestRate.toFixed(2)}% • {previewCandidate.lend.term}d</div>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--border))] p-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">Borrower</div>
                    <div className="font-mono text-xs truncate">{previewCandidate.borrow.creator || "—"}</div>
                    <div className="mt-1">{formatNumber(previewCandidate.borrow.amount)} {previewCandidate.borrow.asset}</div>
                    <div className="text-xs">@ {previewCandidate.borrow.interestRate.toFixed(2)}% • {previewCandidate.borrow.term}d</div>
                  </div>
                </div>
                <div className="rounded-lg border border-[hsl(var(--border))] p-3 space-y-1">
                  <div className="flex justify-between"><span>Composite score</span><span className="font-mono">{(previewCandidate.score * 100).toFixed(1)} / 100</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Size fit</span><span>{(previewCandidate.breakdown.sizeFit * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Duration fit</span><span>{(previewCandidate.breakdown.durationFit * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Rate spread</span><span>{(previewCandidate.breakdown.rateGap * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Age priority</span><span>{(previewCandidate.breakdown.age * 100).toFixed(0)}%</span></div>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  On-chain settlement signs the (lend, borrow, score) tuple via the registered Nautilus enclave.
                  If the enclave call fails the match is aborted and you can retry.
                </p>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => { setIsPreviewOpen(false); setPreviewCandidate(null); }} disabled={isMatching}>Cancel</Button>
                  <Button onClick={handleConfirmMatch} disabled={isMatching}>
                    {isMatching ? "Submitting..." : "Confirm Match"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
