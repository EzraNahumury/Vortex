"use client";

import { 
  ConnectButton as DappKitConnectButton,
  useCurrentAccount,
  useDisconnectWallet,
} from "@mysten/dapp-kit";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, Copy, LogOut, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { isMockMode } from "@/lib/config";

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const suiClient = useSuiClient();
  const { connectWallet, disconnectWallet, user } = useAppStore();
  const [suiBalance, setSuiBalance] = useState(0);

  // Fetch balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!account?.address) {
        setSuiBalance(0);
        return;
      }
      
      if (isMockMode()) {
        setSuiBalance(50000);
        return;
      }

      try {
        const balance = await suiClient.getBalance({
          owner: account.address,
          coinType: "0x2::sui::SUI",
        });
        setSuiBalance(Number(balance.totalBalance) / 1_000_000_000);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setSuiBalance(0);
      }
    };

    fetchBalance();
  }, [account?.address, suiClient]);

  // Sync with app store
  useEffect(() => {
    if (account?.address && !user?.isConnected) {
      connectWallet();
    } else if (!account?.address && user?.isConnected) {
      disconnectWallet();
    }
  }, [account?.address, user?.isConnected, connectWallet, disconnectWallet]);

  const handleDisconnect = () => {
    disconnect();
    disconnectWallet();
    toast.success("Wallet disconnected");
  };

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      toast.success("Address copied to clipboard");
    }
  };

  const openExplorer = () => {
    if (account?.address) {
      window.open(`https://suiscan.xyz/testnet/account/${account.address}`, "_blank");
    }
  };

  if (account?.address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="cursor-pointer h-9 px-4 rounded-full text-sm border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/50 hover:bg-[hsl(var(--secondary))]"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {formatAddress(account.address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-[hsl(var(--card))] border-[hsl(var(--border))]"
        >
          <div className="px-3 py-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Balance</p>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              {suiBalance.toLocaleString()} SUI
            </p>
          </div>
          <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
          <DropdownMenuItem
            onClick={copyAddress}
            className="cursor-pointer text-[hsl(var(--foreground))] focus:bg-[hsl(var(--secondary))]"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={openExplorer}
            className="cursor-pointer text-[hsl(var(--foreground))] focus:bg-[hsl(var(--secondary))]"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Explorer
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
          <DropdownMenuItem
            onClick={handleDisconnect}
            className="cursor-pointer text-[hsl(var(--destructive))] focus:bg-[hsl(var(--secondary))]"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Use dapp-kit's built-in connect button with custom styling
  return (
    <DappKitConnectButton 
      connectText={
        <>
          <Wallet className="w-4 h-4 mr-2" />
          Connect Wallet
        </>
      }
    />
  );
}
