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
import { useCurrentAccount } from "@mysten/dapp-kit";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";
import { isMockMode } from "@/lib/config";

// Demo balance used in mock mode so the lock flow is exercisable without a funded wallet.
const MOCK_SUI_BALANCE = 50000;

interface VestingDepositFormProps {
  onSubmit: (data: {
    amount: number;
    lockDuration: number;
  }) => void;
  isSubmitting?: boolean;
}

export function VestingDepositForm({ onSubmit, isSubmitting = false }: VestingDepositFormProps) {
  const { address, isConnected } = useWallet();
  const account = useCurrentAccount();
  const [amount, setAmount] = useState("");
  const [lockDuration, setLockDuration] = useState("90");
  const [suiBalance, setSuiBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Fetch user's SUI balance. A real connected wallet always shows its real balance; only the
  // synthetic mock wallet (browsing without a wallet in mock mode) uses a demo balance.
  useEffect(() => {
    if (account?.address) {
      setIsLoadingBalance(true);
      fetchUserCoins(account.address, getCoinType("SUI"))
        .then((coins) => {
          const total = (coins ?? []).reduce((acc, coin) => acc + (coin?.balance ?? 0), 0);
          setSuiBalance(total);
        })
        .catch((err) => {
          console.error("Failed to fetch SUI balance:", err);
          setSuiBalance(0);
        })
        .finally(() => {
          setIsLoadingBalance(false);
        });
      return;
    }
    if (isMockMode()) {
      setSuiBalance(MOCK_SUI_BALANCE);
      setIsLoadingBalance(false);
      return;
    }
    setSuiBalance(0);
  }, [account?.address]);

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
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl shadow-[0_24px_70px_-30px_rgba(0,0,0,0.8)]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary)/0.25)]">
          <Lock className="h-6 w-6 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Lock Vested Tokens</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Earn subsidy yield by locking your SUI
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Available SUI Balance</span>
          <span className="text-lg font-bold text-[hsl(var(--foreground))]">
            {isLoadingBalance ? "..." : formatNumber(suiBalance)} SUI
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
            Amount to Lock
          </label>
          <div className="relative">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="border-[hsl(var(--border))] bg-white/[0.02] pr-16"
            />
            {isConnected && suiBalance > 0 && (
              <button
                type="button"
                onClick={handleMaxClick}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-sm font-semibold text-[hsl(var(--primary))] hover:underline"
              >
                MAX
              </button>
            )}
          </div>
          {parseFloat(amount || "0") > suiBalance && suiBalance > 0 && (
            <p className="mt-1.5 text-xs text-[hsl(var(--destructive))]">
              Amount exceeds your balance
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
            Lock Duration
          </label>
          <Select value={lockDuration} onValueChange={setLockDuration}>
            <SelectTrigger className="w-full cursor-pointer border-[hsl(var(--border))] bg-white/[0.02]">
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

        <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Base APY</span>
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
              {formatPercentage(baseApy)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Subsidy Bonus</span>
            </div>
            <span className="text-sm font-medium text-[hsl(var(--primary))]">
              +{formatPercentage(subsidyRate)}
            </span>
          </div>
          <div className="border-t border-[hsl(var(--border))] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">Total APY</span>
              <span className="text-xl font-bold text-[hsl(var(--primary))]">
                {formatPercentage(totalApy)}
              </span>
            </div>
          </div>
        </div>

        {parseFloat(amount || "0") > 0 && isValidAmount && (
          <div className="rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary))]/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Projected Earnings</span>
              <span className="text-xl font-bold text-[hsl(var(--primary))]">
                +{formatNumber(projectedEarnings)} SUI
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success))]/10 p-4">
          <Shield className="h-5 w-5 shrink-0 text-[hsl(var(--success))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Vested tokens are verified with ZK proofs for priority matching
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !isConnected || !isValidAmount}
          className="w-full cursor-pointer rounded-full bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
