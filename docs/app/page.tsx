"use client";

import { useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* nav model                                                           */
/* ------------------------------------------------------------------ */
const NAV: { group: string; items: { id: string; t: string }[] }[] = [
  {
    group: "Getting started",
    items: [
      { id: "introduction", t: "Introduction" },
      { id: "quick-start", t: "Quick start" },
      { id: "architecture", t: "Architecture" },
    ],
  },
  {
    group: "How it works",
    items: [
      { id: "lifecycle", t: "Vault lifecycle" },
      { id: "verifiable", t: "Verifiable strategy" },
    ],
  },
  {
    group: "Smart contracts",
    items: [
      { id: "contracts", t: "Overview" },
      { id: "predictvault", t: "PredictVault" },
      { id: "api", t: "Contract API" },
      { id: "events", t: "Events" },
    ],
  },
  { group: "Deployment", items: [{ id: "deployment", t: "Live addresses" }] },
  {
    group: "Application",
    items: [
      { id: "app", t: "App & structure" },
      { id: "keeper", t: "Keeper & automation" },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "simulation", t: "Simulation" },
      { id: "requirements", t: "Track requirements" },
    ],
  },
];

const FLAT = NAV.flatMap((g) => g.items);
const REPO = "https://github.com/EzraNahumury/Vortex";
const DEMO = "https://vortex-sui.vercel.app";

export default function DocsPage() {
  const [active, setActive] = useState("introduction");
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  // mermaid (load from CDN, render the diagram blocks)
  useEffect(() => {
    const s = document.createElement("script");
    s.type = "module";
    s.textContent =
      "import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';" +
      "mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'inherit' });" +
      "mermaid.run({ querySelector: '.mermaid' });";
    document.body.appendChild(s);
    return () => { document.body.removeChild(s); };
  }, []);

  // scroll-spy
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    FLAT.forEach((i) => { const el = document.getElementById(i.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.t.toLowerCase().includes(q)) })).filter((g) => g.items.length);
  }, [query]);

  return (
    <div className="min-h-screen text-[var(--foreground)]">
      {/* ============================ TOP BAR ============================ */}
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-[var(--border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1500px] items-center gap-4 px-4 sm:px-6">
          <button
            className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--soft)] lg:hidden"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <a href="#introduction" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Vortex" className="h-8 w-8 object-contain" />
            <span className="text-[15px] font-semibold tracking-tight">Vortex <span className="font-normal text-[var(--muted)]">Docs</span></span>
          </a>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden sm:block">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs…"
                className="w-56 rounded-lg border border-[var(--border)] bg-[var(--soft)] py-1.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </div>
            <a href={DEMO} target="_blank" rel="noreferrer" className="hidden rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--soft)] sm:block">Live demo</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]">GitHub</a>
          </div>
        </div>
      </header>

      {/* ============================ LEFT NAV ============================ */}
      <aside
        className={`thin-scroll fixed bottom-0 top-16 z-30 w-[268px] overflow-y-auto border-r border-[var(--border)] bg-white px-4 py-6 transition-transform lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <nav className="space-y-6">
          {filtered.map((g) => (
            <div key={g.group}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{g.group}</p>
              <ul className="space-y-0.5">
                {g.items.map((i) => (
                  <li key={i.id}>
                    <a
                      href={`#${i.id}`}
                      onClick={() => setNavOpen(false)}
                      className={`block rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        active === i.id
                          ? "bg-[var(--accent)]/10 font-medium text-[var(--accent-strong)]"
                          : "text-[#3a4248] hover:bg-[var(--soft)]"
                      }`}
                    >
                      {i.t}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {filtered.length === 0 && <p className="px-2 text-sm text-[var(--muted)]">No matches.</p>}
        </nav>
      </aside>
      {navOpen && <div className="fixed inset-0 top-16 z-20 bg-black/20 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* ============================ MAIN ============================ */}
      <main className="doc px-5 pb-28 pt-24 sm:px-8 lg:ml-[268px] xl:mr-[244px]">
        <div className="doc-fade mx-auto max-w-3xl">

          {/* HERO */}
          <section id="introduction" className="scroll-mt-24">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--soft)] px-6 py-12 text-center sm:px-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Vortex" className="mx-auto h-20 w-20 object-contain" />
              <h1 className="mt-5 text-4xl font-bold tracking-tight">Vortex</h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-[var(--accent-strong)]">PLP + Hedge Vault · DeepBook Predict</p>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#46505a]">
                A structured-yield vault on Sui. Deposit dUSDC, earn the Predict LP maker spread, and ride a
                signed crash-hedge sleeve that caps left-tail drawdown — every allocation verifiable on-chain.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <a href="#quick-start" className="rounded-full bg-[var(--lime)] px-5 py-2.5 text-sm font-semibold text-[#0a1400] transition hover:brightness-95">Quick start</a>
                <a href="#architecture" className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium transition hover:bg-[var(--soft)]">Architecture</a>
              </div>
            </div>

            <H2>What is Vortex?</H2>
            <p>
              Supplying DeepBook Predict&apos;s pool (PLP) earns a steady maker spread — but a single BTC gap-down
              wipes the LP&apos;s left tail. <strong>Vortex</strong> wraps that exposure in a bounded-drawdown shell:
              a one-deposit vault that earns the PLP spread <strong>and</strong> spends a sliver on out-of-the-money
              BTC puts as crash insurance. The product is <em>&ldquo;PLP yield, minus the crash.&rdquo;</em>
            </p>
            <p>
              Your position is a portable <code>VAULT_SHARE</code> coin, and every strategy allocation is authorized
              by an ed25519 strategist signature that is verified on-chain — so anyone can audit exactly what the
              vault did.
            </p>

            <H3>Key features</H3>
            <ul className="my-4 space-y-2">
              {[
                ["Bounded drawdown", "PLP carry minus a small, signed crash hedge — back-tested to roughly halve the left tail."],
                ["Verifiable on-chain", "Every supply / hedge / unwind leg is ed25519-signed and re-verified on-chain with a strictly-increasing nonce."],
                ["Composable share", "Deposits mint a fungible VAULT_SHARE coin, usable as collateral / LP across Sui DeFi."],
                ["Automated keeper", "A GitHub Actions keeper redeems settled hedges and rolls fresh ones, unattended."],
                ["Live", "Frontend on Vercel, vault on Sui testnet — a working product, not a mockup."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span><strong>{t}.</strong> {d}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* QUICK START */}
          <section id="quick-start" className="scroll-mt-24">
            <H2>Quick start</H2>
            <p>The app defaults to the live testnet deployment — no environment setup needed to browse.</p>
            <Code label="terminal">{`cd vortex-interface
npm install
npm run dev      # http://localhost:3000  ->  Connect Wallet  ->  /predict`}</Code>
            <ol className="my-4 list-decimal space-y-2 pl-5">
              <li>Open the app (local, or <a href={DEMO} target="_blank" rel="noreferrer">vortex-sui.vercel.app</a>) and <strong>Connect Wallet</strong> (Sui testnet).</li>
              <li>Request <strong>dUSDC</strong> from the DeepBook form: <a href="https://tally.so/r/Xx102L" target="_blank" rel="noreferrer">tally.so/r/Xx102L</a> (dUSDC is not the normal testnet USDC).</li>
              <li>On <code>/predict</code>, <strong>Deposit</strong> dUSDC → receive a <code>VAULT_SHARE</code> coin.</li>
              <li><strong>Withdraw</strong> burns shares for your proportional idle dUSDC.</li>
            </ol>
          </section>

          {/* ARCHITECTURE */}
          <section id="architecture" className="scroll-mt-24">
            <H2>Architecture</H2>
            <p>The frontend is read-only-real (chain + indexer + events). The keeper runs separately and holds the signing keys — they never touch the frontend.</p>
            <pre className="mermaid">{`flowchart TD
    W([Wallet]) -->|connect / deposit / withdraw| FE["Vortex frontend (Next.js)"]
    FE -->|deposit dUSDC| V["PredictVault dUSDC"]
    V -->|mint 1:1| SH["VAULT_SHARE coin"]
    STR["Strategist (ed25519)"] -. signs every leg .-> V
    K["Keeper (GitHub Actions cron)"] -->|submit signed legs / redeem| V
    V -->|supply / withdraw_plp| P["DeepBook Predict"]
    V -->|hedge / redeem| M["PredictManager (keeper-owned)"]
    M --> P
    P -. SVI surface / events .-> FE`}</pre>
          </section>

          {/* LIFECYCLE */}
          <section id="lifecycle" className="scroll-mt-24">
            <H2>Vault lifecycle</H2>
            <pre className="mermaid">{`stateDiagram-v2
    [*] --> Idle: deposit(dUSDC) - mint VAULT_SHARE
    Idle --> Deployed: execute_supply_leg / execute_hedge_leg
    Deployed --> Deployed: oracle rolls - fresh legs
    Deployed --> Settled: oracle settles
    Settled --> Idle: execute_redeem_hedge - sweep payout
    Deployed --> Idle: execute_withdraw_plp_leg - unwind
    Idle --> [*]: withdraw - burn VAULT_SHARE`}</pre>
          </section>

          {/* VERIFIABLE */}
          <section id="verifiable" className="scroll-mt-24">
            <H2>Verifiable strategy</H2>
            <p>The strategist can never move funds arbitrarily. Each leg carries an ed25519 signature over an exact, domain-separated tuple, re-derived and verified on-chain, with a strictly-increasing nonce for replay protection.</p>
            <pre className="mermaid">{`sequenceDiagram
    participant S as Strategist (off-chain)
    participant K as Keeper (cron)
    participant V as PredictVault (on-chain)
    participant P as DeepBook Predict
    S->>S: msg = TAG, vault_id, nonce, amount, market
    S->>K: ed25519 signature
    K->>V: execute_*_leg(args, signature)
    V->>V: re-derive msg, ed25519_verify, consume_nonce
    V->>P: predict::supply / mint / withdraw / redeem
    Note over V,P: anyone can re-derive the bytes and audit the allocation`}</pre>
            <p>Byte layouts in <code>lib/predict/strategist.ts</code> match <code>vortex_predict::vault</code> exactly:</p>
            <Code label="lib/predict/strategist.ts">{`supply        : 0x01 | vault_id | nonce | amount
hedge         : 0x02 | vault_id | nonce | oracle_id | expiry | strike | is_up | quantity | budget
withdraw_plp  : 0x03 | vault_id | nonce | plp_amount`}</Code>
          </section>

          {/* CONTRACTS OVERVIEW */}
          <section id="contracts" className="scroll-mt-24">
            <H2>Smart contracts — overview</H2>
            <p>
              The submission is a single, dependency-light Move package, <code>vortex_predict</code>, composing the live
              <code> deepbook_predict::predict</code> package. Two modules: <code>vault</code> (the vault + signed legs)
              and <code>vault_share</code> (the share coin).
            </p>
          </section>

          {/* PREDICTVAULT */}
          <section id="predictvault" className="scroll-mt-24">
            <H3>PredictVault&lt;Quote&gt;</H3>
            <p>A shared object holding the vault&apos;s balances and strategy state.</p>
            <Code label="sources/vault.move">{`public struct PredictVault<phantom Quote> has key {
    idle:                Balance<Quote>,   // un-deployed dUSDC
    plp:                 Balance<PLP>,     // supplied to the Predict pool
    share_treasury:      TreasuryCap<VAULT_SHARE>,
    total_shares:        u64,
    supplied:            u64,              // sum supplied to PLP
    hedge_budget_spent:  u64,              // sum spent on hedges
    keeper:              address,          // submits legs, redeems
    strategist_pubkey:   vector<u8>,       // ed25519 verify key
    last_nonce:          u64,              // replay protection
    manager_id:          Option<ID>,       // keeper-owned PredictManager
}`}</Code>
          </section>

          {/* API */}
          <section id="api" className="scroll-mt-24">
            <H2>Contract API</H2>
            <Table
              head={["Function", "Caller", "Purpose"]}
              rows={[
                ["create_vault<Quote>", "deployer", "Bootstrap the vault with a VAULT_SHARE treasury, keeper, and strategist key."],
                ["set_manager<Quote>", "keeper", "Link the keeper-owned PredictManager."],
                ["set_strategist_pubkey<Quote>", "keeper", "Set / rotate the strategist ed25519 key."],
                ["deposit_entry<Quote>", "anyone", "Deposit dUSDC -> mint VAULT_SHARE 1:1."],
                ["withdraw_entry<Quote>", "share holder", "Burn VAULT_SHARE -> claim proportional idle dUSDC."],
                ["execute_supply_leg<Quote>", "keeper (signed)", "Verify signature -> predict::supply idle dUSDC into PLP."],
                ["execute_hedge_leg<Quote>", "keeper (signed)", "Verify signature -> predict::mint an OTM binary via the manager."],
                ["execute_withdraw_plp_leg<Quote>", "keeper (signed)", "Verify signature -> predict::withdraw PLP back to idle."],
                ["execute_redeem_hedge<Quote>", "keeper", "redeem_permissionless a settled hedge; sweep payout to the vault."],
              ]}
            />
            <p className="text-sm text-[var(--muted)]">View functions: <code>idle_balance</code>, <code>plp_balance</code>, <code>total_shares</code>, <code>supplied</code>, <code>hedge_budget_spent</code>, <code>keeper</code>, <code>last_nonce</code>, <code>strategist_pubkey</code>.</p>
          </section>

          {/* EVENTS */}
          <section id="events" className="scroll-mt-24">
            <H2>Events</H2>
            <p>Every action emits a typed event — the <code>/activity</code> page reads these straight from chain.</p>
            <Table
              head={["Event", "Emitted by"]}
              rows={[
                ["Deposited", "deposit"],
                ["Withdrawn", "withdraw"],
                ["SupplyLegExecuted", "execute_supply_leg"],
                ["HedgeLegExecuted", "execute_hedge_leg"],
                ["WithdrawPlpLegExecuted", "execute_withdraw_plp_leg"],
                ["HedgeRedeemed", "execute_redeem_hedge"],
              ]}
            />
          </section>

          {/* DEPLOYMENT */}
          <section id="deployment" className="scroll-mt-24">
            <H2>Live addresses</H2>
            <p>Network: <strong>Sui Testnet</strong>.</p>
            <Table
              head={["Object", "ID"]}
              mono
              rows={[
                ["vortex_predict package", "0x185d97299f82a6380e99779eaed8a51833dada528c05b39e3f537eb01a266e83"],
                ["PredictVault<dUSDC>", "0xa45ebd4f8c87d7c3d1e4cfe20adb4de9594aa5439bb703685facc7bb7c1314f3"],
                ["PredictManager", "0xd38f54d9dbeba98121e81ab39fddd559e2b63577ceecf5404a1e63ad90c9b0fb"],
                ["Predict package", "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138"],
                ["Predict object", "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a"],
                ["dUSDC", "0xe95040...::dusdc::DUSDC"],
              ]}
            />
            <p className="text-sm text-[var(--muted)]">Public indexer: <code>https://predict-server.testnet.mystenlabs.com</code></p>
          </section>

          {/* APP */}
          <section id="app" className="scroll-mt-24">
            <H2>App &amp; project structure</H2>
            <p>The Next.js frontend (<a href={DEMO} target="_blank" rel="noreferrer">live</a>) is real on-chain — every figure comes from the vault object, the indexer, or live events. The Move package and the keeper sit alongside it in one monorepo.</p>
            <FileTree />
            <H3>Routes</H3>
            <Table
              head={["Route", "What it does"]}
              rows={[
                ["/predict", "Deposit / withdraw, live SVI vol smile + strike ladder, vault composition."],
                ["/activity", "Live on-chain event feed (deposit / supply / hedge / unwind / redeem), filterable."],
                ["/redeem", "Open hedge positions, keeper-gated redeem of settled positions."],
                ["/faucet", "Mint testnet tokens."],
              ]}
            />
          </section>

          {/* KEEPER */}
          <section id="keeper" className="scroll-mt-24">
            <H2>Keeper &amp; automation</H2>
            <p>Strategy legs are signed off-chain and submitted by a keeper — run manually or unattended.</p>
            <Code label="terminal">{`cd vortex-interface
npx tsx scripts/keeper.mts status              # read vault + live oracles
npx tsx scripts/keeper.mts supply 5            # supply 5 dUSDC -> PLP
npx tsx scripts/keeper.mts hedge 1 0.5 0.1     # mint OTM-down hedge (budget, OTM%, qty)
npx tsx scripts/keeper.mts unwind              # unwind PLP back to idle
npx tsx scripts/keeper.mts redeem-settled      # redeem every settled-but-open hedge`}</Code>
            <p>
              <code>.github/workflows/keeper.yml</code> runs <code>redeem-settled</code> + a fresh hedge every 30 minutes
              on GitHub Actions. Keys live in repo <strong>Secrets</strong> (<code>DEPLOYER_MNEMONIC</code>,{" "}
              <code>STRATEGIST_SK</code>) — never in the frontend.
            </p>
          </section>

          {/* SIMULATION */}
          <section id="simulation" className="scroll-mt-24">
            <H2>Simulation</H2>
            <p><code>SIMULATION.md</code> back-tests on ~2,000 real settled BTC expiries from the public indexer.</p>
            <Table
              head={["Strategy", "APY", "Max drawdown (calm / 3x vol)"]}
              rows={[
                ["Raw PLP", "~+20%", "~0.05% / ~2.6%"],
                ["PLP + Hedge", "~+13%", "~0.03% / ~1.0%"],
              ]}
            />
            <p>The hedge gives up a slice of carry to roughly halve the left tail — and the gap widens under stress.</p>
          </section>

          {/* REQUIREMENTS */}
          <section id="requirements" className="scroll-mt-24">
            <H2>Track requirements</H2>
            <ul className="my-4 space-y-2">
              {[
                "Integrates the Predict contract on testnet — vortex_predict::vault calls predict::supply / mint / withdraw / redeem_permissionless.",
                "Works end-to-end — deposit, signed supply/hedge legs, settle/redeem, withdraw (verified digests in DEMO.md).",
                "Simulation result — SIMULATION.md, from real settled BTC history.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 font-semibold text-[var(--accent-strong)]">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--soft)] p-5 text-sm text-[var(--muted)]">
              Built for <strong className="text-[var(--foreground)]">Sui Overflow · DeepBook Predict track</strong> — yield you can audit. ·{" "}
              <a href={REPO} target="_blank" rel="noreferrer">GitHub</a> · <a href={DEMO} target="_blank" rel="noreferrer">Live demo</a>
            </div>
          </section>
        </div>
      </main>

      {/* ============================ RIGHT TOC ============================ */}
      <aside className="thin-scroll fixed bottom-0 right-0 top-16 hidden w-[244px] overflow-y-auto px-6 py-8 xl:block">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">On this page</p>
        <ul className="space-y-1.5 border-l border-[var(--border)]">
          {FLAT.map((i) => (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                className={`-ml-px block border-l-2 pl-3 text-[13px] transition-colors ${
                  active === i.id ? "border-[var(--accent)] font-medium text-[var(--accent-strong)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {i.t}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* tiny content primitives                                             */
/* ------------------------------------------------------------------ */
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-12 border-b border-[var(--border)] pb-2 text-2xl font-bold tracking-tight">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-8 text-lg font-semibold">{children}</h3>;
}
function Table({ head, rows, mono }: { head: string[]; rows: string[][]; mono?: boolean }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--soft)]">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2.5 align-top ${j === 0 ? "font-medium" : "text-[#46505a]"} ${mono && j === 1 ? "break-all font-mono text-[12px]" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* mac-window code block */
function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="codewin my-5">
      <div className="bar">
        <span className="dot" style={{ background: "#ff5f57" }} />
        <span className="dot" style={{ background: "#febc2e" }} />
        <span className="dot" style={{ background: "#28c840" }} />
        {label && <span className="ml-2 font-mono text-[11px] text-white/40">{label}</span>}
      </div>
      <pre><code>{children}</code></pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* project structure card (file tree)                                  */
/* ------------------------------------------------------------------ */
const TREE: { name: string; sub: string; color: string; files: [string, string][] }[] = [
  {
    name: "app/", sub: "App Router pages", color: "#d97706",
    files: [
      ["layout.tsx", "root · fonts, providers, navbar"],
      ["page.tsx", "/ → landing"],
      ["predict/page.tsx", "deposit · SVI smile · ladder"],
      ["activity/page.tsx", "on-chain event feed"],
      ["redeem/page.tsx", "settled-hedge redeem"],
      ["faucet/page.tsx", "testnet tokens"],
      ["globals.css", "Tailwind v4 · theme"],
    ],
  },
  {
    name: "components/", sub: "React components", color: "#7c3aed",
    files: [
      ["shared/Navbar.tsx", "nav pill + wallet"],
      ["shared/ConnectButton.tsx", "connect / account"],
      ["shared/AppBackground.tsx", "neon backdrop"],
      ["providers/SuiProvider.tsx", "dapp-kit + wallet"],
      ["ui/", "15+ shadcn primitives"],
    ],
  },
  {
    name: "lib/", sub: "Utilities · config", color: "#2563eb",
    files: [
      ["predict/strategist.ts", "ed25519 leg signing"],
      ["predict/svi.ts", "SVI vol surface"],
      ["predict/server.ts", "indexer client"],
      ["predict/transactions.ts", "PTB builders"],
      ["sui/client.ts", "Sui client (SSR)"],
      ["store/index.ts", "zustand store"],
      ["utils/format.ts", "number / date format"],
    ],
  },
  {
    name: "scripts/", sub: "Keeper · sim", color: "#16a34a",
    files: [
      ["keeper.mts", "supply / hedge / redeem CLI"],
      ["simulate-plp-hedge.mts", "back-test"],
      ["register-enclave.mts", "Nautilus setup"],
    ],
  },
  {
    name: "contracts/vortex_predict/", sub: "Move package", color: "#b45309",
    files: [
      ["sources/vault.move", "vault + signed legs"],
      ["sources/vault_share.move", "VAULT_SHARE coin"],
      ["Move.toml", "package + deps"],
    ],
  },
  {
    name: "public/", sub: "Static assets", color: "#64748b",
    files: [
      ["logo.png", "Vortex mark"],
      ["logosui.png", "Sui logo"],
    ],
  },
];

function FileTree() {
  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--soft)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-white px-5 py-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-5 w-5 object-contain" />
        <span className="font-mono text-sm font-semibold">vortex/</span>
        <span className="text-xs text-[var(--muted)]">Next.js App Router · Move on Sui</span>
      </div>
      <div className="grid gap-3.5 p-3.5 sm:grid-cols-2">
        {TREE.map((f) => (
          <div key={f.name} className="rounded-xl border border-[var(--border)] bg-white p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <FolderIcon color={f.color} />
              <span className="font-mono text-[13px] font-semibold">{f.name}</span>
              <span className="ml-auto text-[10.5px] uppercase tracking-wide text-[var(--muted)]">{f.sub}</span>
            </div>
            <ul className="space-y-1.5">
              {f.files.map(([file, desc]) => (
                <li key={file} className="flex items-baseline gap-2">
                  <FileIcon name={file} />
                  <span className="font-mono text-[12.5px] text-[var(--foreground)]">{file}</span>
                  <span className="truncate text-[11px] text-[var(--muted)]">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function FolderIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color }} aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const dir = name.endsWith("/");
  const ext = name.split(".").pop() || "";
  if (dir) return <FolderIcon color="#94a3b8" />;
  const color =
    ext === "tsx" ? "#2563eb" :
    ext === "ts" || ext === "mts" ? "#16a34a" :
    ext === "css" ? "#db2777" :
    ext === "move" ? "#b45309" :
    ext === "toml" || ext === "lock" ? "#6b7280" :
    ext === "png" || ext === "svg" ? "#0ea5e9" :
    "#94a3b8";
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" style={{ color }} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
