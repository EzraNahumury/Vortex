
import { Transaction } from "@mysten/sui/transactions";
import { getSuiClient } from "@/lib/sui/client";
import { isMockMode } from "@/lib/config";
import { MockState } from "@/lib/sui/mock-state";
import {
  buildCreateOrderTx,
  buildLockVestingTx,
  buildUnlockVestingTx,
  buildCreateBorrowTx,
  buildRepayLoanTx,
  buildMintTokenTx,
  buildMatchOrdersTx,
  buildMatchBestOfferTx,
  buildLiquidateLoanTx,
  buildVaultDepositTx,
  buildVaultWithdrawTx,
  buildExecuteAllocationLegTx,
} from "@/lib/sui/transactions";
import { env } from "@/lib/config";

export interface TransactionResult {
  success: boolean;
  digest?: string;
  error?: string;
  effects?: {
    status: { status: string };
    gasUsed: {
      computationCost: string;
      storageCost: string;
    };
  };
}

// This will be set by the component that has access to dapp-kit hooks
let signAndExecuteCallback: ((tx: Transaction) => Promise<{ digest: string; effects?: unknown }>) | null = null;

export function setSignAndExecuteCallback(
  callback: ((tx: Transaction) => Promise<{ digest: string; effects?: unknown }>) | null
) {
  signAndExecuteCallback = callback;
}

// Global execution function for REAL transactions
async function executeTransaction(tx: Transaction, userAddress: string): Promise<TransactionResult> {
  // NOTE: We REMOVED the global mock check here. 
  // If we are here, it means the caller explicitly wants to run a transaction (likely real or the caller decided to use real tx).

  if (!signAndExecuteCallback) {
    return {
      success: false,
      error: "Wallet not connected. Please connect your wallet first.",
    };
  }

  try {
    tx.setSender(userAddress);
    
    const result = await signAndExecuteCallback(tx);

    return {
      success: true,
      digest: result.digest,
      effects: result.effects as TransactionResult["effects"],
    };
  } catch (error) {
    console.error("Transaction execution error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  }
}

// --- Specific Executors with Mock Interception ---

export async function executeCreateOrder(
  params: {
    type: "lend" | "borrow";
    asset: string;
    amount: number;
    interestRate: number;
    ltv: number;
    term: number;
    isHidden: boolean;
    coinObjectId?: string;
    collateralAmount?: number;
    collateral?: string; // Primary collateral asset (e.g., "ETH", "SUI", "USDC")
    collateralCoinId?: string; // Coin object ID for non-SUI collateral
    collaterals?: { asset: string; amount: number }[];
  },
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    // Update local Mock State
    MockState.addOrder({
      id: `order-${Date.now()}`,
      creator: userAddress,
      type: params.type,
      asset: params.asset,
      amount: params.amount,
      interestRate: params.interestRate,
      ltv: params.ltv,
      term: params.term,
      status: "pending",
      createdAt: new Date().toISOString(),
      isHidden: params.isHidden,
      fairnessScore: 85, // Default mock score
      zkProofHash: params.isHidden ? `0x${Array(64).fill('a').join('')}` : undefined,
      collaterals: params.collaterals,
    });
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    // Build transaction with collateral parameter for proper market routing
    const tx = buildCreateOrderTx({
      ...params,
      collateral: params.collateral, // Pass collateral for market selection
      collateralCoinId: params.collateralCoinId, // Pass coin object ID for non-SUI collateral
    });
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create order transaction",
    };
  }
}

export async function executeLockVesting(
  params: {
    amount: number;
    lockDurationDays: number;
  },
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    const subsidy = params.lockDurationDays >= 365 ? 3.5 : 1.5;
    MockState.addVestingPosition({
      id: `vesting-${Date.now()}`,
      amount: params.amount,
      lockDate: new Date().toISOString(),
      unlockDate: new Date(Date.now() + params.lockDurationDays * 86400000).toISOString(),
      apy: 4.5 + subsidy,
      subsidyRate: subsidy,
      earnedRewards: 0,
      status: "locked",
      zkProofVerified: true,
    });
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    const tx = buildLockVestingTx(params);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create vesting transaction",
    };
  }
}

export async function executeUnlockVesting(
  vestingPositionId: string,
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    MockState.unlockVestingPosition(vestingPositionId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    const tx = buildUnlockVestingTx(vestingPositionId);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create unlock transaction",
    };
  }
}

export async function executeBorrow(
  params: {
    collateralCoinId: string;
    borrowAsset: string;
    borrowAmount: number;
    ltv: number;
    interestRate?: number;
    term?: number;
  },
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    // Mock borrow logic if needed
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    const tx = buildCreateBorrowTx({
      ...params,
      interestRate: params.interestRate || 5.0,
      term: params.term || 30,
    });
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create borrow transaction",
    };
  }
}

export async function executeRepay(
  loanId: string,
  coinObjectId: string,
  asset: string,
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    MockState.repayLoan(loanId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    const tx = buildRepayLoanTx(loanId, coinObjectId, asset);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repay transaction",
    };
  }
}

export async function executeLiquidate(
  loanId: string,
  coinObjectId: string,
  asset: string,
  userAddress: string
): Promise<TransactionResult> {
  if (isMockMode()) {
    MockState.liquidateLoan(loanId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, digest: `mock_${Date.now()}` };
  }

  try {
    const tx = buildLiquidateLoanTx(loanId, coinObjectId, asset);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create liquidate transaction",
    };
  }
}

export async function executeVaultDeposit(
  params: { vaultId: string; asset: string; amount: number; coinObjectId?: string },
  userAddress: string,
): Promise<TransactionResult> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, digest: `mock_vault_${Date.now()}` };
  }
  try {
    const tx = buildVaultDepositTx(params);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Vault deposit failed" };
  }
}

export async function executeVaultWithdraw(
  params: { vaultId: string; asset: string; amount: number },
  userAddress: string,
): Promise<TransactionResult> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, digest: `mock_vault_w_${Date.now()}` };
  }
  try {
    const tx = buildVaultWithdrawTx(params);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Vault withdraw failed" };
  }
}

/**
 * Ask the Nautilus enclave to design an allocation across `legs`, then submit each leg
 * sequentially. Returns the per-leg digests so the UI can show partial progress.
 */
export async function executeAllocationPlan(
  params: {
    vaultId: string;
    enclaveId: string;
    asset: string;
    collateral: string;
    amount: number;
    legs: { marketId: string; weight: number; rateBps: number; durationMs: number }[];
  },
  userAddress: string,
): Promise<{ legResults: TransactionResult[]; success: boolean }> {
  const { signAllocationPlan } = await import("@/lib/nautilus");

  let signedLegs;
  try {
    signedLegs = await signAllocationPlan({
      vaultId: params.vaultId,
      amount: params.amount,
      legs: params.legs,
    });
  } catch (e) {
    return {
      legResults: [
        {
          success: false,
          error: e instanceof Error ? e.message : "Failed to sign allocation plan",
        },
      ],
      success: false,
    };
  }

  const legResults: TransactionResult[] = [];
  for (const leg of signedLegs) {
    if (isMockMode()) {
      legResults.push({ success: true, digest: `mock_alloc_${leg.nonce}_${leg.marketId.slice(0, 6)}` });
      continue;
    }
    try {
      const tx = buildExecuteAllocationLegTx({
        vaultId: params.vaultId,
        enclaveId: params.enclaveId,
        marketId: leg.marketId,
        asset: params.asset,
        collateral: params.collateral,
        nonce: leg.nonce,
        amount: leg.amount,
        rateBps: leg.rateBps,
        durationMs: leg.durationMs,
        signature: leg.signature,
      });
      const result = await executeTransaction(tx, userAddress);
      legResults.push(result);
      if (!result.success) break;
    } catch (e) {
      legResults.push({
        success: false,
        error: e instanceof Error ? e.message : "Allocation leg execution failed",
      });
      break;
    }
  }

  return { legResults, success: legResults.every((r) => r.success) };
}

export async function executeMintToken(
  asset: string,
  amount: number,
  userAddress: string
): Promise<TransactionResult> {
  // Faucet is ALWAYS real if possible, because user wants real faucet.
  // We do NOT intercept with MockState here.
  
  try {
    const tx = buildMintTokenTx(asset, amount);
    return await executeTransaction(tx, userAddress);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create mint transaction",
    };
  }
}

export async function executeDemoTransaction(userAddress: string): Promise<TransactionResult> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      success: true,
      digest: `demo_${Date.now().toString(16)}`,
      effects: {
        status: { status: "success" },
        gasUsed: {
          computationCost: "500000",
          storageCost: "1000000",
        },
      },
    };
  }

  if (!signAndExecuteCallback) {
    return {
      success: false,
      error: "Wallet not connected. Please connect your wallet first.",
    };
  }

  try {
    const tx = new Transaction();
    tx.setSender(userAddress);
    
    const [coin] = tx.splitCoins(tx.gas, [1]);
    tx.transferObjects([coin], userAddress);

    const result = await signAndExecuteCallback(tx);

    return {
      success: true,
      digest: result.digest,
      effects: result.effects as TransactionResult["effects"],
    };
  } catch (error) {
    console.error("Demo transaction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Demo transaction failed",
    };
  }
}

export async function executeMatchOrders(
  lendOrderId: string,
  borrowOrderId: string,
  asset: string,
  userAddress: string,
  // Optional additional parameters for better fairness calculation
  options?: {
    collateral?: string;
    lendAmount?: number;
    borrowAmount?: number;
    lendRate?: number;
    borrowRate?: number;
    lenderAddress?: string;
    borrowerAddress?: string;
    isVested?: boolean;
  }
): Promise<TransactionResult & { fairnessScore?: number; finalRate?: number }> {
  const fairnessRequest = {
    lendOrderId,
    borrowOrderId,
    lendAmount: options?.lendAmount ?? 0,
    borrowAmount: options?.borrowAmount ?? 0,
    lendRate: options?.lendRate ?? 0,
    borrowRate: options?.borrowRate ?? 0,
    lenderAddress: options?.lenderAddress || userAddress,
    borrowerAddress: options?.borrowerAddress || userAddress,
    isVested: options?.isVested,
  };

  // Try to compute the fairness score. Failure must NOT abort the match — we fall back to
  // the deterministic on-chain entry so users can still settle.
  let fairnessScore: number | undefined;
  let finalRate: number | undefined;
  let fairnessSignature: Uint8Array | undefined;
  let fairnessError: string | undefined;
  try {
    const { computeFairnessScore } = await import("@/lib/nautilus");
    const fairnessResult = await computeFairnessScore(fairnessRequest);
    fairnessScore = fairnessResult.score;
    finalRate = fairnessResult.finalRate;
    fairnessSignature = fairnessResult.signature;
  } catch (e) {
    fairnessError = e instanceof Error ? e.message : "fairness compute failed";
    console.warn("Nautilus fairness compute failed, falling back to deterministic match:", fairnessError);
  }

  const minScore = env.matching.minFairnessScore;
  if (minScore > 0 && fairnessScore !== undefined && fairnessScore < minScore) {
    return {
      success: false,
      error: `Fairness score ${fairnessScore} below threshold ${minScore}`,
      fairnessScore,
      finalRate,
    };
  }

  if (isMockMode()) {
    MockState.matchOrders(lendOrderId, borrowOrderId);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      success: true,
      digest: `mock_nautilus_${Date.now()}`,
      fairnessScore,
      finalRate,
    };
  }

  // Real mode: prefer the Nautilus-verified entry, fall back to the deterministic one.
  try {
    const enclaveId = process.env.NEXT_PUBLIC_NAUTILUS_ENCLAVE_ID;
    const collateral = options?.collateral || "SUI";

    const useNautilusPath = enclaveId && fairnessSignature && fairnessScore !== undefined;
    const tx = useNautilusPath
      ? buildMatchOrdersTx({
          lendOrderId,
          borrowOrderId,
          asset,
          collateral,
          enclaveId: enclaveId!,
          fairnessScore: fairnessScore!,
          fairnessProof: fairnessSignature!,
        })
      : buildMatchBestOfferTx({
          lendOrderId,
          borrowOrderId,
          asset,
          collateral,
        });

    const result = await executeTransaction(tx, userAddress);
    return {
      ...result,
      fairnessScore,
      finalRate,
    };
  } catch (error) {
    console.error("Match execution error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Match execution failed",
      fairnessScore,
      finalRate,
    };
  }
}

