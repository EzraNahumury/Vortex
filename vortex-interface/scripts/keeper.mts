/**
 * Vortex vault keeper / strategist executor.
 *
 * One process that plays both roles the vault separates:
 *   - STRATEGIST: signs supply / hedge legs with the ed25519 strategist key (the signature
 *     the on-chain vault verifies).
 *   - KEEPER: submits those signed legs, and permissionlessly redeems settled hedges.
 *
 * Commands:
 *   npx tsx scripts/keeper.mts status
 *   npx tsx scripts/keeper.mts deposit <dUSDC>
 *   npx tsx scripts/keeper.mts allocate [supplyDusdc] [hedgeBudgetDusdc]
 *   npx tsx scripts/keeper.mts unwind [plpAmount]
 *   npx tsx scripts/keeper.mts redeem <oracleId> <expiryMs> <strikeScaled> <isUp> <qty>
 *   npx tsx scripts/keeper.mts demo [totalDusdc]
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
import { buildSupplyLegTx, buildHedgeLegTx, buildWithdrawPlpLegTx, buildRedeemHedgeTx, buildVaultDepositTx } from "../lib/predict/transactions";
import { buildSupplyMessage, buildHedgeMessage, buildWithdrawPlpMessage, strategistKeypair, signLeg } from "../lib/predict/strategist";
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

/**
 * Pick the soonest-expiring oracle that still has a comfortable live trading window.
 * The indexer lists settled-but-unswept oracles as "active" with a past expiry, so blindly
 * taking oracles[0] can hit `assert_live_oracle` (abort 4). Filter to a future expiry first.
 */
function pickLiveOracle<T extends { expiry: string | number }>(oracles: T[], minMinutes = 45): T | undefined {
  const now = Date.now();
  return oracles
    .filter((o) => (Number(o.expiry) - now) / 60000 >= minMinutes)
    .sort((a, b) => Number(a.expiry) - Number(b.expiry))[0];
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
  console.log("== Vortex PLP+Hedge Vault ==");
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

  // --- hedge leg: deep OTM down binary on the soonest *live* oracle ---
  const oracles = await fetchActiveOracles();
  const oracle = pickLiveOracle(oracles);
  if (!oracle) {
    console.log("no live oracle with a long-enough window to hedge");
    return;
  }
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

/** Mint a single OTM-down crash hedge on the soonest live oracle (no supply leg). */
async function hedge(hedgeDusdc: number, otmPct = 2, qtyContracts = 0.5) {
  const v = await readVault();
  const oracles = await fetchActiveOracles();
  const oracle = pickLiveOracle(oracles);
  if (!oracle) {
    console.log("no live oracle with a long-enough window to hedge");
    return;
  }
  const prices = await fetchPricesLatest(oracle.oracle_id);
  if (!prices) {
    console.log("no spot price for oracle; skipping hedge");
    return;
  }
  const spotScaled = prices.spot;
  const tick = oracle.tick_size;
  const strike = Math.floor((spotScaled * (1 - otmPct / 100)) / tick) * tick; // OTM down, snapped to tick
  const budgetBase = hedgeDusdc > 0 ? toQuoteBase(hedgeDusdc) : (v.idle * BigInt(2)) / BigInt(100);
  const quantity = toQuoteBase(qtyContracts);
  const nonce = BigInt(Date.now());
  const strat = strategistKeypair(STRATEGIST_SK);
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
  const mins = Math.round((Number(oracle.expiry) - Date.now()) / 60000);
  console.log(
    `hedge: ${oracle.underlying_asset} put @ $${fromPriceScaled(strike).toFixed(0)} (spot $${fromPriceScaled(spotScaled).toFixed(0)}), budget ${fromQuoteBase(budgetBase)} dUSDC, expiry in ${mins}m`,
  );
  console.log(`  oracle: ${oracle.oracle_id}  expiry: ${oracle.expiry}  strike: ${strike}`);
  await exec(
    buildHedgeLegTx({ oracleId: oracle.oracle_id, expiry: BigInt(oracle.expiry), strike: BigInt(strike), isUp: false, quantity, budgetBase, nonce, signature: sig }),
    "hedge mint",
  );
}

async function deposit(amountDusdc: number) {
  if (!(amountDusdc > 0)) {
    console.error("usage: keeper.mts deposit <dUSDC amount>");
    process.exit(1);
  }
  const kp = keeper();
  const addr = kp.toSuiAddress();
  const coins = await client.getCoins({ owner: addr, coinType: predictConfig.dusdcType });
  if (coins.data.length === 0) {
    console.error("Keeper wallet holds no dUSDC. Request it: https://tally.so/r/Xx102L");
    process.exit(1);
  }
  const top = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance))[0];
  const tx = buildVaultDepositTx(top.coinObjectId, toQuoteBase(amountDusdc));
  await exec(tx, `deposit ${amountDusdc} dUSDC -> vault (mints VAULT_SHARE)`);
}

/** Strategist-signed: unwind PLP back to idle dUSDC. Pass 0 to unwind the full PLP balance. */
async function unwind(plpDusdc: number) {
  const v = await readVault();
  if (v.plp === BigInt(0)) {
    console.log("unwind: vault holds no PLP");
    return false;
  }
  const want = plpDusdc > 0 ? toQuoteBase(plpDusdc) : v.plp;
  const amount = want > v.plp ? v.plp : want;
  const strat = strategistKeypair(STRATEGIST_SK);
  const nonce = BigInt(Date.now());
  const msg = buildWithdrawPlpMessage(predictConfig.vaultId, nonce, amount);
  const sig = await signLeg(strat, msg);
  return exec(buildWithdrawPlpLegTx(amount, nonce, sig), `unwind ${amount.toString()} PLP -> idle`);
}

async function redeem(oracleId: string, expiry: string, strike: string, isUp: string, qtyDusdc: string) {
  if (!oracleId || !expiry || !strike) {
    console.error("usage: keeper.mts redeem <oracleId> <expiryMs> <strikeScaled> <isUp 0|1> <quantityDusdc>");
    console.error("Find settled hedge params via /managers/" + predictConfig.managerId + "/positions/summary");
    process.exit(1);
  }
  const tx = buildRedeemHedgeTx({
    oracleId,
    expiry: BigInt(expiry),
    strike: BigInt(strike),
    isUp: isUp === "1" || isUp === "true",
    quantity: toQuoteBase(Number(qtyDusdc || 1)),
  });
  await exec(tx, `redeem hedge on ${oracleId.slice(0, 10)}`);
  // Unwind PLP back to idle so settled capital is claimable by depositors (trustless withdraw).
  await unwind(0);
}

async function demo(totalDusdc: number) {
  const total = totalDusdc > 0 ? totalDusdc : 10;
  console.log(`\n== full end-to-end demo with ${total} dUSDC ==`);
  await deposit(total);
  await new Promise((r) => setTimeout(r, 2000));
  // 80% supply, 2 dUSDC hedge budget.
  await allocate(Math.floor(total * 0.8), Math.min(2, Math.max(1, Math.floor(total * 0.1))));
  console.log("\nDemo complete. Check status:");
  await status();
}

async function main() {
  const a = process.argv;
  const cmd = a[2] || "status";
  if (cmd === "status") return status();
  if (cmd === "deposit") return deposit(Number(a[3] || 0));
  if (cmd === "allocate") return allocate(Number(a[3] || 0), Number(a[4] || 0));
  if (cmd === "hedge") return hedge(Number(a[3] || 0), a[4] ? Number(a[4]) : 2, a[5] ? Number(a[5]) : 0.5);
  if (cmd === "unwind") return unwind(Number(a[3] || 0));
  if (cmd === "redeem") return redeem(a[3], a[4], a[5], a[6], a[7]);
  if (cmd === "demo") return demo(Number(a[3] || 0));
  console.log("usage: keeper.mts [status | deposit <dUSDC> | allocate <supply> <hedge> | hedge [budget] | unwind [plp] | redeem <oracle> <expiry> <strike> <isUp> <qty> | demo <total>]");
}

main().catch((e) => { console.error(e); process.exit(1); });
