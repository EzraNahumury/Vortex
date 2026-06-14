# Vortex PLP+Hedge Vault — End-to-End Test Guide

Two ways to exercise the flow. Path A needs nothing but a wallet; Path B gives you full
control of your own vault.

All objects are on **Sui testnet**. dUSDC is **not** the normal testnet USDC — request it via
the DeepBook form: https://tally.so/r/Xx102L

Live objects:
- Vault package: `0x185d97299f82a6380e99779eaed8a51833dada528c05b39e3f537eb01a266e83`
- PredictVault\<DUSDC\>: `0xa45ebd4f8c87d7c3d1e4cfe20adb4de9594aa5439bb703685facc7bb7c1314f3`
- PredictManager: `0xd38f54d9dbeba98121e81ab39fddd559e2b63577ceecf5404a1e63ad90c9b0fb`
- Predict (live protocol): `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`

The strategist signing key used by the deployed vault is a **throwaway testnet key**,
published here so reviewers can reproduce signed legs:

```
STRATEGIST_SK = suiprivkey1qp7xaa93x2h45kn09hp86xzmtcxq0qfpcmpz2j8qg6tjgmh7e4xekulepmr
pubkey        = 88a1abc4e248b057731f309b0c7a847d916556f13113d2a71fef1d22330ba39a
```

---

## Path A — test against the live vault (UI, ~2 min)

1. `cd vortex-interface && npm install && npm run dev`
2. Open `http://localhost:3000`, click **Connect Wallet** (testnet wallet) → you land on
   `/predict`, already connected. Nav: **Predict · Activity · Redeem · Faucet**.
3. Request dUSDC (form above) to your wallet.
4. **Predict** — enter an amount and **Deposit** dUSDC → you receive `VAULT_SHARE` (a transferable
   coin); the "Idle dUSDC" and "Vault shares" stats update. Browse the **live SVI vol smile** and
   **strike ladder**, streamed from the public indexer.
5. **Withdraw** burns shares for your proportional idle dUSDC.
6. **Activity** — every deposit / supply / hedge / unwind / redeem / withdraw, read live from
   on-chain events, filterable, each row linking to Suiscan.
7. **Redeem** — open hedge positions; once an oracle settles, redeem sweeps the payout back to the
   vault (keeper-gated).

Every figure on these pages is read from the chain / indexer — no mock data. Deposit and withdraw
are permissionless; the supply/hedge legs on the shared vault are run by the maintainer keeper
(Path B shows how they work).

---

## Path B — full self-serve end-to-end (you are keeper + strategist)

Because the per-vault `VAULT_SHARE` TreasuryCap and the keeper-owned `PredictManager` are
created at deploy time, running the *complete* deposit→supply→hedge→redeem cycle under your
own keys means publishing your own instance (one-time):

```bash
# 0. Prereqs: sui CLI on testnet, a wallet with SUI gas + dUSDC.
cd contracts/vortex_predict
sui move test                      # 5/5 pass (incl. on-chain ed25519 verify)

# 1. Publish your instance (links to the live Predict package).
#    The Predict branch ships an unpublished Move.lock; this helper patches the cached dep
#    with the deployed published-at so publish links instead of republishing:
bash setup-dep.sh
sui client publish --gas-budget 300000000 --allow-dirty
#   -> note PACKAGE_ID and the created TreasuryCap<VAULT_SHARE>

# 2. Create the vault + manager (use your strategist pubkey from strategist.ts / a fresh key).
sui client call --package <PACKAGE_ID> --module vault --function create_vault \
  --type-args 0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC \
  --args <TREASURY_CAP_ID> <YOUR_ADDRESS> "[<32 pubkey bytes>]" --gas-budget 100000000
sui client call --package <PREDICT> --module predict --function create_manager --gas-budget 100000000
sui client call --package <PACKAGE_ID> --module vault --function set_manager \
  --type-args ...DUSDC --args <VAULT_ID> <MANAGER_ID> --gas-budget 100000000

# 3. Point the keeper at your instance and run the whole cycle.
cd ../../vortex-interface
#   set in .env.local: NEXT_PUBLIC_VAULT_PACKAGE_ID, NEXT_PUBLIC_VAULT_ID,
#   NEXT_PUBLIC_VAULT_MANAGER_ID, DEPLOYER_MNEMONIC (keeper), STRATEGIST_SK
npx tsx scripts/keeper.mts status
npx tsx scripts/keeper.mts demo 10        # deposit 10 dUSDC, supply 8, hedge ~1
#   -> prints supply + hedge tx digests
npx tsx scripts/keeper.mts redeem <oracleId> <expiryMs> <strikeScaled> 0 1   # after settlement
```

---

## Simulation

```bash
cd vortex-interface
npx tsx scripts/simulate-plp-hedge.mts     # back-test on real settled BTC data -> ../SIMULATION.md
```

---

## Live run record

Funded run on the shared vault, keeper `0x8c4551…`, epoch 1130 (2026-06-14). Each digest is
viewable at `https://suiscan.xyz/testnet/tx/<digest>`. Final vault state confirms the flow:
`total_shares 10.0 · supplied 8.0 · plp 7.983 · hedge_budget_spent 1.0 · idle 1.0` (dUSDC).

| Step | Tx digest | Status |
| --- | --- | --- |
| deposit — 10 dUSDC → 10 VAULT_SHARE | `26YYNBhK3qrupgxy88QmUUU6N1AAH8Y8BmTNMvQG4QPz` | ✅ success |
| supply leg — 8 dUSDC → Predict PLP | `CCAVmHVDn8xEjHzwVJcaCZTdXvDagxvtkxQ9ujgrgDFT` | ✅ success |
| hedge mint — BTC down-binary, 1 dUSDC budget | `E6Xdw51ZVRtAp9H4XnsX2ASxyHmsduGWnYB98JdQriRb` | ✅ success |
| redeem — settled & closed on-chain | `9tsAHnK6Er9qPR15jReujozpGLtRSr5p7yqAeJAgrdzr` | ✅ success |

> **Hedge strike note.** On testnet the Predict PLP only quotes mintable asks within ~±0.5% of
> spot, so the demo hedge is a 0.5%-OTM BTC down-binary; `assert_mintable_ask` rejects deeper
> strikes for lack of pool depth. The strategy targets deeper OTM where liquidity allows — the
> on-chain mechanism (strategist-signed leg → `predict::mint` via the keeper-owned manager) is
> identical at any strike.

**Settlement & redeem.** Oracle `0x66cad881…` settled at **$64,328** (`settlement_price
64328025031967`) — above the $63,960 strike, so the down-binary expired worthless: payout 0,
premium −0.005426 dUSDC. That is the hedge behaving exactly as designed: a small carry cost
when no crash occurs (it would have paid $1/contract on a deep down-move). The settled position
was closed on-chain via `predict::redeem_permissionless` — permissionless by design, so any
keeper can settle it (here tx `9tsAHnK6Er9qPR15jReujozpGLtRSr5p7yqAeJAgrdzr`, redeemer
`0x49c56c…`). The vault's own `execute_redeem_hedge` sweep is a no-op once a position has already
been permissionlessly redeemed; on a winning hedge it sweeps the payout back into vault idle.
