"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";
import { toast } from "sonner";
import { executeCreateOrder } from "@/lib/sui/transaction-executor";
import { isMockMode } from "@/lib/config";

interface DepositPanelProps {
  asset: string;
  balance?: number; // Optional as we fetch it inside too
  apy: number;
}

export function DepositPanel({ asset, apy }: DepositPanelProps) {
  const { connectWallet, isConnecting, addOrder } = useAppStore();
  const { address, isConnected } = useWallet();
  const [depositAmount, setDepositAmount] = useState("");
  const [interestRate, setInterestRate] = useState(apy.toString());
  const [duration, setDuration] = useState("30");
  const [userBalance, setUserBalance] = useState(0);
  const [coins, setCoins] = useState<{ objectId: string; balance: number }[]>([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

  // Fetch user's balance for the asset
  useEffect(() => {
    if (isConnected && address) {
      setIsLoadingBalance(true);
      fetchUserCoins(address, getCoinType(asset)).then((fetched) => {
        setCoins(fetched);
        const total = fetched.reduce((acc, coin) => acc + coin.balance, 0);
        setUserBalance(total);
        setIsLoadingBalance(false);
      });
    } else {
      setUserBalance(0);
      setCoins([]);
    }
  }, [isConnected, address, asset]);

  const amount = parseFloat(depositAmount || "0");
  const rate = parseFloat(interestRate || "0");
  const days = parseInt(duration || "0");
  
  // Calculate earnings based on the specific duration input
  const projectedEarnings = amount * (rate / 100) * (days / 365);

  const handleMaxClick = () => {
    if (userBalance > 0) {
      setDepositAmount(userBalance.toString());
    }
  };

  const handleLend = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    if (amount <= 0 || isNaN(amount)) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (amount > userBalance) {
      toast.error("Insufficient balance");
      return;
    }
    if (rate <= 0 || isNaN(rate)) {
      toast.error("Please enter a valid interest rate");
      return;
    }
    if (days <= 0 || isNaN(days)) {
        toast.error("Please enter a valid duration");
        return;
    }

    setIsDepositing(true);
    toast.loading("Creating lending position...");

    try {
      // Real mode needs a concrete coin object to split the lend amount from.
      // Mirror the orderbook/predict pattern: use the largest coin, split exact inside the tx.
      let coinObjectId = "0x...coin";
      if (!isMockMode()) {
        const top = [...coins].sort((a, b) => b.balance - a.balance)[0];
        if (!top) {
          toast.dismiss();
          toast.error(`No ${asset} coins found in wallet`);
          setIsDepositing(false);
          return;
        }
        coinObjectId = top.objectId;
      }

      const result = await executeCreateOrder({
        type: "lend",
        asset: asset,
        amount: amount,
        interestRate: rate,
        ltv: 75, // Default safe LTV preference
        term: days,
        isHidden: false, // Default public for dashboard quick action
        coinObjectId,
        collateralAmount: 0 // Not needed for lend
      }, address);

      if (result.success) {
        toast.dismiss();
        toast.success(`Lending position created for ${formatNumber(amount)} ${asset}`);
        
        // Optimistically update store
        addOrder({
            id: result.digest || `temp-${Date.now()}`,
            creator: address,
            type: "lend",
            asset: asset,
            amount: amount,
            interestRate: rate,
            status: "pending",
            createdAt: new Date().toISOString(),
            ltv: 75,
            term: days,
            isHidden: false,
        });
        
        setDepositAmount("");
        // Refresh balance
        fetchUserCoins(address, getCoinType(asset)).then((fetched) => {
            setCoins(fetched);
            const total = fetched.reduce((acc, coin) => acc + coin.balance, 0);
            setUserBalance(total);
        });

      } else {
        toast.dismiss();
        toast.error(`Failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Lend error:", error);
      toast.dismiss();
      toast.error("Failed to create position");
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Quick Lend</span>
            <h3 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">Deposit {asset}</h3>
          </div>
          <div className="relative w-9 h-9 rounded-full overflow-hidden ring-1 ring-[hsl(var(--border))]">
            <Image
              src={`/token/${asset.toLowerCase()}.png`}
              alt={asset}
              fill
              className="object-cover"
            />
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] px-4 py-3.5">
          <div className="relative">
            <Input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="text-2xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
            />
            {isConnected && userBalance > 0 && (
              <button
                type="button"
                onClick={handleMaxClick}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-semibold text-[hsl(var(--primary))] cursor-pointer px-2.5 py-1 rounded-full border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary))]/10 hover:bg-[hsl(var(--primary))]/20 transition-colors"
              >
                MAX
              </button>
            )}
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">
            Balance: {isLoadingBalance ? "..." : formatNumber(userBalance)} {asset}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex gap-4">
             <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">APY (%)</label>
                <Input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="bg-white/[0.02] border border-[hsl(var(--border))]"
                />
             </div>
             <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Duration (Days)</label>
                <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="bg-white/[0.02] border border-[hsl(var(--border))]"
                />
             </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Lending Amount</span>
              </div>
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">{formatNumber(amount)} {asset}</span>
            </div>

            <div className="flex items-center justify-between border-t border-[hsl(var(--border))]/60 pt-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Est. Returns (Total)</span>
              <span className="text-sm font-semibold text-[hsl(var(--success))]">+{formatNumber(projectedEarnings)} {asset}</span>
            </div>
          </div>
        </div>
      </div>

      {isConnected ? (
        <Button
          onClick={handleLend}
          disabled={amount <= 0 || amount > userBalance || isDepositing}
          className="w-full h-12 cursor-pointer rounded-full bg-[hsl(var(--success))] text-white hover:brightness-110 font-semibold disabled:opacity-50 transition"
        >
          {isDepositing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Position...
            </>
          ) : (
            "Create Lending Position"
          )}
        </Button>
      ) : (
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full h-12 cursor-pointer rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110 font-semibold transition"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect Wallet"
          )}
        </Button>
      )}
    </div>
  );
}
