/**
 * Shared atmospheric background for app pages — subtle grid + neon glow,
 * matching the landing page. Render once near the top of a page's root
 * (which should be `relative`); keep page content at `z-10`.
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="lp-grid absolute inset-0 opacity-[0.5]" />
      <div className="lp-glow absolute -top-40 right-[-10%] h-[520px] w-[520px] opacity-[0.32]" />
      <div className="lp-glow absolute bottom-[-12%] left-[-12%] h-[420px] w-[420px] opacity-[0.16]" />
    </div>
  );
}
