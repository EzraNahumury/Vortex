
import { Order, Position, VestingPosition, Vault, MarketStats, PriceData, MarketExposure, ChartDataPoint, User } from "@/lib/types";
import { mockOrders, mockPositions, mockVestingPositions, mockStats, mockPrices, mockMarketExposure, mockApyHistory, mockBorrowMarkets, mockVaults, mockUser } from "@/lib/data";

// In-memory store for mock data that persists during the session
class MockStateManager {
  private orders: Order[] = [...mockOrders];
  private positions: Position[] = [...mockPositions];
  private vestingPositions: VestingPosition[] = [...mockVestingPositions];
  private vaults: Vault[] = [...mockVaults];
  private stats: MarketStats = { ...mockStats };
  private prices: PriceData[] = [...mockPrices];
  
  // Getters
  getOrders() { return [...this.orders]; }
  getPositions() { return [...this.positions]; }
  getVestingPositions() { return [...this.vestingPositions]; }
  getVaults() { return [...this.vaults]; }
  getStats() { return { ...this.stats }; }
  getPrices() { return [...this.prices]; }

  // Actions
  addOrder(order: Order) {
    this.orders = [order, ...this.orders];
    
    // Auto-match logic for simulation
    this.tryAutoMatch(order);
  }

  private tryAutoMatch(newOrder: Order) {
    // 1. Filter opposite orders
    const oppositeType = newOrder.type === 'lend' ? 'borrow' : 'lend';
    const candidates = this.orders.filter(o => 
      o.type === oppositeType && 
      o.status === 'pending' &&
      o.asset === newOrder.asset
    );
    
    // 2. Find a match based on Interest Rate AND LTV
    // Rate Logic:
    // - Lend Order (Bid): Wants matched with Borrower willing to pay >= Rate.
    // - Borrow Order (Ask): Wants matched with Lender offering <= Rate.
    // LTV Logic:
    // - Lend Order: Sets a MAX LTV they are comfortable with. Borrower must have LTV <= Lender's Max.
    // - Borrow Order: Sets their desired LTV. Lender must accept >= Borrower's LTV.
    
    let match: Order | undefined;

    if (newOrder.type === 'lend') {
        // I am Lender. 
        // Find Borrower where:
        // 1. Borrower Rate >= My Rate (Profitable for me)
        // 2. Borrower LTV <= My Max LTV (Safe for me)
        match = candidates.find(c => 
            c.interestRate >= newOrder.interestRate &&
            c.ltv <= newOrder.ltv
        );
    } else {
        // I am Borrower.
        // Find Lender where:
        // 1. Lender Rate <= My Rate (Cheap for me)
        // 2. Lender Max LTV >= My LTV (They accept my risk)
        match = candidates.find(c => 
            c.interestRate <= newOrder.interestRate &&
            c.ltv >= newOrder.ltv
        );
    }

    if (match) {
        // Simple full match for mock demo
        // In reality, would handle partial fills
        if (newOrder.type === 'lend') {
            this.matchOrders(newOrder.id, match.id);
        } else {
            this.matchOrders(match.id, newOrder.id);
        }
    }
  }

  updateOrder(orderId: string, updates: Partial<Order>) {
    this.orders = this.orders.map(o => o.id === orderId ? { ...o, ...updates } : o);
  }

  matchOrders(lendOrderId: string, borrowOrderId: string) {
    const lendOrder = this.orders.find(o => o.id === lendOrderId);
    const borrowOrder = this.orders.find(o => o.id === borrowOrderId);

    if (lendOrder && borrowOrder) {
      // Update statuses
      this.updateOrder(lendOrderId, { status: 'matched', matchedAt: new Date().toISOString() });
      this.updateOrder(borrowOrderId, { status: 'matched', matchedAt: new Date().toISOString() });

      // Determine match amount (min of both)
      const matchAmount = Math.min(lendOrder.amount, borrowOrder.amount);
      
      // Create positions
      const lendPosition: Position = {
        id: `pos-${Date.now()}-lend`,
        type: 'lending',
        asset: lendOrder.asset,
        amount: matchAmount,
        interestRate: lendOrder.interestRate, // Lender gets their asked rate or better? usually clearing price. taking lender rate for simplicity
        ltv: lendOrder.ltv,
        term: lendOrder.term,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + lendOrder.term * 24 * 60 * 60 * 1000).toISOString(),
        earnedInterest: 0,
        paidInterest: 0,
        status: 'active',
      };

      const borrowPosition: Position = {
        id: `pos-${Date.now()}-borrow`,
        type: 'borrowing',
        asset: borrowOrder.asset,
        amount: matchAmount, 
        interestRate: borrowOrder.interestRate, // Borrower pays their rate
        ltv: borrowOrder.ltv,
        term: borrowOrder.term,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + borrowOrder.term * 24 * 60 * 60 * 1000).toISOString(),
        earnedInterest: 0,
        paidInterest: 0,
        status: 'active',
        collateralAsset: borrowOrder.collaterals?.[0]?.asset || "SUI", 
        collateralAmount: borrowOrder.collaterals?.[0]?.amount || matchAmount * 1.5,
        collaterals: borrowOrder.collaterals // Propagate multi-collateral data
      };

      this.positions = [lendPosition, borrowPosition, ...this.positions];
      
      this.stats.totalMatched += matchAmount;
      this.stats.totalLoans += 1;
      this.stats.volume24h += matchAmount;
    }
  }

  addVestingPosition(position: VestingPosition) {
    this.vestingPositions = [position, ...this.vestingPositions];
    this.stats.totalValueLocked += position.amount;
  }

  unlockVestingPosition(id: string) {
    this.vestingPositions = this.vestingPositions.map(p => 
      p.id === id ? { ...p, status: 'unlocked' } : p
    );
  }

  repayLoan(positionId: string) {
    this.positions = this.positions.map(p => 
      p.id === positionId ? { ...p, status: 'completed', endDate: new Date().toISOString() } : p
    );
  }

  liquidateLoan(positionId: string) {
    this.positions = this.positions.map(p => 
      p.id === positionId ? { ...p, status: 'liquidated', endDate: new Date().toISOString() } : p
    );
  }
}

export const MockState = new MockStateManager();
