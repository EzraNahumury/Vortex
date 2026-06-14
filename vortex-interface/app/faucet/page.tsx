"use client";

import { useState, useEffect } from "react";
import { Navbar, AppBackground } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/providers";
import { fetchUserCoins, getCoinType } from "@/lib/sui/blockchain-service";
import { executeMintToken } from "@/lib/sui/transaction-executor";
import { formatNumber } from "@/lib/utils/format";
import { Loader2, ExternalLink, Droplets, Wallet, Sparkles, ShieldCheck } from "lucide-react";
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

  const fetchBalances = async (targetAddress?: string | null) => {
    const account = targetAddress ?? address;
    if (!account) return;

    const newBalances: Record<string, number> = {};

    // Fetch SUI balance (guard against unexpected throws)
    try {
      const suiCoins = await fetchUserCoins(account, getCoinType("SUI"));
      newBalances["SUI"] = suiCoins.reduce((acc, coin) => acc + coin.balance, 0);
    } catch (e) {
      console.error("Failed to fetch SUI balance", e);
      newBalances["SUI"] = 0;
    }

    // Fetch other tokens
    for (const token of FAUCET_TOKENS) {
      setLoadingMap(prev => ({ ...prev, [token.symbol]: true }));
      try {
        const coins = await fetchUserCoins(account, getCoinType(token.symbol));
        newBalances[token.symbol] = coins.reduce((acc, coin) => acc + coin.balance, 0);
      } catch (e) {
        console.error(`Failed to fetch ${token.symbol} balance`, e);
        newBalances[token.symbol] = 0;
      } finally {
        setLoadingMap(prev => ({ ...prev, [token.symbol]: false }));
      }
    }

    setBalances(newBalances);
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchBalances(address);
    } else {
      setBalances({});
      setLoadingMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setTimeout(() => fetchBalances(address), 2000);
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
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] font-display">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* ============================ HEADER ============================ */}
        <div className="mb-12 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            <span className="lp-muted uppercase">Sui Testnet · No real value</span>
          </div>

          <div className="relative mx-auto mb-6 inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--primary))]/20 blur-xl" />
            <div className="relative inline-flex items-center justify-center rounded-2xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary))]/10 p-4 lp-float-sm">
              <Droplets className="h-8 w-8 text-[hsl(var(--primary))]" />
            </div>
          </div>

          <h1 className="text-[clamp(34px,5vw,56px)] font-bold leading-[1.02] text-[hsl(var(--foreground))]">
            Token <span className="text-[hsl(var(--primary))]">Faucet.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Get mock tokens to test the Vortex protocol on Sui Testnet.
            These tokens have no real value.
          </p>
        </div>

        {/* ============================= CARDS ============================= */}
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* SUI Card (Info only) */}
          <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                <Image src="/token/sui.png" alt="SUI" width={48} height={48} />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                <Sparkles className="h-3 w-3 text-[hsl(var(--primary))]" />
                Gas Token
              </span>
            </div>

            <div className="mb-1 text-xl font-bold text-[hsl(var(--foreground))]">SUI</div>
            <p className="mb-5 text-sm text-[hsl(var(--muted-foreground))]">Sui Network Token</p>

            <div className="flex-1 space-y-4">
              <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Your Balance</div>
                <div className="mt-1 text-2xl font-bold text-[hsl(var(--foreground))]">
                   {isConnected ? formatNumber(balances["SUI"] || 0) : "—"}{" "}
                   <span className="text-base font-semibold text-[hsl(var(--muted-foreground))]">SUI</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                To get SUI testnet tokens, use the faucet in your wallet or the official Sui Discord.
              </p>
            </div>

            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full gap-2 cursor-pointer rounded-full"
                onClick={() => window.open('https://discord.gg/sui', '_blank')}
              >
                Get SUI on Discord <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mock Tokens */}
          {FAUCET_TOKENS.map((token) => (
            <div
              key={token.symbol}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]"
            >
              {/* subtle neon top accent */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.5)] to-transparent opacity-0 transition group-hover:opacity-100" />

              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                  <Image src={token.logo} alt={token.symbol} width={48} height={48} />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  <ShieldCheck className="h-3 w-3 text-[hsl(var(--primary))]" />
                  Test Token
                </span>
              </div>

              <div className="mb-1 text-xl font-bold text-[hsl(var(--foreground))]">{token.symbol}</div>
              <p className="mb-5 text-sm text-[hsl(var(--muted-foreground))]">{token.name}</p>

              <div className="flex-1 space-y-4">
                <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Your Balance</div>
                  <div className="mt-1 text-2xl font-bold text-[hsl(var(--foreground))]">
                    {loadingMap[token.symbol] ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      isConnected ? formatNumber(balances[token.symbol] || 0) : "—"
                    )}{" "}
                    <span className="text-base font-semibold text-[hsl(var(--muted-foreground))]">{token.symbol}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary))]/10 p-3.5">
                  <Wallet className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                  <span className="text-sm font-medium text-[hsl(var(--primary))]">
                    Mint Amount: {formatNumber(token.mintAmount)} {token.symbol}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  className="w-full cursor-pointer rounded-full bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110"
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
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
