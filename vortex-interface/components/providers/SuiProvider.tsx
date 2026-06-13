"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { 
  SuiClientProvider, 
  WalletProvider, 
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { isMockMode, env } from "@/lib/config";
import "@mysten/dapp-kit/dist/index.css";

// Network configurations - including required 'network' property
const networks = {
  testnet: { url: "https://fullnode.testnet.sui.io:443", network: "testnet" as const },
  mainnet: { url: "https://fullnode.mainnet.sui.io:443", network: "mainnet" as const },
  devnet: { url: "https://fullnode.devnet.sui.io:443", network: "devnet" as const },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// Simple wallet context for backward compatibility
interface WalletContextValue {
  isConnected: boolean;
  address: string | null;
  suiBalance: number;
  isConnecting: boolean;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  isConnected: false,
  address: null,
  suiBalance: 0,
  isConnecting: false,
  refreshBalance: async () => {},
});

export function useWallet() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [suiBalance, setSuiBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchBalance = useCallback(async (userAddress: string) => {
    if (isMockMode()) {
      setSuiBalance(50000);
      return;
    }

    try {
      const balance = await suiClient.getBalance({
        owner: userAddress,
        coinType: "0x2::sui::SUI",
      });
      setSuiBalance(Number(balance.totalBalance) / 1_000_000_000);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      setSuiBalance(0);
    }
  }, [suiClient]);

  const refreshBalance = useCallback(async () => {
    if (account?.address) {
      await fetchBalance(account.address);
    }
  }, [account?.address, fetchBalance]);

  useEffect(() => {
    if (account?.address) {
      fetchBalance(account.address);
    } else {
      setSuiBalance(0);
    }
  }, [account?.address, fetchBalance]);

  return {
    isConnected: !!account,
    address: account?.address || null,
    suiBalance,
    isConnecting,
    refreshBalance,
  };
}

// Inner provider that has access to dapp-kit hooks
function WalletContextProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  
  // Sync wallet address with store and fetch data on connect
  useEffect(() => {
    // Dynamic import to avoid circular dependencies
    import("@/lib/store").then(({ useAppStore }) => {
      const store = useAppStore.getState();
      const currentStoreAddress = store.walletAddress;
      const newAddress = wallet.address;
      
      // If wallet connected/changed, update store and fetch data
      if (newAddress && newAddress !== currentStoreAddress) {
        store.setWalletAddress(newAddress);
        // Fetch data for the connected wallet
        Promise.all([
          store.fetchOrders(),
          store.fetchPositions(),
          store.fetchVestingPositions(),
          store.fetchMarketData(),
        ]).catch(console.error);
      } else if (!newAddress && currentStoreAddress) {
        // Wallet disconnected
        store.disconnectWallet();
      }
    });
  }, [wallet.address]);
  
  return (
    <WalletContext.Provider value={wallet}>
      <TransactionExecutorSetup />
      {children}
    </WalletContext.Provider>
  );
}

// Setup transaction executor callback
function TransactionExecutorSetup() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  
  useEffect(() => {
    // Import dynamically to avoid circular dependencies
    import("@/lib/sui/transaction-executor").then(({ setSignAndExecuteCallback }) => {
      setSignAndExecuteCallback(async (tx) => {
        const result = await signAndExecute({
          transaction: tx,
        });
        return {
          digest: result.digest,
          effects: result.effects,
        };
      });
    });
    
    return () => {
      import("@/lib/sui/transaction-executor").then(({ setSignAndExecuteCallback }) => {
        setSignAndExecuteCallback(null);
      });
    };
  }, [signAndExecute]);
  
  return null;
}

// Export the context hook for components that need it
export function useWalletContext() {
  return useContext(WalletContext);
}

interface SuiProviderProps {
  children: ReactNode;
}

export function SuiProvider({ children }: SuiProviderProps) {
  const network = env.sui.network as "testnet" | "mainnet" | "devnet";
  
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork={network}>
        <WalletProvider autoConnect>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
