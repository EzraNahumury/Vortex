"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Shield, Sparkles, Loader2 } from "lucide-react";
import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { useWallet } from "@/components/providers";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";

interface VestingDepositFormProps {
  onSubmit: (data: {
    amount: number;
    lockDuration: number;
  }) => void;
  isSubmitting?: boolean;
}

export function VestingDepositForm({ onSubmit, isSubmitting = false }: VestingDepositFormProps) {
  const { address, isConnected } = useWallet();
  const [amount, setAmount] = useState("");
  const [lockDuration, setLockDuration] = useState("90");
  const [suiBalance, setSuiBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Fetch user's SUI balance when connected
  useEffect(() => {
    if (isConnected && address) {
      setIsLoadingBalance(true);
      fetchUserCoins(address, getCoinType("SUI")).then((coins) => {
        const total = coins.reduce((acc, coin) => acc + coin.balance, 0);
        setSuiBalance(total);
        setIsLoadingBalance(false);
      });
    } else {
      setSuiBalance(0);
    }
  }, [isConnected, address]);

  const subsidyRate = parseInt(lockDuration) >= 365 ? 3.5 : parseInt(lockDuration) >= 180 ? 2.5 : parseInt(lockDuration) >= 90 ? 1.5 : 0.5;
  const baseApy = 4.5;
  const totalApy = baseApy + subsidyRate;
  const projectedEarnings = parseFloat(amount || "0") * (totalApy / 100) * (parseInt(lockDuration) / 365);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    if (parseFloat(amount) > suiBalance) {
      return;
    }

    onSubmit({
      amount: parseFloat(amount),
      lockDuration: parseInt(lockDuration),
    });
  };

  const handleMaxClick = () => {
    if (suiBalance > 0) {
      setAmount(suiBalance.toString());
    }
  };

  const isValidAmount = parseFloat(amount || "0") > 0 && parseFloat(amount || "0") <= suiBalance;

  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[hsl(var(--accent))]/20 flex items-center justify-center">
          <Lock className="w-6 h-6 text-[hsl(var(--accent))]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Lock Vested Tokens</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Earn subsidy yield by locking your SUI
          </p>
        </div>
      </div>

      <div className="p-4 bg-[hsl(var(--secondary))] rounded-xl mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Available SUI Balance</span>
          <span className="text-lg font-semibold text-[hsl(var(--foreground))]">
            {isLoadingBalance ? "..." : formatNumber(suiBalance)} SUI
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
            Amount to Lock
          </label>
          <div className="relative">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pr-16 bg-[hsl(var(--secondary))] border-none"
            />
            {isConnected && suiBalance > 0 && (
              <button
                type="button"
                onClick={handleMaxClick}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--primary))] cursor-pointer hover:underline"
              >
                MAX
              </button>
            )}
          </div>
          {parseFloat(amount || "0") > suiBalance && suiBalance > 0 && (
            <p className="text-xs text-[hsl(var(--destructive))] mt-1">
              Amount exceeds your balance
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
            Lock Duration
          </label>
          <Select value={lockDuration} onValueChange={setLockDuration}>
            <SelectTrigger className="w-full bg-[hsl(var(--secondary))] border-none cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days (+0.5% APY)</SelectItem>
              <SelectItem value="90">90 days (+1.5% APY)</SelectItem>
              <SelectItem value="180">180 days (+2.5% APY)</SelectItem>
              <SelectItem value="365">1 year (+3.5% APY)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 bg-[hsl(var(--secondary))] rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Base APY</span>
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
              {formatPercentage(baseApy)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[hsl(var(--accent))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Subsidy Bonus</span>
            </div>
            <span className="text-sm font-medium text-[hsl(var(--accent))]">
              +{formatPercentage(subsidyRate)}
            </span>
          </div>
          <div className="pt-3 border-t border-[hsl(var(--border))]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Total APY</span>
              <span className="text-lg font-bold text-[hsl(var(--primary))]">
                {formatPercentage(totalApy)}
              </span>
            </div>
          </div>
        </div>

        {parseFloat(amount || "0") > 0 && isValidAmount && (
          <div className="p-4 bg-[hsl(var(--primary))]/10 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Projected Earnings</span>
              <span className="text-lg font-bold text-[hsl(var(--primary))]">
                +{formatNumber(projectedEarnings)} SUI
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 p-4 bg-[hsl(var(--success))]/10 rounded-xl">
          <Shield className="w-5 h-5 text-[hsl(var(--success))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Vested tokens are verified with ZK proofs for priority matching
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !isConnected || !isValidAmount}
          className="w-full cursor-pointer bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Locking...
            </>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : (
            "Lock Vested Tokens"
          )}
        </Button>
      </form>
    </div>
  );
}
