import type {
  Order,
  Position,
  Vault,
  VestingPosition,
  MarketStats,
  MarketExposure,
  ChartDataPoint,
  User,
  PriceData,
} from "@/lib/types";

export const mockStats: MarketStats = {
  totalValueLocked: 245890000,
  totalLoans: 15234,
  averageApy: 4.21,
  activeUsers: 8942,
  totalMatched: 12890000,
  fairnessScore: 94,
  volume24h: 5420000,
};

export const mockOrders: Order[] = [
  {
    id: "order-1",
    type: "lend",
    asset: "USDC",
    amount: 50000,
    interestRate: 4.5,
    ltv: 75,
    term: 30,
    status: "pending",
    createdAt: "2026-02-05T10:00:00Z",
    isHidden: true,
    fairnessScore: 92,
    zkProofHash: "0x1234...abcd",
  },
  {
    id: "order-2",
    type: "borrow",
    asset: "SUI",
    amount: 10000,
    interestRate: 5.2,
    ltv: 65,
    term: 14,
    status: "matched",
    createdAt: "2026-02-04T15:30:00Z",
    matchedAt: "2026-02-04T15:45:00Z",
    isHidden: false,
    fairnessScore: 88,
  },
  {
    id: "order-3",
    type: "lend",
    asset: "USDC",
    amount: 25000,
    interestRate: 4.2,
    ltv: 70,
    term: 60,
    status: "active",
    createdAt: "2026-02-03T09:15:00Z",
    matchedAt: "2026-02-03T10:00:00Z",
    isHidden: false,
    fairnessScore: 95,
  },
  {
    id: "order-4",
    type: "borrow",
    asset: "USDC",
    amount: 15000,
    interestRate: 5.5,
    ltv: 60,
    term: 30,
    status: "pending",
    createdAt: "2026-02-06T11:20:00Z",
    isHidden: false,
    fairnessScore: 89,
    collaterals: [
      { asset: "SUI", amount: 10000 },
      { asset: "ETH", amount: 2 }
    ]
  },
];

export const mockPositions: Position[] = [
  {
    id: "pos-1",
    type: "lending",
    asset: "USDC",
    amount: 100000,
    interestRate: 4.8,
    ltv: 70,
    term: 30,
    startDate: "2026-01-15T00:00:00Z",
    endDate: "2026-02-14T00:00:00Z",
    earnedInterest: 1234.56,
    status: "active",
  },
  {
    id: "pos-2",
    type: "borrowing",
    asset: "SUI",
    amount: 25000,
    interestRate: 5.5,
    ltv: 60,
    term: 14,
    startDate: "2026-02-01T00:00:00Z",
    endDate: "2026-02-15T00:00:00Z",
    paidInterest: 234.12,
    status: "active",
    collateralAsset: "USDC", // Legacy/Primary
    collateralAmount: 45000,
    liquidationPrice: 0.72,
    collaterals: [
      { asset: "USDC", amount: 45000 }
    ]
  },
  {
    id: "pos-3",
    type: "borrowing",
    asset: "USDC",
    amount: 50000,
    interestRate: 5.8,
    ltv: 65,
    term: 30,
    startDate: "2026-02-05T00:00:00Z",
    endDate: "2026-03-07T00:00:00Z",
    paidInterest: 0,
    status: "active",
    collateralAsset: "SUI", 
    collateralAmount: 35000,
    liquidationPrice: 1.10,
    collaterals: [
      { asset: "SUI", amount: 35000 },
      { asset: "ETH", amount: 10 }
    ]
  },
];

export const mockVaults: Vault[] = [
  {
    id: "vault-1",
    name: "Steakhouse Prime USDC",
    asset: "USDC",
    deposits: 441890000,
    liquidity: 220960000,
    curator: "Steakhouse",
    curatorVerified: true,
    exposure: ["SUI", "USDC", "ETH"],
    apy: 4.21,
    utilizationRate: 50.0,
  },
  {
    id: "vault-2",
    name: "Steakhouse USDC",
    asset: "USDC",
    deposits: 337960000,
    liquidity: 211730000,
    curator: "Steakhouse",
    curatorVerified: true,
    exposure: ["SUI", "USDC"],
    apy: 3.18,
    utilizationRate: 37.3,
  },
  {
    id: "vault-3",
    name: "Gauntlet Multi-Collateral",
    asset: "USDC",
    deposits: 320890000,
    liquidity: 210810000,
    curator: "Gauntlet",
    curatorVerified: true,
    exposure: ["SUI", "ETH", "USDC"],
    apy: 4.22,
    utilizationRate: 34.3,
  },
  {
    id: "vault-4",
    name: "DeepBook ETH Vault",
    asset: "ETH",
    deposits: 85200,
    liquidity: 42100,
    curator: "Vortex",
    curatorVerified: true,
    exposure: ["ETH", "USDC"],
    apy: 4.85,
    utilizationRate: 50.6,
  },
  {
    id: "vault-5",
    name: "Seamless SUI Vault",
    asset: "SUI",
    deposits: 23350000,
    liquidity: 23260000,
    curator: "Seamless",
    curatorVerified: true,
    exposure: ["SUI", "USDC"],
    apy: 5.21,
    utilizationRate: 0.4,
  },
  {
    id: "vault-6",
    name: "Moonwell Flagship USDC",
    asset: "USDC",
    deposits: 16340000,
    liquidity: 16340000,
    curator: "Moonwell",
    curatorVerified: true,
    exposure: ["SUI", "USDC", "ETH"],
    apy: 4.45,
    utilizationRate: 0.0,
  },
];

export const mockVestingPositions: VestingPosition[] = [
  {
    id: "vest-1",
    amount: 100000,
    lockDate: "2026-01-01T00:00:00Z",
    unlockDate: "2026-04-01T00:00:00Z",
    apy: 6.0,
    subsidyRate: 1.5,
    earnedRewards: 1234.56,
    status: "locked",
    zkProofVerified: true,
  },
  {
    id: "vest-2",
    amount: 50000,
    lockDate: "2025-11-01T00:00:00Z",
    unlockDate: "2026-02-01T00:00:00Z",
    apy: 5.5,
    subsidyRate: 1.0,
    earnedRewards: 687.23,
    status: "unlockable",
    zkProofVerified: true,
  },
];

export const mockMarketExposure: MarketExposure[] = [
  { asset: "SUI / USDC", symbol: "SUI", allocation: 45, vaultAllocation: 625880000, supplyCap: 999999999, apy: 5.21, utilization: 78.43 },
  { asset: "USDC / SUI", symbol: "USDC", allocation: 30, vaultAllocation: 417060000, supplyCap: 890073000, apy: 4.18, utilization: 82.28 },
  { asset: "ETH / USDC", symbol: "ETH", allocation: 25, vaultAllocation: 285400000, supplyCap: 500000000, apy: 4.85, utilization: 71.56 },
];

export const mockApyHistory: ChartDataPoint[] = [
  { date: "Jan 23", value: 4.15 },
  { date: "Jan 25", value: 4.18 },
  { date: "Jan 26", value: 4.22 },
  { date: "Jan 27", value: 4.19 },
  { date: "Jan 28", value: 4.25 },
  { date: "Jan 29", value: 4.28 },
  { date: "Jan 30", value: 4.21 },
  { date: "Jan 31", value: 4.24 },
  { date: "Feb 1", value: 4.26 },
  { date: "Feb 2", value: 4.23 },
  { date: "Feb 3", value: 4.20 },
  { date: "Feb 4", value: 4.22 },
  { date: "Feb 5", value: 4.19 },
  { date: "Feb 6", value: 4.21 },
  { date: "Feb 7", value: 4.18 },
  { date: "Feb 8", value: 4.21 },
];

export const mockUser: User = {
  address: "0x7a4b9c8d2e1f3a6b5c4d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
  isConnected: true,
  balance: 125000,
  suiBalance: 50000,
  positions: mockPositions,
  orders: mockOrders,
  vestingPositions: mockVestingPositions,
  fairnessBadges: ["Early Adopter", "Fair Lender", "Community Builder"],
  priorityStatus: true,
};

export const mockPrices: PriceData[] = [
  { asset: "SUI", price: 2.45, change24h: 3.2, lastUpdated: "2026-02-08T21:30:00Z" },
  { asset: "USDC", price: 1.0, change24h: 0.0, lastUpdated: "2026-02-08T21:30:00Z" },
  { asset: "ETH", price: 2850.00, change24h: 1.8, lastUpdated: "2026-02-08T21:30:00Z" },
];

export const mockBorrowMarkets = [
  { asset: "USDC", available: 45200000, borrowApr: 5.2, maxLtv: 90 },
  { asset: "SUI", available: 12800000, borrowApr: 6.1, maxLtv: 75 },
  { asset: "ETH", available: 8500000, borrowApr: 5.8, maxLtv: 70 },
];
