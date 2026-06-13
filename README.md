# Equinox — PLP + Hedge Vault on DeepBook Predict

A structured-yield vault built on **DeepBook Predict** for **Sui Overflow**. Deposit dUSDC,
earn the Predict LP maker spread, and ride a small **signed crash-hedge sleeve** that buys
out-of-the-money BTC binaries to cap left-tail drawdown. Every allocation is authorized by
an ed25519 strategist signature and verified on-chain — *yield you can audit* — and your
position is a portable `VAULT_SHARE` coin.

> Product framing: **"PLP yield minus crash insurance."** A bounded-drawdown wrapper around
> raw short-vol PLP that is easier to sell to outside LPs.

---

## Why this fits the DeepBook Predict track

| Track ask | What we built |
| --- | --- |
| Vault strategies allocating across Predict positions + PLP supply | `equinox_predict::vault` supplies dUSDC to PLP **and** mints OTM binary hedges, atomically, from one shared vault |
| Tokenized share tokens on top of Predict so positions plug into Sui DeFi | Deposits mint a fungible `VAULT_SHARE` coin (portable as collateral / LP / structured-product leg) |
| Keeper / orchestration using `redeem_permissionless` + the public server | `scripts/keeper.mts` signs + submits legs and redeems settled hedges; reads the public indexer |
| Analytics that make Predict legible | `/predict` page renders a **live SVI vol smile** + strike ladder streamed from the indexer |
| Integrate the Predict contract on testnet, work end-to-end, show a simulation | Deployed + linked to the live Predict package; `SIMULATION.md` back-tests on real BTC settlement data |

---

## Live testnet deployment

| Component | ID |
| --- | --- |
| **Our vault package** `equinox_predict` | `0xd4d556eea3435ff1f2a102b784ba1cc00a116c277513f73242409ad762a55e39` |
| **PredictVault\<DUSDC\>** (shared) | `0x14e0ef423ca0d50e0b47b0b225ad3fd510cc2ca2ce6cafc7d4bcabf25596c391` |
| Keeper-owned **PredictManager** | `0x0de4ed88b9c7e7c2fe60b9cb064c45580884389f1cc800f31584366856aa1711` |
| `VAULT_SHARE` TreasuryCap (held by vault) | `0x5bcd8c2326c271e7ed01d4034a8e13bfae8f9a69870882a7fbe2f6dd7329bfb1` |

Composing against the live **DeepBook Predict** protocol (branch `predict-testnet-4-16`):

| Component | ID / value |
| --- | --- |
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict shared object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| Registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` |
| dUSDC quote asset | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| Public indexer | `https://predict-server.testnet.mystenlabs.com` |

Network: **Sui Testnet**. Get testnet dUSDC via the DeepBook form: https://tally.so/r/Xx102L

---

## How it works

```
 depositor ──dUSDC──▶ PredictVault<DUSDC> ──mint──▶ VAULT_SHARE (portable coin)
                          │  idle dUSDC
        strategist signs  │
        each leg (ed25519) ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ execute_supply_leg   → predict::supply  → Balance<PLP> in vault │  (earn maker spread)
   │ execute_hedge_leg    → predict::mint    → OTM down binary       │  (crash insurance)
   │ execute_withdraw_plp → predict::withdraw→ idle dUSDC            │  (unwind)
   │ execute_redeem_hedge → predict::redeem_permissionless          │  (settle payout → vault)
   └──────────────────────────────────────────────────────────────┘
```

1. **Deposit.** `vault::deposit` takes dUSDC and mints `VAULT_SHARE` 1:1 (par; NAV/yield tracked off-chain by the indexer). Shares are a normal `Coin`, so a depositor's position is portable across Sui DeFi.
2. **Supply leg.** The off-chain strategist signs `0x01 | vault_id | nonce | amount`. Anyone can land the signed leg; the vault verifies the signature, splits idle dUSDC, calls `predict::supply`, and banks the returned `Coin<PLP>`.
3. **Hedge leg.** The strategist signs `0x02 | vault_id | nonce | oracle_id | expiry | strike | is_up | quantity | budget`. The keeper (which owns the `PredictManager`) submits it; the vault funds the manager and calls `predict::mint` for a deep-OTM **down** binary that pays $1/contract if BTC gaps through the strike.
4. **Settle.** After an oracle settles, `execute_redeem_hedge` calls `predict::redeem_permissionless` and sweeps the payout back into the vault.
5. **Withdraw.** `vault::withdraw` burns `VAULT_SHARE` for the proportional claim on idle dUSDC (deployed capital is unwound by the keeper first, keeping withdrawals trustless).

### Verifiable strategy (the differentiator)

The strategist can never move funds arbitrarily. Each leg carries an ed25519 signature over
the exact `(amount, market, nonce)` tuple, checked on-chain against the vault's registered
strategist key, with a **strictly increasing nonce** for replay protection. The byte layouts
in `lib/predict/strategist.ts` match `equinox_predict::vault` exactly, so anyone can re-derive
and audit which allocation was authorized.

---

## Simulation

`SIMULATION.md` (generated by `scripts/simulate-plp-hedge.mts`) back-tests the strategy on
**~2,000 real settled BTC expiries** pulled from the public indexer. The hedge is calibrated
from the realized move distribution. Representative result:

| Strategy | APY | Max drawdown |
| --- | --- | --- |
| Raw PLP | ~+20% | ~0.05% (calm) / ~2.6% (3× vol stress) |
| PLP + Hedge | ~+13% | ~0.03% (calm) / ~1.0% (3× vol stress) |

The hedge gives up a slice of steady carry to roughly **halve** the left tail — and the gap
widens sharply in the stress regime. (The BTC move series is real; PLP PnL is modeled as
carry minus short-gamma loss — calibrate against `/predicts/:id/vault/performance` before
trusting absolute APY.)

---

## Repo layout

```
contracts/equinox_predict/        # the Predict vault package (this submission)
  sources/vault.move              # PredictVault: deposit/withdraw + signed supply/hedge/redeem legs
  sources/vault_share.move        # VAULT_SHARE tokenized share coin
  tests/vault_tests.move          # shares, NAV-on-idle withdraw, ed25519 verify (RFC 8032 vector)
equinox-interface/
  lib/predict/                    # config, predict-server client, SVI math, tx builders, strategist signer
  app/predict/page.tsx            # vault UI: deposit/withdraw, live SVI smile, strike ladder
  scripts/simulate-plp-hedge.mts  # strategy back-test → SIMULATION.md
  scripts/keeper.mts              # strategist+keeper: sign & submit legs, redeem settled hedges
contracts/equinox/                # prior work: the Equinox order-book lending protocol (separate)
```

---

## Run it

### Move package

```bash
cd contracts/equinox_predict
sui move build          # links against the deployed Predict package
sui move test           # 5 tests incl. on-chain ed25519 verification
```

> The Predict repo branch ships an unpublished Move.lock, so the build needs the deployed
> package id. We set `published-at = 0xf5ea…5138` on the cached `deepbook_predict` dependency
> and publish with `--allow-dirty`. deepbook/token resolve automatically.

### Frontend

```bash
cd equinox-interface
npm install
npm run dev             # http://localhost:3000/predict
```

Defaults in `lib/predict/config.ts` already point at the live deployment — no env needed to browse. Connect a wallet and request dUSDC (form above) to deposit.

### Keeper / strategist + simulation

```bash
cd equinox-interface
npx tsx scripts/keeper.mts status                 # read vault + live oracles
npx tsx scripts/keeper.mts allocate 80 2          # sign+submit: supply 80, hedge budget 2 dUSDC
npx tsx scripts/simulate-plp-hedge.mts            # regenerate SIMULATION.md
```

Keeper needs `DEPLOYER_MNEMONIC` (keeper wallet) and `STRATEGIST_SK` in `.env.local`.

---

## predict-server endpoints used

`/predicts/:id/oracles` · `/oracles/:id/svi/latest` · `/oracles/:id/prices/latest` ·
`/oracles/:id/state` · `/predicts/:id/vault/summary` · `/managers/:id/positions/summary`

---

## Minimum-requirements checklist

- ✅ **Integrates the DeepBook Predict contract on testnet** — `equinox_predict::vault` calls `predict::supply / mint / withdraw / redeem_permissionless` on the live package; deployed and linked.
- ✅ **Works end-to-end** — deposit → signed supply/hedge legs → settle/redeem → withdraw, exercised by the `/predict` UI and `scripts/keeper.mts`. (Live funding needs testnet dUSDC from the form.)
- ✅ **Simulation result** — `SIMULATION.md` from real settled BTC history.

---

## Prior work

This repo also contains **Equinox Lending** (`contracts/equinox/`, plus the lending pages of
the interface) — an order-book multi-collateral lending protocol with a Nautilus-signed
matcher. The Predict vault reuses its verifiable-signed-allocation pattern, tokenized share
model, and Next.js shell.

Built for Sui Overflow · DeepBook Predict track.
