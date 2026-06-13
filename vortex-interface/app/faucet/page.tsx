"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useWallet } from "@/components/providers";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";
import { executeMintToken } from "@/lib/sui/transaction-executor";
import { formatNumber } from "@/lib/utils/format";
import { Loader2, ExternalLink, Droplets, Wallet } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

const FAUCET_TOKENS = [
  { symbol: "USDC", name: "USD Coin (Mock)", logo: "/token/usdc.png", mintAmount: 1000 },
  { symbol: "ETH", name: "Ethereum (Mock)", logo: "/token/eth.png", mintAmount: 10 },
];

export default function FaucetPage() {
  const { address, isConnected } = useWallet();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [mintingMap, setMintingMap] = useState<Record<string, boolean>>({});

  const fetchBalances = async () => {
    if (!address) return;
    
    const newBalances: Record<string, number> = {};
    
    // Fetch SUI balance
    const suiCoins = await fetchUserCoins(address, getCoinType("SUI"));
    newBalances["SUI"] = suiCoins.reduce((acc, coin) => acc + coin.balance, 0);

    // Fetch other tokens
    for (const token of FAUCET_TOKENS) {
      setLoadingMap(prev => ({ ...prev, [token.symbol]: true }));
      try {
        const coins = await fetchUserCoins(address, getCoinType(token.symbol));
        newBalances[token.symbol] = coins.reduce((acc, coin) => acc + coin.balance, 0);
      } catch (e) {
        console.error(`Failed to fetch ${token.symbol} balance`, e);
      } finally {
        setLoadingMap(prev => ({ ...prev, [token.symbol]: false }));
      }
    }
    
    setBalances(newBalances);
  };

  useEffect(() => {
    if (isConnected) {
      fetchBalances();
    } else {
      setBalances({});
    }
  }, [isConnected, address]);

  const handleMint = async (tokenSymbol: string, amount: number) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setMintingMap(prev => ({ ...prev, [tokenSymbol]: true }));

    try {
      const result = await executeMintToken(tokenSymbol, amount, address);

      if (result.success) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Successfully minted {amount} {tokenSymbol}</span>
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
        // Refresh balances after a short delay
        setTimeout(fetchBalances, 2000);
      } else {
        toast.error(result.error || `Failed to mint ${tokenSymbol}`);
      }
    } catch (error) {
      console.error("Mint error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setMintingMap(prev => ({ ...prev, [tokenSymbol]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_hsla(220,50%,20%,0.3)_0%,_transparent_70%)] pointer-events-none" />

      <main className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[hsl(var(--primary))]/10 mb-4">
            <Droplets className="w-8 h-8 text-[hsl(var(--primary))]" />
          </div>
          <h1 className="text-4xl font-bold text-[hsl(var(--foreground))] mb-4">Token Faucet</h1>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Get mock tokens to test the Vortex protocol on Sui Testnet.
            These tokens have no real value.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* SUI Card (Info only) */}
          <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))] overflow-hidden flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--secondary))] flex items-center justify-center overflow-hidden">
                  <Image src="/token/sui.png" alt="SUI" width={40} height={40} />
                </div>
                <div className="px-2.5 py-0.5 rounded-full bg-[hsl(var(--secondary))] text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Gas Token
                </div>
              </div>
              <CardTitle className="text-xl">SUI</CardTitle>
              <CardDescription>Sui Network Token</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="p-4 rounded-xl bg-[hsl(var(--secondary))]/50 space-y-1">
                <div className="text-sm text-[hsl(var(--muted-foreground))]">Your Balance</div>
                <div className="text-2xl font-semibold">
                   {isConnected ? formatNumber(balances["SUI"] || 0) : "—"} SUI
                </div>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                To get SUI testnet tokens, use the faucet in your wallet or the official Sui Discord.
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full gap-2 cursor-pointer"
                onClick={() => window.open('https://discord.gg/sui', '_blank')}
              >
                Get SUI on Discord <ExternalLink className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>

          {/* Mock Tokens */}
          {FAUCET_TOKENS.map((token) => (
            <Card key={token.symbol} className="bg-[hsl(var(--card))] border-[hsl(var(--border))] overflow-hidden flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-full bg-[hsl(var(--secondary))] flex items-center justify-center overflow-hidden">
                    <Image src={token.logo} alt={token.symbol} width={40} height={40} />
                  </div>
                  <div className="px-2.5 py-0.5 rounded-full bg-[hsl(var(--secondary))] text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    Test Token
                  </div>
                </div>
                <CardTitle className="text-xl">{token.symbol}</CardTitle>
                <CardDescription>{token.name}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="p-4 rounded-xl bg-[hsl(var(--secondary))]/50 space-y-1">
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">Your Balance</div>
                  <div className="text-2xl font-semibold">
                    {loadingMap[token.symbol] ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      isConnected ? formatNumber(balances[token.symbol] || 0) : "—"
                    )} {token.symbol}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20">
                  <Wallet className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <span className="text-sm text-[hsl(var(--primary))] font-medium">
                    Mint Amount: {formatNumber(token.mintAmount)} {token.symbol}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full cursor-pointer bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                  disabled={!isConnected || mintingMap[token.symbol]}
                  onClick={() => handleMint(token.symbol, token.mintAmount)}
                >
                  {mintingMap[token.symbol] ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Minting...
                    </>
                  ) : !isConnected ? (
                    "Connect Wallet"
                  ) : (
                    "Mint Tokens"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
