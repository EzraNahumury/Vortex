# Vortex — Demo Video Script (~2:45)

Screen-recorded walkthrough for judges. Narration in **English** (read it, or use as captions).
Target length **2:30–3:00**. Record at 1080p, cursor visible.

---

## Before you record (prep checklist)

- [ ] Wallet = the **keeper wallet** (`0x8c4551…`), on **Testnet**, with a little SUI gas + some dUSDC.
- [ ] `cd vortex-interface && npm run dev` running, browser at `http://localhost:3000` (or use the live **vortex-sui.vercel.app**).
- [ ] A terminal open in `vortex-interface` for the keeper commands.
- [ ] A Suiscan tab ready (`suiscan.xyz/testnet`).
- [ ] **⚠️ Do NOT show `.env.local` or your seed phrase on screen.** Keep that file/tab closed.
- [ ] Optional: have the GitHub **Actions** tab (green keeper run) and the **README** (Mermaid diagrams) ready in tabs.

---

## Scene 1 — Hook + pitch  (0:00 – 0:25)

**On screen:** Landing page (`/`) — logo, headline "PLP + Hedge Vault, minus the crash."

**Narration:**
> "Supplying a prediction-market pool earns a steady spread — until the market gaps down and wipes
> your tail. **Vortex** fixes that: a one-deposit vault on DeepBook Predict that earns the PLP
> spread **and** buys cheap BTC crash insurance. PLP yield, minus the crash — and every move is
> verifiable on-chain."

**Action:** Click **Connect Wallet** → approve → land on `/predict`.

---

## Scene 2 — The product is real  (0:25 – 1:00)

**On screen:** `/predict` — Live yield tiles, SVI vol smile, strike ladder, vault composition.

**Narration:**
> "This is live, on-chain data — vault state, the protocol's PLP APY and share price, and a **live SVI
> volatility smile** streamed from the indexer. Let's deposit."

**Action:** Type an amount in **Deposit dUSDC** (e.g. `5`) → **Deposit** → approve in wallet.

**Narration (while it confirms):**
> "Deposit mints a **VAULT_SHARE** coin — a portable, composable position. Watch the vault
> composition update: idle and shares go up."

**Action:** Point at "Idle dUSDC" + "Vault shares" updating. Click the toast **tx** link → Suiscan → "real on-chain."

---

## Scene 3 — The verifiable strategy (the differentiator)  (1:00 – 1:45)

**On screen:** Terminal in `vortex-interface`.

**Narration:**
> "The strategy legs aren't blind buttons — each is **signed by the strategist with ed25519 and
> verified on-chain**. The keeper submits them. Let me run them live."

**Action — run, let each print OK + digest:**
```bash
npx tsx scripts/keeper.mts supply 5            # supply dUSDC → Predict PLP
npx tsx scripts/keeper.mts hedge 1 0.5 0.1     # mint an OTM BTC down-binary (crash hedge)
```

**Narration:**
> "Supply routes idle into the PLP pool to earn the spread; hedge mints an out-of-the-money BTC put
> as crash insurance. Both just landed on-chain."

**Action:** Switch to browser → `/predict` → show **PLP Supplied** and **Hedge Spent** increased.
Then open **`/activity`** → the new **Supply** and **Hedge** events appear → click a row → Suiscan.

**Narration:**
> "Every action shows up in the on-chain activity feed — anyone can audit exactly what the strategy did."

---

## Scene 4 — Settle, redeem, automate  (1:45 – 2:20)

**On screen:** `/redeem` page.

**Narration:**
> "When an oracle settles, the payout sweeps back to the vault. Redeem is keeper-gated — and it runs
> **unattended**."

**Action:** Show `/redeem` (open hedge "Settles in Xm", or a settled one). Then switch to the GitHub
**Actions** tab → the green **"Vortex keeper"** run.

**Narration:**
> "A GitHub Actions keeper runs every 30 minutes — redeeming settled hedges and rolling fresh ones.
> Keys live in repo secrets; the frontend never touches them."

---

## Scene 5 — Why it wins + close  (2:20 – 2:45)

**On screen:** README on GitHub (scroll the Mermaid architecture + lifecycle diagrams), then back to the live app.

**Narration:**
> "So: a **deployed, working** PLP-plus-hedge vault — not a dashboard or a concept. Every allocation
> **signed and verified on-chain**, the full deposit-to-redeem cycle proven with real digests, a
> portable share token, an automated keeper, and a live app. **Yield you can audit.** That's Vortex,
> built for the DeepBook Predict track."

**On screen (end card / show links):**
- Demo: `vortex-sui.vercel.app`
- Code: `github.com/EzraNahumury/Vortex`
- Vault (Sui testnet): `0xa45ebd…1314f3`

---

## One-liner (for the submission blurb / thumbnail)

> **Vortex — PLP yield, minus the crash.** A verifiable, on-chain PLP+hedge vault on DeepBook Predict.
> Deployed, live, and keeper-automated.

## Tips
- Keep it moving — if a tx is slow, cut/speed up the wait in editing.
- Show **one Suiscan digest** at least once — proves it's real.
- End on the live app + links, not the terminal.
