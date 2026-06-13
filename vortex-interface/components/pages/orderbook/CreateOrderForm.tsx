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
import { Switch } from "@/components/ui/switch";
import { EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { getCoinType, getDecimalsForAsset } from "@/lib/sui/blockchain-service";

interface CreateOrderFormProps {
  type: "lend" | "borrow";
  onSubmit: (order: {
    asset: string;
    amount: number;
    interestRate: number;
    ltv: number;
    term: number;
    isHidden: boolean;
    coinObjectId?: string;
    collateralAmount?: number;
    collateral?: string; // Primary collateral asset for the transaction
    collateralCoinId?: string; // Coin object ID for non-SUI collateral
    collaterals?: { asset: string; amount: number }[];
  }) => void;
  isSubmitting?: boolean;
}

export function CreateOrderForm({ type, onSubmit, isSubmitting = false }: CreateOrderFormProps) {
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [collateralAmounts, setCollateralAmounts] = useState<{ [key: string]: string }>({
    SUI: "",
    ETH: "",
    USDC: "",
  });
  
  const [interestRate, setInterestRate] = useState([4.5]);
  const [ltv, setLtv] = useState([70]);
  const [term, setTerm] = useState("30");
  const [isHidden, setIsHidden] = useState(false);
  
  // Balance info
  const [assetBalance, setAssetBalance] = useState<number>(0);
  const [balances, setBalances] = useState<{ [key: string]: number }>({
    SUI: 0,
    ETH: 0,
    USDC: 0,
  });
  const [coinObjectId, setCoinObjectId] = useState<string | undefined>(undefined);
  
  // Collateral coin object IDs for non-SUI collateral
  const [collateralCoinIds, setCollateralCoinIds] = useState<{ [key: string]: string | undefined }>({
    SUI: undefined, // Not needed, split from gas
    ETH: undefined,
    USDC: undefined,
  }); 

  const suiClient = useSuiClient();
  const account = useCurrentAccount();

  // Fetch balances and coin objects
  useEffect(() => {
    const fetchInfo = async () => {
      if (!account?.address) return;
      
      try {
        // 1. Fetch Asset Balance (USDC/SUI)
        if (asset === "SUI") {
          const bal = await suiClient.getBalance({ owner: account.address, coinType: "0x2::sui::SUI" });
          setAssetBalance(Number(bal.totalBalance) / 1_000_000_000);
        } else {
          const coinType = getCoinType(asset);
          const coins = await suiClient.getCoins({ owner: account.address, coinType });
          const decimals = getDecimalsForAsset(asset);
          const total = coins.data.reduce((acc, c) => acc + (Number(c.balance) / Math.pow(10, decimals)), 0);
          setAssetBalance(total);
        }

        // 2. Fetch All Balances and Coin Object IDs
        const suiBal = await suiClient.getBalance({ owner: account.address, coinType: "0x2::sui::SUI" });
        const newBalances = { ...balances };
        const newCoinIds: { [key: string]: string | undefined } = { SUI: undefined, ETH: undefined, USDC: undefined };
        
        newBalances.SUI = Number(suiBal.totalBalance) / 1_000_000_000;
        
        // Fetch USDC and its coin object ID
        try {
            const usdcCoins = await suiClient.getCoins({ owner: account.address, coinType: getCoinType("USDC") });
            newBalances.USDC = usdcCoins.data.reduce((acc, c) => acc + (Number(c.balance) / 1_000_000), 0);
            // Get the coin with highest balance
            let maxBal = 0;
            for (const coin of usdcCoins.data) {
              const bal = Number(coin.balance) / 1_000_000;
              if (bal > maxBal) {
                maxBal = bal;
                newCoinIds.USDC = coin.coinObjectId;
              }
            }
        } catch {}

        // Fetch ETH and its coin object ID
        try {
            const ethCoins = await suiClient.getCoins({ owner: account.address, coinType: getCoinType("ETH") });
            newBalances.ETH = ethCoins.data.reduce((acc, c) => acc + (Number(c.balance) / 100_000_000), 0);
            // Get the coin with highest balance
            let maxBal = 0;
            for (const coin of ethCoins.data) {
              const bal = Number(coin.balance) / 100_000_000;
              if (bal > maxBal) {
                maxBal = bal;
                newCoinIds.ETH = coin.coinObjectId;
              }
            }
        } catch {}

        setBalances(newBalances);
        setCollateralCoinIds(newCoinIds);
        
        // Update asset balance based on selection
        setAssetBalance(newBalances[asset as keyof typeof newBalances] || 0);

        // 3. Determine Coin Object ID for Lend orders
        let targetCoinType = "";
        let targetDecimals = 9;
        
        if (type === "lend") {
          if (asset === "SUI") {
            setCoinObjectId(undefined); // SUI split from gas
          } else {
            targetCoinType = getCoinType(asset);
            targetDecimals = getDecimalsForAsset(asset);
          }
        } else {
          // Borrow: collateral coin IDs already fetched above
          setCoinObjectId(undefined); 
        }

        if (targetCoinType) {
           const coins = await suiClient.getCoins({ owner: account.address, coinType: targetCoinType });
           let bestCoinId = undefined;
           let maxBalance = 0;
           const divisor = Math.pow(10, targetDecimals);
           
           for (const coin of coins.data) {
             const bal = Number(coin.balance) / divisor;
             if (bal > maxBalance) {
               maxBalance = bal;
               bestCoinId = coin.coinObjectId;
             }
           }
           setCoinObjectId(bestCoinId);
        }

      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchInfo();
  }, [asset, type, account?.address, suiClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    const amountNum = parseFloat(amount);

    if (type === "lend") {
      if (amountNum > assetBalance) {
        toast.error(`Insufficient ${asset} balance`);
        return;
      }
      if (asset !== "SUI" && !coinObjectId) {
        toast.error(`No suitable ${asset} coin found. Please mint some tokens.`);
        return;
      }
    } else {
      // Borrow Check
      // Calculate total collateral value
      const prices = { SUI: 1.5, ETH: 3000, USDC: 1 }; // Mock prices
      let totalCollateralValue = 0;
      let hasCollateral = false;

      for (const [coin, amt] of Object.entries(collateralAmounts)) {
          const val = parseFloat(amt || "0");
          if (val > 0) {
              if (val > balances[coin]) {
                  toast.error(`Insufficient ${coin} balance`);
                  return;
              }
              // Prevent borrowing same asset as collateral (basic check)
              if (coin === asset) {
                  toast.error(`Cannot use ${coin} as collateral for ${coin} loan`);
                  return;
              }
              totalCollateralValue += val * prices[coin as keyof typeof prices];
              hasCollateral = true;
          }
      }

      if (!hasCollateral) {
          toast.error("Please add at least one collateral amount");
          return;
      }
    }

    // Proxy logic: Convert total collateral value to "SUI equivalent" for the backend MVP
    // In reality, we would send a vector of coins or create a multi-collateral position.
    // For this mock/hackathon interface, we treat the amount as the aggregated value.
    const prices = { SUI: 1.5, ETH: 3000, USDC: 1 };
    let totalCollateralValue = 0;
    for (const [coin, amt] of Object.entries(collateralAmounts)) {
        totalCollateralValue += parseFloat(amt || "0") * prices[coin as keyof typeof prices];
    }

    const collateralsList = Object.entries(collateralAmounts)
        .filter(([_, amt]) => parseFloat(amt || "0") > 0)
        .map(([asset, amt]) => ({ asset, amount: parseFloat(amt) }));

    // Determine primary collateral (the one with the highest value)
    // This is used for selecting the correct Market<Asset, Collateral> on-chain
    let primaryCollateral = "SUI"; // default
    let primaryCollateralAmount = 0;
    
    for (const [coin, amt] of Object.entries(collateralAmounts)) {
      const amtNum = parseFloat(amt || "0");
      const value = amtNum * prices[coin as keyof typeof prices];
      if (value > primaryCollateralAmount) {
        primaryCollateralAmount = value;
        primaryCollateral = coin;
      }
    }

    // Calculate collateral amount in primary collateral's units
    const collateralAmountInPrimary = parseFloat(collateralAmounts[primaryCollateral] || "0");

    onSubmit({
      asset,
      amount: amountNum,
      interestRate: interestRate[0],
      ltv: ltv[0],
      term: parseInt(term),
      isHidden,
      coinObjectId,
      collateralAmount: type === 'borrow' ? collateralAmountInPrimary : undefined,
      collateral: type === 'borrow' ? primaryCollateral : undefined,
      collateralCoinId: type === 'borrow' && primaryCollateral !== 'SUI' 
        ? collateralCoinIds[primaryCollateral] 
        : undefined,
      collaterals: type === 'borrow' ? collateralsList : undefined,
    });
  };

  // Safe parsers for display
  const borrowAmountVal = parseFloat(amount || "0");
  const mockPrices = { SUI: 1.5, ETH: 3000, USDC: 1 };
  let totalCollateralValue = 0;
  let activeCollateralsCount = 0;
  
  if (type === "borrow") {
      Object.entries(collateralAmounts).forEach(([coin, amt]) => {
          const val = parseFloat(amt || "0");
          if (val > 0) {
              totalCollateralValue += val * mockPrices[coin as keyof typeof mockPrices];
              activeCollateralsCount++;
          }
      });
  }
  
  const impliedLTV = totalCollateralValue > 0 
    ? ((borrowAmountVal * mockPrices[asset as keyof typeof mockPrices]) / totalCollateralValue) * 100 
    : 0;

  // Calculate "Borrow Power" / AI Match Score
  // Base score 50. +10 per additional collateral type. +High Value bonus.
  const borrowPower = Math.min(99, 50 + (activeCollateralsCount * 15) + (impliedLTV < 60 ? 15 : 0));
  const borrowPowerColor = borrowPower > 80 ? "bg-[hsl(var(--success))]" : borrowPower > 60 ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--destructive))]";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          {type === "lend" ? "Asset to Lend" : "Asset to Borrow"}
        </label>
        <Select value={asset} onValueChange={setAsset}>
          <SelectTrigger className="w-full bg-[hsl(var(--secondary))] border-none cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USDC">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src="/token/usdc.png" alt="USDC" fill sizes="20px" className="object-cover" />
                </div>
                <span>USDC (Mock)</span>
              </div>
            </SelectItem>
            <SelectItem value="SUI">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src="/token/sui.png" alt="SUI" fill sizes="20px" className="object-cover" />
                </div>
                <span>SUI</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {type === "lend" && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 text-right">
            Balance: {assetBalance.toLocaleString()} {asset}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          {type === "lend" ? "Lend Amount" : "Borrow Amount"}
        </label>
        <div className="relative">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="pr-16 bg-[hsl(var(--secondary))] border-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--muted-foreground))]">
            {asset}
          </span>
        </div>
      </div>

      {type === "borrow" && (
        <div className="space-y-4 border border-[hsl(var(--border))] rounded-xl p-4 bg-[hsl(var(--card))]/50">
          <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                Multi-Collateral
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Borrow Power</span>
                <div className="w-16 h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${borrowPowerColor} transition-all duration-500`} 
                        style={{ width: `${borrowPower}%` }}
                    />
                </div>
              </div>
          </div>
          
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Add multiple assets to increase your borrowing power and AI match score.
          </p>

          {["SUI", "ETH", "USDC"].map((coin) => (
             coin !== asset && (
                <div key={coin} className="space-y-1">
                    <div className="flex justify-between text-xs">
                        <span className="text-[hsl(var(--foreground))]">{coin}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">Bal: {balances[coin]?.toLocaleString() ?? 0}</span>
                    </div>
                    <div className="relative">
                        <Input
                            type="number"
                            value={collateralAmounts[coin]}
                            onChange={(e) => setCollateralAmounts(prev => ({ ...prev, [coin]: e.target.value }))}
                            placeholder="0.00"
                            className="pr-12 bg-[hsl(var(--secondary))] border-none h-9 text-sm"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full overflow-hidden">
                             <Image src={`/token/${coin.toLowerCase()}.png`} alt={coin} fill className="object-cover" />
                        </div>
                    </div>
                </div>
             )
          ))}
          
          <div className="pt-2 border-t border-[hsl(var(--border))] flex justify-between items-center text-sm">
             <span className="text-[hsl(var(--muted-foreground))]">Total Value</span>
             <span className="text-[hsl(var(--foreground))] font-medium">${totalCollateralValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            {type === "lend" ? "Min Interest Rate" : "Max Interest Rate"}
          </label>
          <span className="text-sm font-medium text-[hsl(var(--primary))]">
            {interestRate[0].toFixed(2)}%
          </span>
        </div>
        <Slider
          value={interestRate}
          onValueChange={setInterestRate}
          min={1}
          max={15}
          step={0.1}
          className="cursor-pointer"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">
            {type === "lend" ? "Max LTV" : "Target LTV"}
          </label>
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {ltv[0]}%
          </span>
        </div>
        <Slider
          value={ltv}
          onValueChange={setLtv}
          min={30}
          max={90}
          step={5}
          className="cursor-pointer"
        />
        {type === "borrow" && (
           <div className="mt-2 text-right space-y-1">
             <p className="text-xs text-[hsl(var(--muted-foreground))]">
               Implied LTV: <span className={impliedLTV > 80 ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--success))]"}>{impliedLTV.toFixed(2)}%</span>
             </p>
             {activeCollateralsCount > 0 && (
                <p className="text-[10px] text-[hsl(var(--primary))] flex items-center justify-end gap-1">
                    <Shield className="w-3 h-3" /> AI Enhanced Matching Active
                </p>
             )}
           </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
          Term Duration
        </label>
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-full bg-[hsl(var(--secondary))] border-none cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="14">14 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between p-4 bg-[hsl(var(--secondary))] rounded-xl">
        <div className="flex items-center gap-3">
          <EyeOff className="w-5 h-5 text-[hsl(var(--primary))]" />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">ZK Hidden Order</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Keep your order private until matched
            </p>
          </div>
        </div>
        <Switch
          checked={isHidden}
          onCheckedChange={setIsHidden}
          className="cursor-pointer"
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full cursor-pointer bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : `Place ${type === "lend" ? "Lend" : "Borrow"} Order`}
      </Button>
    </form>
  );
}
