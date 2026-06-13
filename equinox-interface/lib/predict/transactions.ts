/**
 * Transaction builders for the Equinox PLP+Hedge vault on DeepBook Predict.
 * Target strings and argument order mirror `equinox_predict::vault` and the deployed
 * `deepbook_predict::predict` package.
 */
import { Transaction } from "@mysten/sui/transactions";
import { predictConfig, SHARE_TYPE } from "./config";

const PKG = predictConfig.vaultPackageId;
const QUOTE = predictConfig.dusdcType;
const VAULT = predictConfig.vaultId;
const PREDICT = predictConfig.predictObjectId;
const MANAGER = predictConfig.managerId;
const CLOCK = predictConfig.clockId;

/** Deposit dUSDC into the vault; receives VAULT_SHARE back to the sender. */
export function buildVaultDepositTx(dusdcCoinId: string, amountBase: bigint): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(dusdcCoinId), [amountBase]);
  tx.moveCall({
    target: `${PKG}::vault::deposit_entry`,
    typeArguments: [QUOTE],
    arguments: [tx.object(VAULT), coin],
  });
  return tx;
}

/** Burn VAULT_SHARE for the proportional claim on idle dUSDC. */
export function buildVaultWithdrawTx(shareCoinId: string, shareAmountBase: bigint): Transaction {
  const tx = new Transaction();
  const [shares] = tx.splitCoins(tx.object(shareCoinId), [shareAmountBase]);
  tx.moveCall({
    target: `${PKG}::vault::withdraw_entry`,
    typeArguments: [QUOTE],
    arguments: [tx.object(VAULT), shares],
  });
  return tx;
}

/** Strategist-signed: supply idle dUSDC into the Predict PLP pool. */
export function buildSupplyLegTx(amountBase: bigint, nonce: bigint, signature: Uint8Array): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::vault::execute_supply_leg`,
    typeArguments: [QUOTE],
    arguments: [
      tx.object(VAULT),
      tx.object(PREDICT),
      tx.pure.u64(amountBase),
      tx.pure.u64(nonce),
      tx.pure.vector("u8", Array.from(signature)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

/** Strategist-signed (keeper sender): mint an OTM binary hedge. */
export function buildHedgeLegTx(params: {
  oracleId: string;
  expiry: bigint;
  strike: bigint;
  isUp: boolean;
  quantity: bigint;
  budgetBase: bigint;
  nonce: bigint;
  signature: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::vault::execute_hedge_leg`,
    typeArguments: [QUOTE],
    arguments: [
      tx.object(VAULT),
      tx.object(PREDICT),
      tx.object(MANAGER),
      tx.object(params.oracleId),
      tx.pure.u64(params.expiry),
      tx.pure.u64(params.strike),
      tx.pure.bool(params.isUp),
      tx.pure.u64(params.quantity),
      tx.pure.u64(params.budgetBase),
      tx.pure.u64(params.nonce),
      tx.pure.vector("u8", Array.from(params.signature)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

/** Strategist-signed: unwind PLP back to idle dUSDC. */
export function buildWithdrawPlpLegTx(plpAmountBase: bigint, nonce: bigint, signature: Uint8Array): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::vault::execute_withdraw_plp_leg`,
    typeArguments: [QUOTE],
    arguments: [
      tx.object(VAULT),
      tx.object(PREDICT),
      tx.pure.u64(plpAmountBase),
      tx.pure.u64(nonce),
      tx.pure.vector("u8", Array.from(signature)),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

/** Keeper: redeem a settled hedge and sweep the payout back into the vault. */
export function buildRedeemHedgeTx(params: {
  oracleId: string;
  expiry: bigint;
  strike: bigint;
  isUp: boolean;
  quantity: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::vault::execute_redeem_hedge`,
    typeArguments: [QUOTE],
    arguments: [
      tx.object(VAULT),
      tx.object(PREDICT),
      tx.object(MANAGER),
      tx.object(params.oracleId),
      tx.pure.u64(params.expiry),
      tx.pure.u64(params.strike),
      tx.pure.bool(params.isUp),
      tx.pure.u64(params.quantity),
      tx.object(CLOCK),
    ],
  });
  return tx;
}

/** Admin: create the keeper-owned PredictManager (one-time bootstrap). */
export function buildCreateManagerTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${predictConfig.predictPackageId}::predict::create_manager`,
    arguments: [],
  });
  return tx;
}

export { Transaction, SHARE_TYPE };
