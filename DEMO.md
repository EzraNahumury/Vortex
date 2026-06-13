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
2. Open `http://localhost:3000/predict`, connect a testnet wallet.
3. Request dUSDC (form above) to your wallet.
4. **Deposit** dUSDC → you receive `VAULT_SHARE` (a transferable coin). The "Idle dUSDC" and
   "Vault shares" stats update.
5. **Withdraw** burns shares for your proportional idle dUSDC.
6. Browse the **live SVI vol smile** and **strike ladder** — streamed from the public indexer.

Deposit and withdraw are permissionless. The supply/hedge legs on the shared vault are run by
the maintainer keeper (Path B shows how they work).

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

> Filled after a funded run on the shared vault (deposit → supply leg → hedge leg → redeem).
> Each is a testnet tx digest viewable at `https://suiscan.xyz/testnet/tx/<digest>`.

| Step | Tx digest |
| --- | --- |
| deposit | _pending dUSDC funding_ |
| supply leg | _pending_ |
| hedge mint | _pending_ |
| redeem (settled) | _pending_ |
