export type OrderType = "lend" | "borrow";
export type OrderStatus = "pending" | "matched" | "active" | "completed" | "cancelled";
export type PositionType = "lending" | "borrowing";
export type PositionStatus = "active" | "completed" | "liquidated";
export type VestingStatus = "locked" | "unlockable" | "unlocked";

export interface Order {
  id: string;
  creator?: string;
  type: OrderType;
  asset: string;
  collateralAsset?: string;
  amount: number;
  interestRate: number;
  ltv: number;
  term: number;
  status: OrderStatus;
  createdAt: string;
  matchedAt?: string;
  isHidden: boolean;
  fairnessScore?: number;
  zkProofHash?: string;
  collaterals?: { asset: string; amount: number }[];
}

export interface Position {
  id: string;
  type: PositionType;
  asset: string;
  amount: number;
  interestRate: number;
  ltv: number;
  term: number;
  startDate: string;
  endDate: string;
  earnedInterest?: number;
  paidInterest?: number;
  status: PositionStatus;
  collateralAsset?: string;
  collateralAmount?: number;
  collaterals?: { asset: string; amount: number }[];
  liquidationPrice?: number;
}

export interface Vault {
  id: string;
  name: string;
  asset: string;
  deposits: number;
  liquidity: number;
  curator: string;
  curatorVerified: boolean;
  exposure: string[];
  apy: number;
  utilizationRate: number;
}

export interface VestingPosition {
  id: string;
  amount: number;
  lockDate: string;
  unlockDate: string;
  apy: number;
  subsidyRate: number;
  earnedRewards: number;
  status: VestingStatus;
  zkProofVerified: boolean;
}

export interface MarketStats {
  totalValueLocked: number;
  totalLoans: number;
  averageApy: number;
  activeUsers: number;
  totalMatched: number;
  fairnessScore: number;
  volume24h: number;
}

export interface MarketExposure {
  asset: string;
  symbol: string;
  allocation: number;
  vaultAllocation: number;
  supplyCap: number;
  apy: number;
  utilization: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface User {
  address: string;
  isConnected: boolean;
  balance: number;
  suiBalance: number;
  positions: Position[];
  orders: Order[];
  vestingPositions: VestingPosition[];
  fairnessBadges: string[];
  priorityStatus: boolean;
}

export interface PriceData {
  asset: string;
  price: number;
  change24h: number;
  lastUpdated: string;
}
