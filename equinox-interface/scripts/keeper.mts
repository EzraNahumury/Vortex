/**
 * Equinox vault keeper / strategist executor.
 *
 * One process that plays both roles the vault separates:
 *   - STRATEGIST: signs supply / hedge legs with the ed25519 strategist key (the signature
 *     the on-chain vault verifies).
 *   - KEEPER: submits those signed legs, and permissionlessly redeems settled hedges.
 *
 * Commands:
 *   npx tsx scripts/keeper.mts status
 *   npx tsx scripts/keeper.mts allocate [supplyDusdc] [hedgeBudgetDusdc]
 *   npx tsx scripts/keeper.mts redeem
 *
 * Env (.env.local or process env):
 *   DEPLOYER_MNEMONIC   — keeper wallet (must own the PredictManager); falls back to active CLI key is NOT supported here
 *   STRATEGIST_SK       — strategist ed25519 secret (suiprivkey...); defaults to the dev key
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

import { predictConfig, toQuoteBase, fromQuoteBase, fromPriceScaled } from "../lib/predict/config";
import { buildSupplyLegTx, buildHedgeLegTx, buildRedeemHedgeTx } from "../lib/predict/transactions";
import { buildSupplyMessage, buildHedgeMessage, strategistKeypair, signLeg } from "../lib/predict/strategist";
import { fetchActiveOracles, fetchPricesLatest } from "../lib/predict/server";

function loadEnv(): Record<string, string> {
  try {
    const p = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(p)) return {};
    const out: Record<string, string> = {};
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) out[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const env = loadEnv();
const MNEMONIC = env.DEPLOYER_MNEMONIC || process.env.DEPLOYER_MNEMONIC;
const STRATEGIST_SK =
  env.STRATEGIST_SK ||
  process.env.STRATEGIST_SK ||
  "suiprivkey1qp7xaa93x2h45kn09hp86xzmtcxq0qfpcmpz2j8qg6tjgmh7e4xekulepmr"; // dev default

const client = new SuiJsonRpcClient({
  url: predictConfig.rpcUrl || getJsonRpcFullnodeUrl("testnet"),
  network: "testnet" as never,
});

function keeper(): Ed25519Keypair {
  if (!MNEMONIC) {
    console.error("Set DEPLOYER_MNEMONIC in .env.local (the keeper wallet that owns the PredictManager).");
    process.exit(1);
  }
  return Ed25519Keypair.deriveKeypair(MNEMONIC);
}

async function readVault() {
  const obj = await client.getObject({ id: predictConfig.vaultId, options: { showContent: true } });
  const f = (obj.data?.content as { fields?: Record<string, string> })?.fields ?? {};
  return {
    idle: BigInt(f.idle ?? "0"),
    plp: BigInt(f.plp ?? "0"),
    totalShares: BigInt(f.total_shares ?? "0"),
    supplied: BigInt(f.supplied ?? "0"),
    hedgeSpent: BigInt(f.hedge_budget_spent ?? "0"),
    lastNonce: BigInt(f.last_nonce ?? "0"),
    keeperAddr: f.keeper as string,
  };
}

async function status() {
  const v = await readVault();
  console.log("== Equinox PLP+Hedge Vault ==");
  console.log("vault       :", predictConfig.vaultId);
  console.log("predict obj :", predictConfig.predictObjectId);
  console.log("manager     :", predictConfig.managerId);
  console.log("keeper       :", v.keeperAddr);
  console.log("idle dUSDC  :", fromQuoteBase(v.idle));
  console.log("PLP held    :", v.plp.toString());
  console.log("shares      :", fromQuoteBase(v.totalShares));
  console.log("supplied Σ  :", fromQuoteBase(v.supplied));
  console.log("hedge Σ     :", fromQuoteBase(v.hedgeSpent));
  console.log("last nonce  :", v.lastNonce.toString());
  const oracles = await fetchActiveOracles();
  console.log(`active oracles: ${oracles.length}`, oracles.slice(0, 3).map((o) => o.oracle_id.slice(0, 10)).join(", "));
}

async function exec(tx: ReturnType<typeof buildSupplyLegTx>, label: string) {
  const kp = keeper();
  tx.setSender(kp.toSuiAddress());
  const res = await client.signAndExecuteTransaction({
    signer: kp,
    transaction: tx,
    options: { showEffects: true },
  });
  const ok = res.effects?.status.status === "success";
  console.log(`${label}: ${ok ? "OK" : "FAILED"} ${res.digest}`);
  if (!ok) console.log("  error:", res.effects?.status.error);
  return ok;
}

async function allocate(supplyDusdc: number, hedgeDusdc: number) {
  const v = await readVault();
  if (v.idle === BigInt(0)) {
    console.error("Vault idle balance is 0. Deposit dUSDC first (faucet: https://tally.so/r/Xx102L).");
    process.exit(1);
  }
  const strat = strategistKeypair(STRATEGIST_SK);

  // --- supply leg ---
  const supplyBase = supplyDusdc > 0 ? toQuoteBase(supplyDusdc) : (v.idle * BigInt(80)) / BigInt(100);
  if (supplyBase > BigInt(0) && supplyBase <= v.idle) {
    const nonce = BigInt(Date.now());
    const msg = buildSupplyMessage(predictConfig.vaultId, nonce, supplyBase);
    const sig = await signLeg(strat, msg);
    await exec(buildSupplyLegTx(supplyBase, nonce, sig), `supply ${fromQuoteBase(supplyBase)} dUSDC`);
  }

  // --- hedge leg: deep OTM down binary on the nearest active oracle ---
  const oracles = await fetchActiveOracles();
  if (oracles.length === 0) {
    console.log("no active oracles to hedge against");
    return;
  }
  const oracle = oracles[0];
  const prices = await fetchPricesLatest(oracle.oracle_id);
  if (!prices) {
    console.log("no spot price for oracle; skipping hedge");
    return;
  }
  const spotScaled = prices.spot;
  const tick = oracle.tick_size;
  const strike = Math.floor((spotScaled * 0.95) / tick) * tick; // 5% OTM, snapped to tick
  const budgetBase = hedgeDusdc > 0 ? toQuoteBase(hedgeDusdc) : (v.idle * BigInt(2)) / BigInt(100);
  const quantity = toQuoteBase(1); // 1 contract (pays $1 at settlement)
  const nonce = BigInt(Date.now() + 1);
  const msg = buildHedgeMessage({
    vaultId: predictConfig.vaultId,
    nonce,
    oracleId: oracle.oracle_id,
    expiry: BigInt(oracle.expiry),
    strike: BigInt(strike),
    isUp: false,
    quantity,
    budget: budgetBase,
  });
  const sig = await signLeg(strat, msg);
  console.log(`hedge: ${oracle.underlying_asset} put @ $${fromPriceScaled(strike).toFixed(0)} (spot $${fromPriceScaled(spotScaled).toFixed(0)}), budget ${fromQuoteBase(budgetBase)} dUSDC`);
  await exec(
    buildHedgeLegTx({ oracleId: oracle.oracle_id, expiry: BigInt(oracle.expiry), strike: BigInt(strike), isUp: false, quantity, budgetBase: budgetBase, nonce, signature: sig }),
    "hedge mint",
  );
}

async function main() {
  const cmd = process.argv[2] || "status";
  if (cmd === "status") return status();
  if (cmd === "allocate") return allocate(Number(process.argv[3] || 0), Number(process.argv[4] || 0));
  if (cmd === "redeem") {
    console.log("redeem: provide oracle/expiry/strike of a settled hedge to redeem.");
    console.log("Use buildRedeemHedgeTx(...) once the target hedge is identified from /managers/:id/positions/summary.");
    return;
  }
  console.log("usage: keeper.mts [status|allocate <supplyDusdc> <hedgeDusdc>|redeem]");
}

main().catch((e) => { console.error(e); process.exit(1); });
