export type AppMode = "mock" | "real";

export interface EnvConfig {
  appMode: AppMode;
  sui: {
    network: "mainnet" | "testnet" | "devnet";
    rpcUrl: string;
    packageId: string;
    registryId: string;
    vestingVaultId: string;
    marketId: string;
    usdcAdminCapId?: string;
    ethAdminCapId?: string;
    // Legacy aliases
    orderbookPackageId: string;
    loanObjectPackageId: string;
    vestingVaultPackageId: string;
  };
  zkLogin: {
    googleClientId: string;
    redirectUrl: string;
    enokiApiKey: string;
  };
  priceOracle: "pyth" | "supra";
  features: {
    zkOrders: boolean;
    aiMatching: boolean;
    vestingVault: boolean;
  };
  matching: {
    minFairnessScore: number;
  };
}

export const env: EnvConfig = {
  appMode: (process.env.NEXT_PUBLIC_APP_MODE as AppMode) || "mock",
  sui: {
    network: (process.env.NEXT_PUBLIC_SUI_NETWORK as "mainnet" | "testnet" | "devnet") || "testnet",
    rpcUrl: process.env.NEXT_PUBLIC_SUI_RPC_URL || "https://fullnode.testnet.sui.io:443",
    packageId: process.env.NEXT_PUBLIC_PACKAGE_ID || "",
    registryId: process.env.NEXT_PUBLIC_REGISTRY_ID || "",
    vestingVaultId: process.env.NEXT_PUBLIC_VESTING_VAULT_ID || "",
    marketId: process.env.NEXT_PUBLIC_MARKET_ID || "",
    // New optional admin caps for faucet
    usdcAdminCapId: process.env.NEXT_PUBLIC_USDC_ADMIN_CAP_ID || "",
    ethAdminCapId: process.env.NEXT_PUBLIC_ETH_ADMIN_CAP_ID || "",
    // Legacy aliases for backward compatibility
    orderbookPackageId: process.env.NEXT_PUBLIC_ORDERBOOK_PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID || "",
    loanObjectPackageId: process.env.NEXT_PUBLIC_LOAN_OBJECT_PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID || "",
    vestingVaultPackageId: process.env.NEXT_PUBLIC_VESTING_VAULT_PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID || "",
  },
  zkLogin: {
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    redirectUrl: process.env.NEXT_PUBLIC_REDIRECT_URL || "http://localhost:3000/auth/callback",
    enokiApiKey: process.env.NEXT_PUBLIC_ENOKI_API_KEY || "",
  },
  priceOracle: (process.env.NEXT_PUBLIC_PRICE_ORACLE as "pyth" | "supra") || "pyth",
  features: {
    zkOrders: process.env.NEXT_PUBLIC_ENABLE_ZK_ORDERS === "true",
    aiMatching: process.env.NEXT_PUBLIC_ENABLE_AI_MATCHING === "true",
    vestingVault: process.env.NEXT_PUBLIC_ENABLE_VESTING_VAULT === "true",
  },
  matching: {
    minFairnessScore: Number(process.env.NEXT_PUBLIC_MIN_FAIRNESS_SCORE ?? "0"),
  },
};

export const isMockMode = (): boolean => env.appMode === "mock";
export const isRealMode = (): boolean => env.appMode === "real";

// Contract module paths
export const MODULES = {
  REGISTRY: `${env.sui.packageId}::registry`,
  MARKET: `${env.sui.packageId}::market`,
  LOAN: `${env.sui.packageId}::loan`,
  VESTING: `${env.sui.packageId}::vesting`,
  MOCK_COINS: `${env.sui.packageId}::mock_coins`,
} as const;
