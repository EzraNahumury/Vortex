"use client";

import { useEffect, useState } from "react";
import { Navbar, AppBackground } from "@/components/shared";
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
  const { orders, isLoadingOrders, fetchOrders, addOrder, cancelOrder, vestingPositions } = useAppStore();
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

  const handleCancelOrder = (orderId: string) => {
    cancelOrder(orderId);
    toast.success("Order cancelled");
  };

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
    <div className="relative min-h-screen bg-[hsl(var(--background))] overflow-x-clip">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-8 mb-10">
          <div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-6">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
                  <span className="text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Central Limit Order Book</span>
                </div>
                <h1 className="font-display text-[clamp(36px,6vw,60px)] font-bold leading-[0.98]">
                  Order<span className="text-[hsl(var(--primary))]">book</span>
                </h1>
              </div>
              <div className="flex items-center gap-2.5">
                {address && (
                  <Button
                    variant="outline"
                    onClick={handleFindMatch}
                    disabled={isMatching}
                    className="cursor-pointer rounded-full border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.15)]"
                  >
                    <Zap className={`w-4 h-4 mr-2 ${isMatching ? 'animate-spin' : ''}`} />
                    {isMatching ? "Matching..." : "Auto-Match"}
                  </Button>
                )}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="cursor-pointer rounded-full bg-[hsl(var(--primary))] px-5 font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110">
                    <Plus className="w-4 h-4 mr-2" />
                    New Order
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle className="text-[hsl(var(--foreground))]">Create New Order</DialogTitle>
                  </DialogHeader>
                  <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "lend" | "borrow")}>
                    <TabsList className="mb-4 w-full rounded-full bg-[hsl(var(--secondary))] p-1">
                      <TabsTrigger value="lend" className="flex-1 cursor-pointer rounded-full">Lend</TabsTrigger>
                      <TabsTrigger value="borrow" className="flex-1 cursor-pointer rounded-full">Borrow</TabsTrigger>
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

            <div className="flex flex-wrap items-center gap-2.5 mb-5">
              <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-1.5 text-xs">
                <EyeOff className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                <span className="text-[hsl(var(--foreground))]">ZK Hidden Orders</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-1.5 text-xs">
                <Shield className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                <span className="text-[hsl(var(--foreground))]">AI Fair Matching</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-1.5 text-xs">
                <Zap className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                <span className="text-[hsl(var(--foreground))]">~400ms Finality</span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))] max-w-2xl">
              Central limit order book for DeFi lending. Place custom orders with ZK privacy protection,
              get AI-verified fair matching via Nautilus, and experience fast finality on Sui.
            </p>

            {lastTxDigest && (
              <a
                href={isMockMode() ? "#" : `https://suiscan.xyz/testnet/tx/${lastTxDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1 mt-3"
              >
                Last transaction: {lastTxDigest.slice(0, 16)}... <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Market Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Bid Volume</p>
              <div className="flex items-baseline gap-1.5">
                <TrendingUp className="w-4 h-4 text-[hsl(var(--success))] self-center" />
                <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
                  ${formatNumber(totalLendVolume)}
                </span>
              </div>
              <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{lendOrders.length} orders</span>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Ask Volume</p>
              <div className="flex items-baseline gap-1.5">
                <TrendingDown className="w-4 h-4 text-[hsl(var(--destructive))] self-center" />
                <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
                  ${formatNumber(totalBorrowVolume)}
                </span>
              </div>
              <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{borrowOrders.length} orders</span>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Avg Lend Rate</p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold text-[hsl(var(--success))]">
                  {avgLendRate.toFixed(2)}
                </span>
                <span className="text-lg font-semibold text-[hsl(var(--success))]">%</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Avg Borrow Rate</p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold text-[hsl(var(--warning))]">
                  {avgBorrowRate.toFixed(2)}
                </span>
                <span className="text-lg font-semibold text-[hsl(var(--warning))]">%</span>
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
          <TabsList className="bg-transparent border-b border-[hsl(var(--border))] rounded-none p-0 h-auto mb-6 gap-1">
            <TabsTrigger
              value="all"
              className="cursor-pointer rounded-none border-b-2 border-transparent text-[hsl(var(--muted-foreground))] data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
            >
              All Orders
            </TabsTrigger>
            <TabsTrigger
              value="lend"
              className="cursor-pointer rounded-none border-b-2 border-transparent text-[hsl(var(--muted-foreground))] data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
            >
              Lend Orders
            </TabsTrigger>
            <TabsTrigger
              value="borrow"
              className="cursor-pointer rounded-none border-b-2 border-transparent text-[hsl(var(--muted-foreground))] data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
            >
              Borrow Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <OrdersTable
              orders={orders}
              title="All Orders"
              emptyMessage="No orders yet. Create your first order to start lending or borrowing."
              onCancel={handleCancelOrder}
            />
          </TabsContent>

          <TabsContent value="lend">
            <OrdersTable
              orders={lendOrders}
              title="Lend Orders"
              emptyMessage="No lend orders yet"
              onCancel={handleCancelOrder}
            />
          </TabsContent>

          <TabsContent value="borrow">
            <OrdersTable
              orders={borrowOrders}
              title="Borrow Orders"
              emptyMessage="No borrow orders yet"
              onCancel={handleCancelOrder}
            />
          </TabsContent>
        </Tabs>

        {/* How It Works Section */}
        <div className="mt-14 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-6 sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <span className="text-xs font-semibold text-[hsl(var(--primary))]">HOW IT WORKS</span>
            <span className="h-px flex-1 bg-[hsl(var(--border))]" />
          </div>
          <h3 className="font-display text-2xl font-bold text-[hsl(var(--foreground))] mb-8">
            DeepBook-style <span className="text-[hsl(var(--primary))]">matching.</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group rounded-2xl border border-[hsl(var(--border))] bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[hsl(var(--primary)/0.15)] flex items-center justify-center shrink-0">
                  <EyeOff className="w-5 h-5 text-[hsl(var(--primary))]" />
                </div>
                <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">01</span>
              </div>
              <h4 className="font-semibold text-[hsl(var(--foreground))] mb-1.5">Place Orders</h4>
              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                Set your rate, LTV, and term with optional ZK privacy protection
              </p>
            </div>
            <div className="group rounded-2xl border border-[hsl(var(--border))] bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[hsl(var(--success)/0.15)] flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-[hsl(var(--success))]" />
                </div>
                <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">02</span>
              </div>
              <h4 className="font-semibold text-[hsl(var(--foreground))] mb-1.5">AI Fair Matching</h4>
              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                Nautilus AI ensures fair matching with priority for retail users
              </p>
            </div>
            <div className="group rounded-2xl border border-[hsl(var(--border))] bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[hsl(var(--warning)/0.15)] flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-[hsl(var(--warning))]" />
                </div>
                <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">03</span>
              </div>
              <h4 className="font-semibold text-[hsl(var(--foreground))] mb-1.5">Fast Finality</h4>
              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                Orders matched on-chain via Mysticeti with ~400ms finality
              </p>
            </div>
          </div>
        </div>

        <Dialog open={isPreviewOpen} onOpenChange={(open) => { setIsPreviewOpen(open); if (!open) setPreviewCandidate(null); }}>
          <DialogContent className="sm:max-w-[520px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-[hsl(var(--foreground))]">Match Preview</DialogTitle>
            </DialogHeader>
            {previewCandidate && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.06)] p-4">
                    <div className="text-xs uppercase tracking-wider text-[hsl(var(--success))]">Lender</div>
                    <div className="mt-1 font-mono text-xs truncate text-[hsl(var(--muted-foreground))]">{previewCandidate.lend.creator || "—"}</div>
                    <div className="mt-2 text-base font-semibold text-[hsl(var(--foreground))]">{formatNumber(previewCandidate.lend.amount)} {previewCandidate.lend.asset}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">@ {previewCandidate.lend.interestRate.toFixed(2)}% • {previewCandidate.lend.term}d</div>
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.06)] p-4">
                    <div className="text-xs uppercase tracking-wider text-[hsl(var(--warning))]">Borrower</div>
                    <div className="mt-1 font-mono text-xs truncate text-[hsl(var(--muted-foreground))]">{previewCandidate.borrow.creator || "—"}</div>
                    <div className="mt-2 text-base font-semibold text-[hsl(var(--foreground))]">{formatNumber(previewCandidate.borrow.amount)} {previewCandidate.borrow.asset}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">@ {previewCandidate.borrow.interestRate.toFixed(2)}% • {previewCandidate.borrow.term}d</div>
                  </div>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4 space-y-2">
                  <div className="flex justify-between items-baseline"><span className="text-[hsl(var(--muted-foreground))]">Composite score</span><span className="font-mono text-lg font-bold text-[hsl(var(--primary))]">{(previewCandidate.score * 100).toFixed(1)} / 100</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Size fit</span><span className="font-mono text-[hsl(var(--foreground))]">{(previewCandidate.breakdown.sizeFit * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Duration fit</span><span className="font-mono text-[hsl(var(--foreground))]">{(previewCandidate.breakdown.durationFit * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Rate spread</span><span className="font-mono text-[hsl(var(--foreground))]">{(previewCandidate.breakdown.rateGap * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>Age priority</span><span className="font-mono text-[hsl(var(--foreground))]">{(previewCandidate.breakdown.age * 100).toFixed(0)}%</span></div>
                </div>
                <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                  On-chain settlement signs the (lend, borrow, score) tuple via the registered Nautilus enclave.
                  If the enclave call fails the match is aborted and you can retry.
                </p>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" className="rounded-full" onClick={() => { setIsPreviewOpen(false); setPreviewCandidate(null); }} disabled={isMatching}>Cancel</Button>
                  <Button className="rounded-full bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110" onClick={handleConfirmMatch} disabled={isMatching}>
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
