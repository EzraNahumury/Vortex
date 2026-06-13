import { create } from "zustand";
import { isMockMode } from "@/lib/config";
import type {
  User,
  Order,
  Position,
  Vault,
  VestingPosition,
  MarketStats,
  MarketExposure,
  ChartDataPoint,
  PriceData,
} from "@/lib/types";
import {
  mockUser,
  mockOrders,
  mockPositions,
  mockVaults,
  mockVestingPositions,
} from "@/lib/data";
import {
  fetchBlockchainOrders,
  fetchBlockchainPositions,
  fetchBlockchainVestingPositions,
  fetchBlockchainStats,
  fetchBlockchainPrices,
  fetchMarketExposure,
  fetchApyHistory,
  fetchBorrowMarkets,
  fetchVaults,
  calculateFairnessScore,
} from "@/lib/sui/blockchain-service";

interface UserSlice {
  user: User | null;
  walletAddress: string | null;
  isConnecting: boolean;
  setUser: (user: User | null) => void;
  setWalletAddress: (address: string | null) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

interface OrderSlice {
  orders: Order[];
  isLoadingOrders: boolean;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  cancelOrder: (orderId: string) => void;
  fetchOrders: () => Promise<void>;
}

interface PositionSlice {
  positions: Position[];
  isLoadingPositions: boolean;
  setPositions: (positions: Position[]) => void;
  fetchPositions: () => Promise<void>;
  repayPosition: (positionId: string) => void;
  liquidatePosition: (positionId: string) => void;
}

interface VaultSlice {
  vaults: Vault[];
  isLoadingVaults: boolean;
  setVaults: (vaults: Vault[]) => void;
  fetchVaults: () => Promise<void>;
}

interface VestingSlice {
  vestingPositions: VestingPosition[];
  isLoadingVesting: boolean;
  setVestingPositions: (positions: VestingPosition[]) => void;
  addVestingPosition: (position: VestingPosition) => void;
  unlockVestingPosition: (positionId: string) => void;
  fetchVestingPositions: () => Promise<void>;
}

interface MarketSlice {
  stats: MarketStats;
  marketExposure: MarketExposure[];
  apyHistory: ChartDataPoint[];
  prices: PriceData[];
  borrowMarkets: { asset: string; available: number; borrowApr: number; maxLtv: number }[];
  isLoadingMarket: boolean;
  setStats: (stats: MarketStats) => void;
  setMarketExposure: (exposure: MarketExposure[]) => void;
  setApyHistory: (history: ChartDataPoint[]) => void;
  setPrices: (prices: PriceData[]) => void;
  fetchMarketData: () => Promise<void>;
  refreshPrices: () => Promise<void>;
}

type AppState = UserSlice & OrderSlice & PositionSlice & VaultSlice & VestingSlice & MarketSlice;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  walletAddress: null,
  isConnecting: false,
  orders: [],
  isLoadingOrders: false,
  positions: [],
  isLoadingPositions: false,
  vaults: [],
  isLoadingVaults: false,
  vestingPositions: [],
  isLoadingVesting: false,
  stats: {
    totalValueLocked: 0,
    totalLoans: 0,
    averageApy: 0,
    activeUsers: 0,
    totalMatched: 0,
    fairnessScore: 0,
    volume24h: 0,
  },
  marketExposure: [],
  apyHistory: [],
  prices: [],
  borrowMarkets: [],
  isLoadingMarket: false,

  setUser: (user) => set({ user }),
  setWalletAddress: (address) => set({ walletAddress: address }),
  setIsConnecting: (isConnecting) => set({ isConnecting }),

  connectWallet: async () => {
    set({ isConnecting: true });

    // In both real and mock mode, we try to behave similarly regarding connection state.
    // If mock mode, we just add a delay. Real wallet connection is handled by the provider/wallet adapter.
    if (isMockMode()) {
      await delay(500);
    }
    
    set({ isConnecting: false });
    
    // Trigger data fetching
    const { fetchOrders, fetchPositions, fetchVestingPositions, fetchMarketData } = get();
    await Promise.all([
      fetchOrders(),
      fetchPositions(),
      fetchVestingPositions(),
      fetchMarketData(),
    ]);
  },

  disconnectWallet: () => {
    set({
      user: null,
      walletAddress: null,
      orders: [],
      positions: [],
      vestingPositions: [],
    });
  },

  setOrders: (orders) => set({ orders }),

  addOrder: async (order) => {
    const { orders, walletAddress, vestingPositions } = get();
    
    const isVested = vestingPositions.some(vp => vp.status === "locked" || vp.status === "unlockable");
    
    try {
      const fairnessResult = await calculateFairnessScore(
        order.amount,
        walletAddress || "",
        isVested
      );
      
      const orderWithFairness = {
        ...order,
        fairnessScore: fairnessResult.score,
      };
      
      set({ orders: [orderWithFairness, ...orders] });
    } catch {
      set({ orders: [order, ...orders] });
    }
  },

  updateOrder: (orderId, updates) => {
    const { orders } = get();
    set({
      orders: orders.map((o) => (o.id === orderId ? { ...o, ...updates } : o)),
    });
  },

  cancelOrder: (orderId) => {
    const { orders } = get();
    set({
      orders: orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as const } : o)),
    });
  },

  fetchOrders: async () => {
    set({ isLoadingOrders: true });

    try {
      const orders = await fetchBlockchainOrders();
      set({ orders, isLoadingOrders: false });
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      set({ isLoadingOrders: false });
    }
  },

  setPositions: (positions) => set({ positions }),

  fetchPositions: async () => {
    const { walletAddress } = get();
    set({ isLoadingPositions: true });

    try {
      const positions = await fetchBlockchainPositions(walletAddress || "");
      set({ positions, isLoadingPositions: false });
    } catch (error) {
      console.error("Failed to fetch positions:", error);
      set({ isLoadingPositions: false });
    }
  },

  repayPosition: (positionId) => {
    const { positions } = get();
    set({
      positions: positions.map((p) =>
        p.id === positionId ? { ...p, status: "completed" as const, endDate: new Date().toISOString() } : p
      ),
    });
  },

  liquidatePosition: (positionId) => {
    const { positions } = get();
    set({
      positions: positions.map((p) =>
        p.id === positionId ? { ...p, status: "liquidated" as const, endDate: new Date().toISOString() } : p
      ),
    });
  },

  setVaults: (vaults) => set({ vaults }),

  fetchVaults: async () => {
    set({ isLoadingVaults: true });

    try {
      const vaults = await fetchVaults();
      set({ vaults, isLoadingVaults: false });
    } catch (error) {
      console.error("Failed to fetch vaults:", error);
      set({ isLoadingVaults: false });
    }
  },

  setVestingPositions: (vestingPositions) => set({ vestingPositions }),

  addVestingPosition: (position) => {
    const { vestingPositions } = get();
    set({ vestingPositions: [position, ...vestingPositions] });
  },

  unlockVestingPosition: (positionId) => {
    const { vestingPositions } = get();
    set({
      vestingPositions: vestingPositions.map((p) =>
        p.id === positionId ? { ...p, status: "unlocked" as const } : p
      ),
    });
  },

  fetchVestingPositions: async () => {
    const { walletAddress } = get();
    set({ isLoadingVesting: true });

    try {
      const vestingPositions = await fetchBlockchainVestingPositions(walletAddress || "");
      set({ vestingPositions, isLoadingVesting: false });
    } catch (error) {
      console.error("Failed to fetch vesting positions:", error);
      set({ isLoadingVesting: false });
    }
  },

  setStats: (stats) => set({ stats }),
  setMarketExposure: (marketExposure) => set({ marketExposure }),
  setApyHistory: (apyHistory) => set({ apyHistory }),
  setPrices: (prices) => set({ prices }),

  fetchMarketData: async () => {
    set({ isLoadingMarket: true });

    try {
      const [stats, prices, marketExposure, apyHistory, borrowMarkets] = await Promise.all([
        fetchBlockchainStats(),
        fetchBlockchainPrices(),
        fetchMarketExposure(),
        fetchApyHistory(),
        fetchBorrowMarkets(),
      ]);

      set({
        stats,
        marketExposure,
        apyHistory,
        prices,
        borrowMarkets,
        isLoadingMarket: false,
      });
    } catch (error) {
      console.error("Failed to fetch market data:", error);
      set({ isLoadingMarket: false });
    }
  },

  refreshPrices: async () => {
    try {
      const prices = await fetchBlockchainPrices();
      set({ prices });
    } catch (error) {
      console.error("Failed to refresh prices:", error);
    }
  },
}));
