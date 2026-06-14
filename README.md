# Vortex — PLP + Hedge Vault on DeepBook Predict

> **PLP yield, minus the crash.** A structured-yield vault on Sui's **DeepBook Predict**:
> deposit dUSDC, earn the Predict LP maker spread, and ride a signed crash-hedge sleeve that
> buys out-of-the-money BTC binaries to cap left-tail drawdown — every allocation authorized by
> an ed25519 strategist signature and verified on-chain. *Yield you can audit.*

Built for **Sui Overflow · DeepBook Predict track**. Live on **Sui testnet**.

---

## TL;DR

Raw PLP (supplying the Predict pool) earns a steady maker spread but wears the **full left tail**
when BTC gaps down. Vortex wraps it in a bounded-drawdown shell:

| | Earns | Costs | Result |
| --- | --- | --- | --- |
| **Supply leg** → `predict::supply` | PLP maker spread | — | steady carry |
| **Hedge leg** → `predict::mint` | — | small premium | OTM BTC put = crash insurance |
| **= Vortex** | most of the yield | a slice of carry | **bounded drawdown**, easier to sell to outside LPs |

Your position is a portable **`VAULT_SHARE`** coin — composable across Sui DeFi.

---

## Architecture

```
                          ┌──────────────────────────────────────────────┐
   wallet ── connect ──▶  │           Vortex frontend  (Next.js)           │
                          │   /predict    /activity    /redeem   /faucet   │
                          └─────┬───────────────┬──────────────┬──────────┘
                       deposit / │   on-chain     │   keeper-gated │
                       withdraw  │   event feed   │   redeem       │
                                 ▼                ▼                ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │            vortex_predict::vault   —   PredictVault<dUSDC>           │
        │   deposit → mint VAULT_SHARE      idle dUSDC      keeper + strategist │
        └─────────┬─────────────────────────────────────────────────┬────────┘
       strategist signs each leg (ed25519, strictly-increasing nonce) │ owns
                  ▼                                                    ▼
   ┌─────────────────────────────────────────────────┐     ┌────────────────────┐
   │  execute_supply_leg       → predict::supply      │     │   PredictManager    │
   │  execute_hedge_leg        → predict::mint        │ ──▶ │ (per-vault account, │
   │  execute_withdraw_plp_leg → predict::withdraw    │     │  keeper-owned)      │
   │  execute_redeem_hedge     → redeem_permissionless│     └────────────────────┘
   └──────────────────────────────┬──────────────────┘
                                   ▼
        DeepBook Predict protocol (live testnet)   +   public indexer / SVI feed
```

### Lifecycle

```
 Deposit ──▶ Supply leg ──▶ Hedge leg ──▶ Settle ──▶ Redeem ──▶ Withdraw
  (user)     PLP spread     crash ins.    (oracle)   sweep →     (user)
   mint                                              vault idle   burn
 VAULT_SHARE                                                      VAULT_SHARE
   └────────── user-driven (UI) ──────────┘   └─ keeper / strategist, off-app ─┘   └─ user (UI) ─┘
```

### Verifiable strategy (the differentiator)

The strategist can **never move funds arbitrarily**. Each leg carries an ed25519 signature over an
exact, domain-separated tuple; the vault re-derives the same bytes on-chain and verifies them
against its registered strategist key, with a strictly-increasing nonce for replay protection.

```
 strategist  msg = TAG | vault_id | nonce | amount [| oracle | expiry | strike | is_up | qty | budget]
             sig = ed25519_sign(strategist_sk, msg)
 ───────────────────────────────────────────────────────────────────────────────────────────────
 on-chain    vault re-derives msg  →  ed25519_verify(sig, strategist_pubkey)  →  consume_nonce  →  execute
             ↳ anyone can re-derive the bytes and audit exactly which allocation was authorized
```

Byte layouts in `lib/predict/strategist.ts` match `vortex_predict::vault` exactly.

---

## How it works

1. **Deposit.** `vault::deposit` takes dUSDC and mints `VAULT_SHARE` (par; NAV/yield tracked off-chain by the indexer). Shares are a normal `Coin`, portable across Sui DeFi.
2. **Supply leg.** Strategist signs `0x01 | vault_id | nonce | amount`. Anyone can land the signed leg; the vault verifies, splits idle dUSDC, calls `predict::supply`, and banks the returned `Coin<PLP>`.
3. **Hedge leg.** Strategist signs `0x02 | vault_id | nonce | oracle_id | expiry | strike | is_up | quantity | budget`. The keeper (which owns the `PredictManager`) submits it; the vault funds the manager and calls `predict::mint` for a deep-OTM **down** binary that pays $1/contract if BTC gaps through the strike.
4. **Settle & redeem.** After an oracle settles, `execute_redeem_hedge` calls `predict::redeem_permissionless` and sweeps the payout back into the vault.
5. **Withdraw.** `vault::withdraw` burns `VAULT_SHARE` for the proportional claim on idle dUSDC (deployed capital is unwound by the keeper first, keeping withdrawals trustless).

---

## The app

A focused, **real on-chain** interface — every figure is read from the vault object, the public
indexer, or live events (no mock data in the product flow).

| Route | What it does | Source |
| --- | --- | --- |
| `/` | Landing — Connect Wallet routes into the vault | — |
| `/predict` | Deposit / withdraw dUSDC, live **SVI vol smile** + strike ladder, vault composition (idle / PLP / hedge / shares) | vault object + indexer + wallet |
| `/activity` | Live **on-chain event feed** — deposit / supply / hedge / unwind / redeem / withdraw, filterable, each linking to Suiscan | `queryEvents` |
| `/redeem` | Open hedge positions; **keeper-gated** redeem of settled positions | manager indexer + on-chain |
| `/faucet` | Mint testnet tokens | on-chain mint |

The **supply / hedge / unwind** legs are not UI buttons by design — they are strategist-signed and
run by the keeper (`scripts/keeper.mts`), which is exactly what makes the strategy auditable.

---

## Live testnet deployment

| Component | ID |
| --- | --- |
| **Our vault package** `vortex_predict` | `0x185d97299f82a6380e99779eaed8a51833dada528c05b39e3f537eb01a266e83` |
| **PredictVault\<dUSDC\>** (shared) | `0xa45ebd4f8c87d7c3d1e4cfe20adb4de9594aa5439bb703685facc7bb7c1314f3` |
| Keeper-owned **PredictManager** | `0xd38f54d9dbeba98121e81ab39fddd559e2b63577ceecf5404a1e63ad90c9b0fb` |
| `VAULT_SHARE` TreasuryCap (held by vault) | `0x7cfeecdbea4c0dbe0815c9b36f7d916e3650e2b2a08acd51a78b898f3fa01342` |

Composing against the live **DeepBook Predict** protocol (branch `predict-testnet-4-16`):

| Component | ID / value |
| --- | --- |
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict shared object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| Registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` |
| dUSDC quote asset | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| Public indexer | `https://predict-server.testnet.mystenlabs.com` |

Network: **Sui Testnet**. Get testnet dUSDC via the DeepBook form: https://tally.so/r/Xx102L
(dUSDC is **not** the normal testnet USDC.)

A funded `deposit → supply → hedge → redeem` cycle has been run on the shared vault — the verified
tx digests are in **[DEMO.md](DEMO.md)** (Live run record).

---

## Simulation

`SIMULATION.md` (generated by `scripts/simulate-plp-hedge.mts`) back-tests the strategy on
**~2,000 real settled BTC expiries** pulled from the public indexer. The hedge is calibrated from
the realized-move distribution. Representative result:

| Strategy | APY | Max drawdown (calm / 3× vol stress) |
| --- | --- | --- |
| Raw PLP | ~+20% | ~0.05% / ~2.6% |
| **PLP + Hedge** | ~+13% | **~0.03% / ~1.0%** |

The hedge gives up a slice of steady carry to **roughly halve the left tail** — and the gap widens
sharply under stress. (BTC move series is real; PLP PnL is modeled as carry minus short-gamma loss
— calibrate against `/predicts/:id/vault/performance` before trusting absolute APY.)

---

## Run it

### Move package

```bash
cd contracts/vortex_predict
sui move build          # links against the deployed Predict package
sui move test           # on-chain ed25519 verification incl. RFC 8032 vector
```

> The Predict branch ships an unpublished `Move.lock`, so the build needs the deployed package id.
> `setup-dep.sh` patches the cached `deepbook_predict` dependency with `published-at = 0xf5ea…5138`;
> publish with `--allow-dirty`. deepbook / token resolve automatically.

### Frontend

```bash
cd vortex-interface
npm install
npm run dev             # http://localhost:3000  →  Connect Wallet  →  /predict
```

Defaults in `lib/predict/config.ts` already point at the live deployment — **no env needed to
browse**. Connect a wallet and request dUSDC (form above) to deposit.

### Keeper / strategist + simulation

```bash
cd vortex-interface
npx tsx scripts/keeper.mts status              # read vault + live oracles
npx tsx scripts/keeper.mts supply 5            # sign + land a supply leg (5 dUSDC → PLP)
npx tsx scripts/keeper.mts hedge 1 0.5 0.1     # mint an OTM-down hedge (budget, OTM%, qty)
npx tsx scripts/keeper.mts unwind              # unwind PLP back to idle
npx tsx scripts/keeper.mts redeem <oracle> <expiry> <strike> <isUp> <qty>   # after settlement
npx tsx scripts/keeper.mts demo 10             # full deposit → supply → hedge in one shot
npx tsx scripts/simulate-plp-hedge.mts         # regenerate SIMULATION.md
```

Keeper needs `DEPLOYER_MNEMONIC` (keeper wallet, owns the `PredictManager`) and `STRATEGIST_SK` in
`.env.local`. See **[DEMO.md](DEMO.md)** for the full step-by-step.

---

## Repo layout

```
contracts/vortex_predict/         # the Predict vault package (this submission)
  sources/vault.move               # PredictVault: deposit/withdraw + signed supply/hedge/unwind/redeem legs
  sources/vault_share.move         # VAULT_SHARE tokenized share coin
  tests/vault_tests.move           # shares, NAV-on-idle withdraw, ed25519 verify
vortex-interface/                  # Next.js app (real on-chain)
  app/predict | activity | redeem | faucet     # the product
  lib/predict/                     # config, indexer client, SVI math, tx builders, strategist signer
  scripts/keeper.mts               # strategist + keeper: sign & submit legs, redeem settled hedges
  scripts/simulate-plp-hedge.mts   # strategy back-test → SIMULATION.md
contracts/vortex/                  # prior work: Vortex order-book lending protocol (separate)
```

---

## DeepBook Predict track — minimum requirements

- ✅ **Integrates the Predict contract on testnet** — `vortex_predict::vault` calls `predict::supply / mint / withdraw / redeem_permissionless` on the live package; deployed and linked.
- ✅ **Works end-to-end** — deposit → signed supply/hedge legs → settle/redeem → withdraw, via the `/predict` UI + `scripts/keeper.mts`; verified tx digests in **[DEMO.md](DEMO.md)**.
- ✅ **Simulation result** — `SIMULATION.md`, from real settled BTC history.

Also surfaces the idea-bank's **live SVI surface viewer** (`/predict`), a **settled-redeem keeper**
(`scripts/keeper.mts`, `/redeem`), an **on-chain analytics feed** (`/activity`), and a **tokenized
share** (`VAULT_SHARE`) for composability.

---

## Prior work

This repo also contains **Vortex Lending** (`contracts/vortex/` + the lending pages of the interface)
— an order-book multi-collateral lending protocol with a Nautilus-signed matcher. The Predict vault
reuses its verifiable-signed-allocation pattern, tokenized-share model, and Next.js shell. The
lending pages are kept in the repo but are not part of the Predict app flow.

Built for **Sui Overflow · DeepBook Predict track**.
