"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowRight, Shield, Loader2 } from "lucide-react";
import { formatNumber, formatPercentage } from "@/lib/utils/format";
import Image from "next/image";
import { useWallet } from "@/components/providers";
import { fetchUserCoins, fetchBlockchainPrices } from "@/lib/sui/blockchain-service";
import type { PriceData } from "@/lib/types";

// Asset configuration for multi-collateral support (from Blueprint)
const ASSET_CONFIG = {
  SUI: { maxLtv: 75, liquidationThreshold: 85, decimals: 9, logo: "/token/sui.png" },
  USDC: { maxLtv: 90, liquidationThreshold: 95, decimals: 6, logo: "/token/usdc.png" },
  ETH: { maxLtv: 70, liquidationThreshold: 80, decimals: 8, logo: "/token/eth.png" },
};

type AssetType = keyof typeof ASSET_CONFIG;

interface BorrowFormProps {
  onSubmit: (data: {
    collateralAsset: string;
    collateralAmount: number;
    collateralCoinId: string;
    borrowAsset: string;
    borrowAmount: number;
    ltv: number;
  }) => void;
  isSubmitting?: boolean;
}

export function BorrowForm({ onSubmit, isSubmitting = false }: BorrowFormProps) {
  const { address, isConnected } = useWallet();
  const [collateralAsset, setCollateralAsset] = useState<AssetType>("SUI");
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAsset, setBorrowAsset] = useState<AssetType>("USDC");
  const [ltv, setLtv] = useState([65]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [userCoins, setUserCoins] = useState<{ objectId: string; balance: number }[]>([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);

  // Fetch prices on mount
  useEffect(() => {
    fetchBlockchainPrices().then(setPrices);
  }, []);

  // Fetch user coins when connected and collateral asset changes
  useEffect(() => {
    if (isConnected && address) {
      setIsLoadingCoins(true);
      fetchUserCoins(address).then((coins) => {
        setUserCoins(coins);
        setIsLoadingCoins(false);
      });
    }
  }, [isConnected, address, collateralAsset]);

  const getPrice = (asset: string) => {
    const priceData = prices.find(p => p.asset === asset);
    return priceData?.price || 0;
  };

  const collateralConfig = ASSET_CONFIG[collateralAsset];
  const collateralPrice = getPrice(collateralAsset);
  const maxLtvForAsset = collateralConfig?.maxLtv || 75;
  const collateralValue = parseFloat(collateralAmount || "0") * collateralPrice;
  const maxBorrow = collateralValue * (ltv[0] / 100);
  const liquidationPrice = maxBorrow / (parseFloat(collateralAmount || "1") * (collateralConfig?.liquidationThreshold / 100 || 0.8));

  const healthFactor = ltv[0] < 50 ? "healthy" : ltv[0] < 70 ? "moderate" : "risky";
  const totalBalance = userCoins.reduce((acc, coin) => acc + coin.balance, 0);

  const handleCollateralChange = (asset: string) => {
    setCollateralAsset(asset as AssetType);
    // Reset LTV if it exceeds max for new asset
    const newMaxLtv = ASSET_CONFIG[asset as AssetType]?.maxLtv || 75;
    if (ltv[0] > newMaxLtv) {
      setLtv([newMaxLtv - 10]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      return;
    }

    // Find the first coin with sufficient balance
    const selectedCoin = userCoins.find(coin => coin.balance >= parseFloat(collateralAmount));
    
    onSubmit({
      collateralAsset,
      collateralAmount: parseFloat(collateralAmount),
      collateralCoinId: selectedCoin?.objectId || "",
      borrowAsset,
      borrowAmount: maxBorrow,
      ltv: ltv[0],
    });
  };

  const handleMaxClick = () => {
    if (totalBalance > 0) {
      setCollateralAmount(totalBalance.toString());
    }
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl shadow-[0_24px_70px_-40px_rgba(0,0,0,0.85)]">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Create Position</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
          Borrow
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Collateral
            </label>
            {isConnected && (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Balance: {isLoadingCoins ? "..." : formatNumber(totalBalance)} {collateralAsset}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Select value={collateralAsset} onValueChange={handleCollateralChange}>
              <SelectTrigger className="w-[140px] bg-[hsl(var(--secondary))] border-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ASSET_CONFIG) as AssetType[]).map((asset) => (
                  <SelectItem key={asset} value={asset}>
                    <div className="flex items-center gap-2">
                      <div className="relative w-5 h-5 rounded-full overflow-hidden">
                        <Image src={ASSET_CONFIG[asset].logo} alt={asset} fill sizes="20px" className="object-cover" />
                      </div>
                      <span>{asset}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 relative">
              <Input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                placeholder="0.00"
                className="bg-[hsl(var(--secondary))] border-none pr-16"
              />
              {isConnected && totalBalance > 0 && (
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--primary))] hover:underline cursor-pointer"
                >
                  MAX
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
            Value: <span className="font-medium text-[hsl(var(--foreground))]">${formatNumber(collateralValue)}</span>
          </p>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[hsl(var(--border))]" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.1)]">
            <ArrowRight className="h-5 w-5 rotate-90 text-[hsl(var(--primary))]" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
            Borrow
          </label>
          <div className="flex gap-3">
            <Select value={borrowAsset} onValueChange={(v) => setBorrowAsset(v as AssetType)}>
              <SelectTrigger className="w-[140px] bg-[hsl(var(--secondary))] border-none cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ASSET_CONFIG) as AssetType[]).map((asset) => (
                  <SelectItem key={asset} value={asset}>
                    <div className="flex items-center gap-2">
                      <div className="relative w-5 h-5 rounded-full overflow-hidden">
                        <Image src={ASSET_CONFIG[asset].logo} alt={asset} fill sizes="20px" className="object-cover" />
                      </div>
                      <span>{asset}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-1 items-center rounded-md border border-[hsl(var(--border))] bg-white/[0.02] px-4 py-2">
              <span className="font-semibold text-[hsl(var(--foreground))]">
                {formatNumber(maxBorrow)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">
              Loan-to-Value (LTV)
            </label>
            <span className={`text-sm font-medium ${
              healthFactor === "healthy" 
                ? "text-[hsl(var(--success))]" 
                : healthFactor === "moderate"
                ? "text-[hsl(var(--warning))]"
                : "text-[hsl(var(--destructive))]"
            }`}>
              {ltv[0]}%
            </span>
          </div>
          <Slider
            value={ltv}
            onValueChange={setLtv}
            min={20}
            max={maxLtvForAsset}
            step={5}
            className="cursor-pointer"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-[hsl(var(--success))]">Safe</span>
            <span className="text-xs text-[hsl(var(--warning))]">Moderate</span>
            <span className="text-xs text-[hsl(var(--destructive))]">Risky</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Liquidation Price</span>
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              ${formatNumber(liquidationPrice)}
            </span>
          </div>
          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Max LTV ({collateralAsset})</span>
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {maxLtvForAsset}%
            </span>
          </div>
          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Health Factor</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              healthFactor === "healthy"
                ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
                : healthFactor === "moderate"
                ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
                : "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                healthFactor === "healthy"
                  ? "bg-[hsl(var(--success))]"
                  : healthFactor === "moderate"
                  ? "bg-[hsl(var(--warning))]"
                  : "bg-[hsl(var(--destructive))]"
              }`} />
              {healthFactor === "healthy" ? "Healthy" : healthFactor === "moderate" ? "Moderate" : "At Risk"}
            </span>
          </div>
        </div>

        {healthFactor === "risky" && (
          <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[hsl(var(--destructive))]" />
            <p className="text-sm text-[hsl(var(--destructive))]">
              High LTV increases liquidation risk
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)] p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.15)]">
            <Shield className="h-4 w-4 text-[hsl(var(--primary))]" />
          </span>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Orders matched via AI fairness scoring for best rates
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !isConnected || !collateralAmount || parseFloat(collateralAmount) <= 0}
          className="w-full cursor-pointer rounded-full bg-[hsl(var(--primary))] py-5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Position...
            </>
          ) : !isConnected ? (
            "Connect Wallet"
          ) : (
            "Create Borrow Position"
          )}
        </Button>
      </form>
    </div>
  );
}
