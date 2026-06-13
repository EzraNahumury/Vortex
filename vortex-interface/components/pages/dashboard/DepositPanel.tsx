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
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

  // Fetch user's balance for the asset
  useEffect(() => {
    if (isConnected && address) {
      setIsLoadingBalance(true);
      fetchUserCoins(address, getCoinType(asset)).then((coins) => {
        const total = coins.reduce((acc, coin) => acc + coin.balance, 0);
        setUserBalance(total);
        setIsLoadingBalance(false);
      });
    } else {
      setUserBalance(0);
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
      const result = await executeCreateOrder({
        type: "lend",
        asset: asset,
        amount: amount,
        interestRate: rate,
        ltv: 75, // Default safe LTV preference
        term: days,
        isHidden: false, // Default public for dashboard quick action
        coinObjectId: "0x...coin", 
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
        fetchUserCoins(address, getCoinType(asset)).then((coins) => {
            const total = coins.reduce((acc, coin) => acc + coin.balance, 0);
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
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-medium text-[hsl(var(--foreground))]">Deposit {asset}</h3>
          <div className="relative w-8 h-8 rounded-full overflow-hidden">
            <Image 
              src={`/token/${asset.toLowerCase()}.png`} 
              alt={asset} 
              fill 
              className="object-cover" 
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="text-2xl font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
            />
            {isConnected && userBalance > 0 && (
              <button
                type="button"
                onClick={handleMaxClick}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--primary))] hover:underline cursor-pointer px-2 py-1 rounded bg-[hsl(var(--secondary))]"
              >
                MAX
              </button>
            )}
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Balance: {isLoadingBalance ? "..." : formatNumber(userBalance)} {asset}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex gap-4">
             <div className="flex-1 space-y-1">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">APY (%)</label>
                <Input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="bg-[hsl(var(--secondary))]/50 border-0"
                />
             </div>
             <div className="flex-1 space-y-1">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">Duration (Days)</label>
                <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="bg-[hsl(var(--secondary))]/50 border-0"
                />
             </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" />
              <span className="text-sm text-[hsl(var(--foreground))]">Lending Amount</span>
            </div>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">{formatNumber(amount)} {asset}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Est. Returns (Total)</span>
            <span className="text-sm font-medium text-[hsl(var(--success))]">+{formatNumber(projectedEarnings)} {asset}</span>
          </div>
        </div>
      </div>

      {isConnected ? (
        <Button
          onClick={handleLend}
          disabled={amount <= 0 || amount > userBalance || isDepositing}
          className="w-full h-12 cursor-pointer rounded-2xl bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]/90 font-medium disabled:opacity-50"
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
          className="w-full h-12 cursor-pointer rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 font-medium"
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
