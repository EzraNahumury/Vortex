"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectModal, useCurrentAccount } from "@mysten/dapp-kit";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Activity,
  TrendingDown,
  Layers,
  Lock,
  Check,
  Star,
  Menu,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Connect Wallet CTA — opens the dapp-kit modal, then routes to the   */
/* dashboard. Wallet state is global, so the dashboard opens connected.*/
/* ------------------------------------------------------------------ */
function ConnectCTA({
  className,
  label = "Connect Wallet",
}: {
  className?: string;
  label?: string;
}) {
  const account = useCurrentAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (armed && account?.address) router.push("/predict");
  }, [armed, account?.address, router]);

  if (account?.address) {
    return (
      <button onClick={() => router.push("/predict")} className={className}>
        Open Vault
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    );
  }

  return (
    <ConnectModal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Arm the redirect only while the modal is open. If the user closes
        // the modal without connecting, disarm so a later auto-connect or a
        // connect from elsewhere doesn't yank them to the dashboard.
        setArmed(o && !account?.address);
      }}
      trigger={
        <button className={className}>
          {label}
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </button>
      }
    />
  );
}

const NAV = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how" },
  { label: "About", href: "#about" },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="lp-root font-display relative min-h-screen overflow-x-clip">
      {/* background layers */}
      <div className="lp-grid pointer-events-none absolute inset-0 z-0" />
      <div className="lp-glow lp-pulse-glow pointer-events-none absolute -top-40 right-[-10%] z-0 h-[560px] w-[560px]" />
      <div className="lp-glow pointer-events-none absolute top-[80%] left-[-12%] z-0 h-[460px] w-[460px] opacity-60" />

      {/* ============================ NAVBAR ============================ */}
      <header className="relative z-30 mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="#home" className="flex items-center gap-2">
          <Image src="/logofix.png" alt="Vortex" width={34} height={34} priority className="h-[34px] w-[34px] object-contain" />
          <span className="text-lg font-semibold tracking-tight">
            Vortex<span className="lp-neon-text">.</span>
          </span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="lp-muted rounded-full px-4 py-2 text-sm transition-colors hover:text-[var(--lp-text)]"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--lp-border)] px-3 py-1.5 text-xs lp-muted sm:flex">
            <span className="h-2 w-2 rounded-full bg-[var(--lp-neon)]" />
            Testnet
          </span>
          <ConnectCTA className="lp-btn-neon hidden items-center rounded-full px-5 py-2.5 text-sm font-semibold sm:inline-flex" />
          <button
            className="lp-btn-ghost inline-flex h-9 w-9 items-center justify-center rounded-full md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="relative z-30 mx-auto max-w-[1240px] px-5 md:hidden">
          <div className="lp-card flex flex-col gap-1 rounded-2xl p-3">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="lp-muted rounded-xl px-4 py-2.5 text-sm hover:bg-white/5 hover:text-[var(--lp-text)]"
              >
                {n.label}
              </a>
            ))}
            <ConnectCTA className="lp-btn-neon mt-1 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold" />
          </div>
        </div>
      )}

      {/* ============================= HERO ============================= */}
      <section
        id="home"
        className="relative z-10 mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-12 px-5 pt-10 pb-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16"
      >
        {/* ghost wordmark — faint, behind the mockup on the right */}
        <span className="lp-ghost pointer-events-none absolute right-[-3%] top-1/2 -z-10 hidden -translate-y-1/2 select-none whitespace-nowrap text-[120px] leading-none lg:block xl:text-[150px]">
          VORTEX
        </span>

        {/* hero left */}
        <div>
          <div className="lp-reveal mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide" style={{ animationDelay: "0ms" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lp-neon)]" />
            <span className="lp-muted">VERIFIABLE YIELD · DEEPBOOK PREDICT</span>
          </div>

          <h1 className="lp-reveal text-[clamp(40px,7vw,76px)] font-bold leading-[0.98]" style={{ animationDelay: "80ms" }}>
            PLP yield, <br className="hidden sm:block" />
            <span className="lp-neon-text">minus the crash.</span>
          </h1>

          <p className="lp-reveal lp-muted mt-6 max-w-xl text-[15px] leading-relaxed" style={{ animationDelay: "160ms" }}>
            A structured-yield vault on Sui&apos;s DeepBook Predict. Deposit dUSDC, earn the
            Predict LP maker spread, and ride a <span className="text-[var(--lp-text)]">signed crash-hedge sleeve</span> that
            buys out-of-the-money BTC binaries to cap your left-tail drawdown.
          </p>

          {/* stat cluster */}
          <div className="lp-reveal mt-9 flex flex-wrap items-center gap-x-9 gap-y-5" style={{ animationDelay: "240ms" }}>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">~13%</span>
                <span className="lp-neon-text text-xl font-bold">+</span>
              </div>
              <p className="lp-muted mt-0.5 text-xs">Net APY (PLP + Hedge)</p>
            </div>
            <div className="h-9 w-px bg-[var(--lp-border)]" />
            <div>
              <span className="text-3xl font-bold">~2×</span>
              <p className="lp-muted mt-0.5 text-xs">Lower left-tail drawdown</p>
            </div>
            <div className="h-9 w-px bg-[var(--lp-border)]" />
            <div>
              <span className="text-3xl font-bold">100%</span>
              <p className="lp-muted mt-0.5 text-xs">On-chain verifiable legs</p>
            </div>
          </div>

          {/* CTAs */}
          <div className="lp-reveal mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "320ms" }}>
            <ConnectCTA className="lp-btn-neon inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold" />
            <Link
              href="/predict"
              className="lp-btn-ghost inline-flex items-center rounded-full px-6 py-3 text-sm font-medium"
            >
              Explore Predict Vault
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          {/* verifiable note */}
          <div className="lp-reveal mt-9 flex items-start gap-3" style={{ animationDelay: "400ms" }}>
            <span className="lp-pulse-glow mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lp-neon)]">
              <Lock className="h-4 w-4 text-[#0a1400]" />
            </span>
            <p className="lp-muted max-w-md text-xs leading-relaxed">
              Every supply &amp; hedge leg is authorized by an ed25519 strategist signature and
              verified on-chain — <span className="text-[var(--lp-text)]">yield you can audit.</span> Your
              position is a portable <span className="text-[var(--lp-text)]">VAULT_SHARE</span> coin.
            </p>
          </div>
        </div>

        {/* hero right — dashboard mockup */}
        <div className="relative mx-auto h-[460px] w-full max-w-[460px] lg:h-[520px]">
          {/* orbit */}
          <svg className="lp-orbit absolute inset-0 h-full w-full opacity-70" viewBox="0 0 460 460" fill="none">
            <ellipse cx="230" cy="230" rx="205" ry="150" stroke="var(--lp-neon)" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="4 8" />
            <ellipse cx="230" cy="230" rx="160" ry="200" stroke="var(--lp-neon)" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="2 10" />
            <circle cx="35" cy="230" r="4" fill="var(--lp-neon)" />
            <circle cx="425" cy="230" r="3" fill="var(--lp-neon)" fillOpacity="0.6" />
            <circle cx="230" cy="30" r="3" fill="var(--lp-neon)" fillOpacity="0.5" />
          </svg>

          {/* main vault card */}
          <div className="lp-card lp-float absolute left-1/2 top-1/2 w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-3xl p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--lp-neon)]">
                  <Activity className="h-3.5 w-3.5 text-[#0a1400]" />
                </span>
                <span className="text-sm font-semibold">PredictVault</span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-[var(--lp-neon)]/10 px-2 py-0.5 text-[10px] lp-neon-text">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--lp-neon)]" /> Live
              </span>
            </div>

            <p className="lp-muted mt-5 text-xs">Net APY · after hedge</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">13.0%</span>
              <span className="lp-neon-text text-xs font-medium">+0.8%</span>
            </div>

            {/* neon area chart */}
            <svg className="mt-3 h-[78px] w-full" viewBox="0 0 260 80" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lpfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--lp-neon)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--lp-neon)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,62 C28,54 46,36 74,40 C104,44 124,24 158,30 C196,36 220,16 260,20 L260,80 L0,80 Z" fill="url(#lpfill)" />
              <path className="lp-draw" d="M0,62 C28,54 46,36 74,40 C104,44 124,24 158,30 C196,36 220,16 260,20" stroke="var(--lp-neon)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>

            {/* mini stats */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { k: "PLP", v: "8.0" },
                { k: "Hedge", v: "1.0" },
                { k: "Idle", v: "1.0" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-[var(--lp-border)] bg-white/[0.02] px-2.5 py-2">
                  <p className="lp-muted text-[10px]">{s.k}</p>
                  <p className="text-sm font-semibold">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* floating badge — top */}
          <div className="lp-card lp-float-sm absolute left-1 top-6 rounded-2xl px-3.5 py-2.5">
            <p className="lp-muted text-[10px]">VAULT_SHARE</p>
            <p className="text-sm font-semibold">
              1.00 <span className="lp-neon-text text-xs">par</span>
            </p>
          </div>

          {/* floating badge — bottom */}
          <div className="lp-card lp-float-delay absolute -bottom-1 right-0 flex items-center gap-2.5 rounded-2xl px-3.5 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lp-neon)]/12">
              <ShieldCheck className="h-4 w-4 lp-neon-text" />
            </span>
            <div>
              <p className="text-xs font-semibold">Crash hedge active</p>
              <p className="lp-muted text-[10px]">BTC OTM down-binary</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== TRUSTED / FEATURES ===================== */}
      <section id="features" className="relative z-10 mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <h2 className="text-[clamp(30px,4.5vw,52px)] font-bold leading-[1.05]">
            Your <span className="lp-neon-text">verifiable</span> edge <br className="hidden sm:block" />
            in on-chain yield.
          </h2>
          <p className="lp-muted text-sm leading-relaxed">
            Vortex wraps raw short-vol PLP in a bounded-drawdown shell — easier to sell to
            outside LPs. The strategist signs every allocation; the chain enforces it. No
            black box, no trust-me APY.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* 01 */}
          <article className="lp-card lp-card-hover rounded-3xl p-7">
            <span className="lp-neon-text text-sm font-semibold">01.</span>
            <h3 className="mt-5 text-xl font-semibold leading-snug">
              Raw short-vol PLP, <br /> exposed.
            </h3>
            <p className="lp-muted mt-3 text-sm leading-relaxed">
              Supplying the Predict pool earns a steady maker spread — but wears the full
              left tail when BTC gaps. Great carry, ugly crash.
            </p>
            <span className="mt-7 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--lp-border)]">
              <TrendingDown className="h-4 w-4 lp-muted" />
            </span>
          </article>

          {/* 02 — prominent neon */}
          <article className="lp-card-neon lp-card-hover relative rounded-3xl p-7">
            <span className="text-sm font-bold text-[#0a1400]/70">02.</span>
            <h3 className="mt-5 text-xl font-bold leading-snug text-[#0a1400]">
              Signed crash-hedge sleeve.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#0a1400]/80">
              The vault supplies dUSDC to PLP <em>and</em> mints OTM BTC binaries that pay out
              on a gap-down — atomically, from one shared vault. Each leg is ed25519-signed
              with a strictly increasing nonce.
            </p>
            <Link
              href="#how"
              className="mt-7 inline-flex items-center rounded-full bg-[#0a1400] px-4 py-2 text-xs font-semibold text-[var(--lp-neon)] transition-transform hover:-translate-y-0.5"
            >
              How it works <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </article>

          {/* 03 */}
          <article className="lp-card lp-card-hover rounded-3xl p-7">
            <span className="lp-neon-text text-sm font-semibold">03.</span>
            <h3 className="mt-5 text-xl font-semibold leading-snug">
              Portable <br /> VAULT_SHARE.
            </h3>
            <p className="lp-muted mt-3 text-sm leading-relaxed">
              Deposits mint a fungible share coin — a bounded-drawdown position you can use as
              collateral, LP, or a structured-product leg across Sui DeFi.
            </p>
            <span className="mt-7 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--lp-border)]">
              <Layers className="h-4 w-4 lp-muted" />
            </span>
          </article>
        </div>
      </section>

      {/* ======================= HOW IT WORKS ======================= */}
      <section id="how" className="relative z-10 mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-[clamp(28px,4vw,46px)] font-bold leading-tight">
            Four legs, <span className="lp-neon-text">one vault.</span>
          </h2>
          <p className="lp-muted max-w-md text-sm">
            Deposit once. The keeper lands strategist-signed legs and redeems settled hedges —
            withdrawals stay trustless.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", t: "Deposit", d: "dUSDC in → mint VAULT_SHARE 1:1 (par). Your position is a portable coin." },
            { n: "02", t: "Supply leg", d: "Signed leg splits idle dUSDC into Predict PLP to earn the maker spread." },
            { n: "03", t: "Hedge leg", d: "Signed leg mints a deep-OTM BTC down-binary — crash insurance for the tail." },
            { n: "04", t: "Settle & redeem", d: "On settlement, payout sweeps back to the vault; burn shares to withdraw." },
          ].map((s, i) => (
            <div key={s.n} className="lp-card lp-card-hover relative rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="lp-neon-text text-xs font-semibold">{s.n}</span>
                {i < 3 && <ArrowRight className="h-4 w-4 lp-muted" />}
              </div>
              <h3 className="mt-4 text-base font-semibold">{s.t}</h3>
              <p className="lp-muted mt-2 text-xs leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== BOTTOM / ABOUT / CTA ===================== */}
      <section id="about" className="relative z-10 mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* left — floating stat cards + chart */}
          <div className="relative h-[420px]">
            <div className="lp-glow pointer-events-none absolute left-0 top-1/3 h-72 w-72 opacity-50" />
            <div className="lp-glow pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 opacity-30" />
            <Image
              src="/logosui.png"
              alt="Sui"
              width={150}
              height={150}
              className="lp-float pointer-events-none absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-90"
            />

            <div className="lp-card lp-float-sm absolute left-0 top-2 z-10 w-[230px] rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--lp-neon)]" />
                <p className="text-sm font-semibold">Net APY · +13.0%</p>
              </div>
              <p className="lp-muted mt-1.5 text-xs leading-relaxed">
                PLP + Hedge, back-tested on ~2,000 real settled BTC expiries.
              </p>
            </div>

            <div className="lp-card lp-float-delay absolute right-2 top-28 z-10 w-[210px] rounded-2xl p-4">
              <p className="text-sm font-semibold">Max drawdown</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="lp-neon-text text-2xl font-bold">−1.0%</span>
                <span className="lp-muted text-[10px]">3× vol stress</span>
              </div>
              <p className="lp-muted mt-1.5 text-xs">≈ half of raw PLP&apos;s tail.</p>
            </div>

            {/* chart card */}
            <div className="lp-card absolute bottom-0 left-2 z-10 w-[260px] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Strategy back-test</p>
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] lp-muted">BTC</span>
              </div>
              <svg className="mt-3 h-[60px] w-full" viewBox="0 0 230 60" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lpfill2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--lp-neon)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--lp-neon)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,48 C26,44 40,30 64,34 C92,38 110,20 140,26 C172,32 196,14 230,18 L230,60 L0,60 Z" fill="url(#lpfill2)" />
                <path d="M0,48 C26,44 40,30 64,34 C92,38 110,20 140,26 C172,32 196,14 230,18" stroke="var(--lp-neon)" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* right — copy + CTA */}
          <div>
            <h2 className="text-[clamp(30px,4.5vw,52px)] font-bold leading-[1.05]">
              A vault outside LPs <br className="hidden sm:block" />
              can <span className="lp-neon-text">trust</span>, anywhere.
            </h2>

            <div className="mt-4 flex gap-1 text-[var(--lp-neon)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>

            <p className="lp-muted mt-5 max-w-lg text-sm leading-relaxed">
              Built for <span className="text-[var(--lp-text)]">Sui Overflow · DeepBook Predict</span>.
              Vortex integrates the live Predict contract on testnet and runs end-to-end —
              deposit → signed supply &amp; hedge legs → settle/redeem → withdraw — with a
              keeper that redeems permissionlessly and an indexer-driven SVI vol smile.
            </p>
            <p className="lp-muted mt-3 max-w-lg text-sm leading-relaxed">
              The differentiator is <span className="text-[var(--lp-text)]">verifiability</span>:
              the strategist can never move funds arbitrarily — every leg is signed over an exact
              tuple and checked on-chain, so anyone can audit which allocation was authorized.
            </p>

            <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                "Integrates Predict on testnet",
                "Works end-to-end",
                "ed25519-signed legs",
                "Portable VAULT_SHARE coin",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--lp-neon)]/12">
                    <Check className="h-3 w-3 lp-neon-text" />
                  </span>
                  <span className="lp-muted">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ConnectCTA
                className="lp-btn-neon inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold"
                label="Launch App"
              />
              <Link
                href="/predict"
                className="lp-btn-ghost inline-flex items-center rounded-full px-6 py-3 text-sm font-medium"
              >
                Open Predict Vault
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="relative z-10 border-t border-[var(--lp-border)]">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-4 px-5 py-8 text-sm sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <Image src="/logofix.png" alt="Vortex" width={24} height={24} className="h-6 w-6 object-contain" />
            <span className="font-semibold">Vortex<span className="lp-neon-text">.</span></span>
            <span className="lp-muted ml-2 text-xs">PLP + Hedge Vault · DeepBook Predict</span>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/predict" className="lp-muted hover:text-[var(--lp-text)]">Predict Vault</Link>
            <Link href="/faucet" className="lp-muted hover:text-[var(--lp-text)]">Faucet</Link>
            <a href="https://github.com/EzraNahumury/Vortex" target="_blank" rel="noreferrer" className="lp-muted hover:text-[var(--lp-text)]">GitHub</a>
            <span className="lp-muted">Built for Sui Overflow</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
