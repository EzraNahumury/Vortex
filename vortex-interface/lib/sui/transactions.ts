import { Transaction } from "@mysten/sui/transactions";
import { env } from "@/lib/config";

interface CreateOrderParams {
  type: "lend" | "borrow";
  asset: string;
  collateral?: string;
  amount: number;
  interestRate: number;
  ltv?: number;
  term: number;
  isHidden: boolean;
  // Required for non-SUI lending
  coinObjectId?: string;
  // Required for borrow orders
  collateralAmount?: number;
  collateralPrice?: number;
  assetPrice?: number;
  // Required for non-SUI collateral (ETH, USDC)
  collateralCoinId?: string;
}

interface CreateBorrowParams {
  collateralCoinId: string;
  borrowAsset: string;
  borrowAmount: number;
  interestRate: number;
  term: number;
  ltv: number;
  collateralPrice?: number;
  assetPrice?: number;
}

interface LockVestingParams {
  amount: number;
  lockDurationDays: number;
  vestingProofHash?: string;
}

// Registry ID from deployed contracts
const getRegistryId = () => env.sui.registryId;
const getVestingVaultId = () => env.sui.vestingVaultId;
const getPackageId = () => env.sui.packageId;

// Static market ID mapping - Next.js requires static env var references
// because it does static replacement at build time
const MARKET_IDS: { [key: string]: string | undefined } = {
  // Default: Market<USDC, SUI>
  "USDC_SUI": process.env.NEXT_PUBLIC_MARKET_ID,
  // Additional markets
  "USDC_ETH": process.env.NEXT_PUBLIC_MARKET_ID_USDC_ETH,
  "SUI_USDC": process.env.NEXT_PUBLIC_MARKET_ID_SUI_USDC,
  "SUI_ETH": process.env.NEXT_PUBLIC_MARKET_ID_SUI_ETH,
  "ETH_SUI": process.env.NEXT_PUBLIC_MARKET_ID_ETH_SUI,
  "ETH_USDC": process.env.NEXT_PUBLIC_MARKET_ID_ETH_USDC,
};

// Market IDs for different pairs
const getMarketId = (asset: string, collateral: string) => {
  // Normalize asset names
  const assetNorm = asset.toUpperCase();
  const collateralNorm = collateral.toUpperCase();
  
  // Build the pair key
  const pairKey = `${assetNorm}_${collateralNorm}`;
  const marketId = MARKET_IDS[pairKey];
  
  if (marketId) {
    return marketId;
  }
  
  // Fallback to default market ID (for backward compatibility)
  // This is typically Market<USDC, SUI>
  const defaultMarketId = env.sui.marketId;
  
  if (defaultMarketId) {
    // Only use default if it matches USDC/SUI pair
    if (assetNorm === "USDC" && collateralNorm === "SUI") {
      return defaultMarketId;
    }
    
    // For other pairs, we need a specific market
    throw new Error(
      `No market configured for ${assetNorm}/${collateralNorm}. ` +
      `Please create and configure the market:\n\n` +
      `1. Create market:\n` +
      `   sui client call --package ${env.sui.packageId} --module market ` +
      `--function create_market_standalone ` +
      `--type-args "${env.sui.packageId}::mock_${assetNorm.toLowerCase()}::MOCK_${assetNorm}" ` +
      `"${getAssetCoinTypeForError(collateralNorm)}" ` +
      `--args '[]' --gas-budget 50000000\n\n` +
      `2. Add to .env.local:\n` +
      `   NEXT_PUBLIC_MARKET_ID_${pairKey}=<created_object_id>`
    );
  }
  
  throw new Error(
    `Market ID not configured. To use orderbook, create Market objects first.\n` +
    `See README.md for instructions on creating markets for each asset/collateral pair.`
  );
};

// Helper for error messages
function getAssetCoinTypeForError(asset: string): string {
  const packageId = env.sui.packageId;
  switch (asset.toUpperCase()) {
    case "USDC":
      return `${packageId}::mock_usdc::MOCK_USDC`;
    case "ETH":
      return `${packageId}::mock_eth::MOCK_ETH`;
    case "SUI":
    default:
      return "0x2::sui::SUI";
  }
}

// Helper to get coin type argument based on asset
function getAssetCoinType(asset: string, packageId: string): string {
  switch (asset) {
    case "USDC":
      return `${packageId}::mock_usdc::MOCK_USDC`;
    case "ETH":
      return `${packageId}::mock_eth::MOCK_ETH`;
    case "SUI":
    default:
      return "0x2::sui::SUI";
  }
}

// Helper to get decimals for asset
function getDecimals(asset: string): number {
  switch (asset) {
    case "USDC":
      return 6;
    case "ETH":
      return 8;
    case "SUI":
    default:
      return 9;
  }
}

// Convert amount to smallest unit
function toSmallestUnit(amount: number, asset: string): bigint {
  const decimals = getDecimals(asset);
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

/**
 * Build a lend order transaction
 * Matches: place_lend_order<Asset, Collateral>(market, payment, interest_rate_bps, duration_ms, clock, ctx)
 */
export function buildLendOrderTx(params: {
  asset: string;
  collateral: string;
  amount: number;
  interestRate: number;
  term: number;
  coinObjectId: string;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  const interestRateBps = Math.floor(params.interestRate * 100);
  const durationMs = params.term * 24 * 60 * 60 * 1000;

  tx.moveCall({
    target: `${packageId}::market::place_lend_order`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(params.coinObjectId),
      tx.pure.u64(interestRateBps),
      tx.pure.u64(durationMs),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

/**
 * Build a borrow order transaction (standalone - no registry validation)
 * Matches: place_borrow_order_standalone<Asset, Collateral>(market, collateral, amount, interest_rate_bps, duration_ms, clock, ctx)
 */
export function buildBorrowOrderTx(params: {
  asset: string;
  collateral: string;
  borrowAmount: number;
  interestRate: number;
  term: number;
  collateralCoinId: string;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  const amountInSmallest = toSmallestUnit(params.borrowAmount, params.asset);
  const interestRateBps = Math.floor(params.interestRate * 100);
  const durationMs = params.term * 24 * 60 * 60 * 1000;

  tx.moveCall({
    target: `${packageId}::market::place_borrow_order_standalone`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(params.collateralCoinId),
      tx.pure.u64(amountInSmallest),
      tx.pure.u64(interestRateBps),
      tx.pure.u64(durationMs),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

/**
 * Build a hidden lend order transaction (ZK-privacy)
 * Matches: place_hidden_lend_order<Asset, Collateral>(market, payment, commitment, clock, ctx)
 */
export function buildHiddenLendOrderTx(params: {
  asset: string;
  collateral: string;
  coinObjectId: string;
  commitment: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::place_hidden_lend_order`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(params.coinObjectId),
      tx.pure.vector("u8", Array.from(params.commitment)),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

/**
 * Build create order transaction - unified interface for frontend
 */
export function buildCreateOrderTx(params: CreateOrderParams): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral || "SUI");

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  const interestRateBps = Math.floor(params.interestRate * 100);
  const durationMs = params.term * 24 * 60 * 60 * 1000;
  const collateral = params.collateral || "SUI";

  if (params.type === "lend") {
    // For lend order, we need to split coins to exact amount
    const amountInSmallest = toSmallestUnit(params.amount, params.asset);
    
    if (params.asset === "SUI") {
      // Split SUI from gas
      const [coin] = tx.splitCoins(tx.gas, [amountInSmallest]);
      
      tx.moveCall({
        target: `${packageId}::market::place_lend_order`,
        typeArguments: [
          getAssetCoinType(params.asset, packageId),
          getAssetCoinType(collateral, packageId),
        ],
        arguments: [
          tx.object(marketId),
          coin,
          tx.pure.u64(interestRateBps),
          tx.pure.u64(durationMs),
          tx.object("0x6"), // Clock object
        ],
      });
    } else {
      // For non-SUI assets (USDC, ETH), split exact amount from coin object
      if (!params.coinObjectId) {
        throw new Error(`For non-SUI assets (${params.asset}), coinObjectId is required`);
      }
      
      // Split exact amount from the coin object
      const [coin] = tx.splitCoins(
        tx.object(params.coinObjectId),
        [amountInSmallest]
      );
      
      tx.moveCall({
        target: `${packageId}::market::place_lend_order`,
        typeArguments: [
          getAssetCoinType(params.asset, packageId),
          getAssetCoinType(collateral, packageId),
        ],
        arguments: [
          tx.object(marketId),
          coin,
          tx.pure.u64(interestRateBps),
          tx.pure.u64(durationMs),
          tx.object("0x6"), // Clock object
        ],
      });
    }
  } else {
    // Borrow order
    const amountInSmallest = toSmallestUnit(params.amount, params.asset);
    const collateralAmountInSmallest = toSmallestUnit(params.collateralAmount || 0, collateral);
    
    if (collateralAmountInSmallest <= BigInt(0)) {
      throw new Error("Collateral amount must be greater than 0");
    }
    
    if (collateral === "SUI") {
      // Split SUI from gas as collateral
      const [collateralCoin] = tx.splitCoins(tx.gas, [collateralAmountInSmallest]);
      
      tx.moveCall({
        target: `${packageId}::market::place_borrow_order_standalone`,
        typeArguments: [
          getAssetCoinType(params.asset, packageId),
          getAssetCoinType(collateral, packageId),
        ],
        arguments: [
          tx.object(marketId),
          collateralCoin,
          tx.pure.u64(amountInSmallest),
          tx.pure.u64(interestRateBps),
          tx.pure.u64(durationMs),
          tx.object("0x6"), // Clock object
        ],
      });
    } else if (params.collateralCoinId) {
      // Non-SUI collateral (ETH, USDC) - split exact amount from coin object
      const [collateralCoin] = tx.splitCoins(
        tx.object(params.collateralCoinId),
        [collateralAmountInSmallest]
      );
      
      tx.moveCall({
        target: `${packageId}::market::place_borrow_order_standalone`,
        typeArguments: [
          getAssetCoinType(params.asset, packageId),
          getAssetCoinType(collateral, packageId),
        ],
        arguments: [
          tx.object(marketId),
          collateralCoin,
          tx.pure.u64(amountInSmallest),
          tx.pure.u64(interestRateBps),
          tx.pure.u64(durationMs),
          tx.object("0x6"), // Clock object
        ],
      });
    } else {
      throw new Error(
        `For ${collateral} collateral, you need to provide a coin object.\n` +
        `Please mint some ${collateral} tokens first using the Faucet page.`
      );
    }
  }

  return tx;
}

export function buildCreateBorrowTx(params: CreateBorrowParams): Transaction {
  return buildBorrowOrderTx({
    asset: params.borrowAsset,
    collateral: "SUI", // Default collateral
    borrowAmount: params.borrowAmount,
    interestRate: params.interestRate || 5.0,
    term: params.term || 30,
    collateralCoinId: params.collateralCoinId,
  });
}

export function buildLockVestingTx(params: LockVestingParams): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const vestingVaultId = getVestingVaultId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  if (!vestingVaultId) {
    throw new Error("Vesting vault ID not configured");
  }

  const amountMist = BigInt(Math.floor(params.amount * 1_000_000_000));
  const lockDurationMs = params.lockDurationDays * 24 * 60 * 60 * 1000;

  // Split SUI from gas for locking
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);

  // Using vesting module for locking tokens (simple lock without ZK for MVP)
  tx.moveCall({
    target: `${packageId}::vesting::lock_simple`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.object(vestingVaultId),
      coin,
      tx.pure.u64(lockDurationMs),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

export function buildUnlockVestingTx(vestingPositionId: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const vestingVaultId = getVestingVaultId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  if (!vestingVaultId) {
    throw new Error("Vesting vault ID not configured");
  }

  // Using vesting module for unlocking (generic function unlock<T>)
  tx.moveCall({
    target: `${packageId}::vesting::unlock`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.object(vestingVaultId),
      tx.object(vestingPositionId),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

export function buildRepayLoanTx(
  loanId: string, 
  coinObjectId: string, 
  asset: string, 
  collateral: string = "SUI"
): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  // Using loan module for repayment
  tx.moveCall({
    target: `${packageId}::loan::repay`,
    typeArguments: [
      getAssetCoinType(asset, packageId),
      getAssetCoinType(collateral, packageId),
    ],
    arguments: [
      tx.object(loanId),
      tx.object(coinObjectId),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

export function buildLiquidateLoanTx(
  loanId: string, 
  coinObjectId: string, 
  asset: string, 
  collateral: string = "SUI"
): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  // Using loan module for liquidation
  tx.moveCall({
    target: `${packageId}::loan::liquidate_defaulted_loan`,
    typeArguments: [
      getAssetCoinType(asset, packageId),
      getAssetCoinType(collateral, packageId),
    ],
    arguments: [
      tx.object(loanId),
      tx.object(coinObjectId),
      tx.object("0x6"), // Clock object
    ],
  });

  return tx;
}

// Build a transaction to mint mock tokens (Faucet)
export function buildMintTokenTx(asset: string, amount: number): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();

  if (!packageId) {
    throw new Error("Package ID not configured");
  }

  const decimals = getDecimals(asset);
  const amountSmallest = BigInt(Math.floor(amount * Math.pow(10, decimals)));

  if (asset === "USDC") {
    const capId = env.sui.usdcAdminCapId;
    if (!capId) throw new Error("USDC Admin Cap ID not configured. Please redeploy contracts.");
    
    tx.moveCall({
      target: `${packageId}::mock_usdc::faucet`,
      arguments: [
        tx.object(capId),
        tx.pure.u64(amountSmallest),
      ],
    });
  } else if (asset === "ETH") {
    const capId = env.sui.ethAdminCapId;
    if (!capId) throw new Error("ETH Admin Cap ID not configured. Please redeploy contracts.");

    tx.moveCall({
      target: `${packageId}::mock_eth::faucet`,
      arguments: [
        tx.object(capId),
        tx.pure.u64(amountSmallest),
      ],
    });
  } else {
    throw new Error(`Faucet not available for ${asset}`);
  }

  return tx;
}

// Cancel a lend order
export function buildCancelLendOrderTx(orderId: string, asset: string, collateral: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(asset, collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::cancel_lend_order`,
    typeArguments: [
      getAssetCoinType(asset, packageId),
      getAssetCoinType(collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.pure.id(orderId),
    ],
  });

  return tx;
}

// Cancel a borrow order
export function buildCancelBorrowOrderTx(orderId: string, asset: string, collateral: string): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(asset, collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::cancel_borrow_order`,
    typeArguments: [
      getAssetCoinType(asset, packageId),
      getAssetCoinType(collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.pure.id(orderId),
    ],
  });

  return tx;
}

// Match orders via the deterministic on-chain entry that does not require a Nautilus proof.
// Matches Move sig: match_best_offer<A,C>(market, lend_id, borrow_id, clock, ctx)
export function buildMatchBestOfferTx(params: {
  lendOrderId: string;
  borrowOrderId: string;
  asset: string;
  collateral: string;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::match_best_offer`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.pure.id(params.lendOrderId),
      tx.pure.id(params.borrowOrderId),
      tx.object("0x6"),
    ],
  });

  return tx;
}

// Match orders via Nautilus enclave-signed fairness proof.
// Matches Move sig: match_orders<A,C>(market, enclave, lend_id, borrow_id, score, proof, clock, ctx)
export function buildMatchOrdersTx(params: {
  lendOrderId: string;
  borrowOrderId: string;
  asset: string;
  collateral: string;
  enclaveId: string;
  fairnessScore: number;
  fairnessProof: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  const marketId = getMarketId(params.asset, params.collateral);

  if (!packageId) throw new Error("Package ID not configured");
  if (!marketId) throw new Error("Market ID not configured");

  tx.moveCall({
    target: `${packageId}::market::match_orders`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(marketId),
      tx.object(params.enclaveId),
      tx.pure.id(params.lendOrderId),
      tx.pure.id(params.borrowOrderId),
      tx.pure.u64(params.fairnessScore),
      tx.pure.vector("u8", Array.from(params.fairnessProof)),
      tx.object("0x6"),
    ],
  });

  return tx;
}

// ============== AGGREGATOR VAULT ==============

export function buildVaultDepositTx(params: {
  vaultId: string;
  asset: string;
  amount: number;
  coinObjectId?: string;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  if (!packageId) throw new Error("Package ID not configured");
  if (!params.vaultId) throw new Error("Vault ID not configured");

  const amountSmallest = toSmallestUnit(params.amount, params.asset);

  let coinArg;
  if (params.asset === "SUI") {
    [coinArg] = tx.splitCoins(tx.gas, [amountSmallest]);
  } else {
    if (!params.coinObjectId) {
      throw new Error(`coinObjectId required for non-SUI vault deposits (${params.asset})`);
    }
    [coinArg] = tx.splitCoins(tx.object(params.coinObjectId), [amountSmallest]);
  }

  tx.moveCall({
    target: `${packageId}::vault::deposit`,
    typeArguments: [getAssetCoinType(params.asset, packageId)],
    arguments: [tx.object(params.vaultId), coinArg],
  });
  return tx;
}

export function buildVaultWithdrawTx(params: {
  vaultId: string;
  asset: string;
  amount: number;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  if (!packageId) throw new Error("Package ID not configured");
  const amountSmallest = toSmallestUnit(params.amount, params.asset);
  tx.moveCall({
    target: `${packageId}::vault::withdraw`,
    typeArguments: [getAssetCoinType(params.asset, packageId)],
    arguments: [tx.object(params.vaultId), tx.pure.u64(amountSmallest)],
  });
  return tx;
}

/**
 * Submit one signed allocation leg produced by `signAllocationPlan`.
 *
 * Each leg places one lend order on the target market. Submitting legs individually keeps
 * partial failures recoverable.
 */
export function buildExecuteAllocationLegTx(params: {
  vaultId: string;
  enclaveId: string;
  marketId: string;
  asset: string;
  collateral: string;
  nonce: number;
  amount: number;       // raw smallest-unit amount
  rateBps: number;
  durationMs: number;
  signature: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  const packageId = getPackageId();
  if (!packageId) throw new Error("Package ID not configured");

  tx.moveCall({
    target: `${packageId}::vault::execute_allocation_leg`,
    typeArguments: [
      getAssetCoinType(params.asset, packageId),
      getAssetCoinType(params.collateral, packageId),
    ],
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.enclaveId),
      tx.object(params.marketId),
      tx.pure.u64(params.nonce),
      tx.pure.u64(params.amount),
      tx.pure.u64(params.rateBps),
      tx.pure.u64(params.durationMs),
      tx.pure.vector("u8", Array.from(params.signature)),
      tx.object("0x6"),
    ],
  });
  return tx;
}

export { Transaction };
