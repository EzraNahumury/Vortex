"use client";

import { useEffect } from "react";
import { Navbar, FairnessBadges, AppBackground } from "@/components/shared";
import { StatCard, ApyChart, PositionsTable, DepositPanel, PerformanceTab, RiskTab, ActivityTab } from "@/components/pages/dashboard";
import { useAppStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils/format";
import { isMockMode } from "@/lib/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const {
    stats,
    marketExposure,
    apyHistory,
    positions,
    isLoadingMarket,
    fetchMarketData,
    fetchPositions,
    walletAddress,
    user,
  } = useAppStore();

  // In mock mode we always want demo positions to populate the dashboard.
  // In real mode, only fetch once a wallet is actually connected.
  const showPositions = isMockMode() || !!walletAddress;

  useEffect(() => {
    fetchMarketData();
    if (showPositions) {
      fetchPositions();
    }
  }, [fetchMarketData, fetchPositions, showPositions]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))]">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* ============================ HEADER ============================ */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
                <span className="text-[hsl(var(--muted-foreground))] uppercase">Order-book lending · Sui</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.02] tracking-tight">
                Vortex <span className="text-[hsl(var(--primary))]">Lending</span>
              </h1>

              <div className="flex flex-wrap items-center gap-2 mt-5 mb-5">
                <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-1">
                  <Shield className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                  <span className="text-xs text-[hsl(var(--foreground))]">ZK Privacy</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-1">
                  <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                  <span className="text-xs text-[hsl(var(--foreground))]">AI Fair Matching</span>
                </div>
                {user?.fairnessBadges && user.fairnessBadges.length > 0 && (
                  <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-1">
                    <FairnessBadges badges={user.fairnessBadges} size="sm" maxDisplay={3} />
                  </div>
                )}
              </div>

              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))] max-w-2xl">
                Order book-based DeFi lending protocol on Sui. Place custom orders with ZK privacy, get AI-verified fair matching via Nautilus, and earn subsidy yields through vesting vault integration. Built for fairness and inclusivity.
              </p>
            </div>

            {/* ============================ STAT STRIP ============================ */}
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                <StatCard
                  title="Total Deposits"
                  value={stats.totalValueLocked}
                  subtitle={`${formatNumber(stats.totalValueLocked)} USDC`}
                />
                <StatCard
                  title="Liquidity"
                  value={stats.totalMatched}
                  subtitle={`${formatNumber(stats.totalMatched)} USDC`}
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">Exposure</p>
                  <div className="flex items-center gap-1">
                    {[
                      { token: "SUI", logo: "/token/sui.png" },
                      { token: "USDC", logo: "/token/usdc.png" },
                      { token: "ETH", logo: "/token/eth.png" },
                    ].map(({ token, logo }) => (
                      <div
                        key={token}
                        className="relative w-9 h-9 rounded-full border-2 border-[hsl(var(--background))] ring-1 ring-[hsl(var(--border))] overflow-hidden -ml-2.5 first:ml-0"
                      >
                        <img src={logo} alt={token} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">APY</p>
                    <div className="w-4 h-4 rounded-full border border-[hsl(var(--border))] flex items-center justify-center cursor-pointer">
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">i</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[hsl(var(--foreground))]">{stats.averageApy}</span>
                    <span className="text-xl font-bold text-[hsl(var(--primary))]">%</span>
                    <span className="text-xl font-bold text-[hsl(var(--primary))]">+</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================ TABS ============================ */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-transparent border-b border-[hsl(var(--border))] rounded-none p-0 h-auto gap-1">
                <TabsTrigger
                  value="overview"
                  className="cursor-pointer rounded-none border-b-2 border-transparent text-[hsl(var(--muted-foreground))] data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--foreground))] px-4 py-3 text-sm transition-colors"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="cursor-pointer rounded-none border-b-2 border-transparent text-[hsl(var(--muted-foreground))] data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--foreground))] px-4 py-3 text-sm transition-colors"
                >
                  Performance
                </TabsTrigger>
                <TabsTrigger
                  value="risk"
                  className="cursor-pointer rounded-none border-b-2 border-transparent text-[hsl(var(--muted-foreground))] data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--foreground))] px-4 py-3 text-sm transition-colors"
                >
                  Risk
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="cursor-pointer rounded-none border-b-2 border-transparent text-[hsl(var(--muted-foreground))] data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(var(--foreground))] px-4 py-3 text-sm transition-colors"
                >
                  Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                {isLoadingMarket ? (
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-6 h-[320px] flex items-center justify-center">
                    <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading...</div>
                  </div>
                ) : (
                  <ApyChart data={apyHistory} currentApy={stats.averageApy} />
                )}
              </TabsContent>

              <TabsContent value="performance" className="mt-6">
                <PerformanceTab stats={stats} />
              </TabsContent>

              <TabsContent value="risk" className="mt-6">
                <RiskTab marketExposure={marketExposure} />
              </TabsContent>

              <TabsContent value="activity" className="mt-6">
                <ActivityTab />
              </TabsContent>
            </Tabs>
          </div>

          {/* ============================ SIDEBAR ============================ */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <DepositPanel asset="USDC" balance={0} apy={stats.averageApy} />
          </div>
        </div>

        {/* ============================ ACTIVE POSITIONS ============================ */}
        {showPositions && positions.length > 0 && (
          <div className="mt-14">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">
                Your Active <span className="text-[hsl(var(--primary))]">Positions</span>
              </h2>
              <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                {positions.length} open
              </span>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] bg-white/[0.02]">
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Asset</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Collateral</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Rate</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => (
                      <tr key={pos.id} className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            pos.type === 'lending'
                              ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]'
                          }`}>
                            {pos.type === 'lending' ? 'Lend' : 'Borrow'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[hsl(var(--foreground))]">
                          {pos.asset}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--foreground))]">
                          ${formatNumber(pos.amount ?? 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-[hsl(var(--muted-foreground))]">
                          {pos.type === 'borrowing' ? (
                             pos.collaterals && pos.collaterals.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    {pos.collaterals.map((c, i) => (
                                        <span key={i}>{c.asset}: {formatNumber(c.amount ?? 0)}</span>
                                    ))}
                                </div>
                             ) : pos.collateralAsset ? (
                                <span>{pos.collateralAsset}: {formatNumber(pos.collateralAmount || 0)}</span>
                             ) : (
                                <span>-</span>
                             )
                          ) : (
                             <span>-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--primary))] font-medium">
                          {pos.interestRate ?? 0}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm capitalize text-[hsl(var(--muted-foreground))]">
                            {pos.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================ MARKET EXPOSURE ============================ */}
        <div className="mt-14">
          {isLoadingMarket ? (
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-12 flex items-center justify-center">
              <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading market data...</div>
            </div>
          ) : (
            <PositionsTable positions={marketExposure} title="Market Exposure" />
          )}
        </div>
      </main>
    </div>
  );
}
