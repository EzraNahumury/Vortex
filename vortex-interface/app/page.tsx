"use client";

import { useEffect } from "react";
import { Navbar, FairnessBadges } from "@/components/shared";
import { StatCard, ApyChart, PositionsTable, DepositPanel, PerformanceTab, RiskTab, ActivityTab } from "@/components/pages/dashboard";
import { useAppStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const {
    stats,
    marketExposure,
    apyHistory,
    positions,
    isLoadingMarket,
    fetchMarketData,
    fetchPositions,
    user,
  } = useAppStore();

  useEffect(() => {
    fetchMarketData();
    if (user?.isConnected) {
      fetchPositions();
    }
  }, [fetchMarketData, fetchPositions, user?.isConnected]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <div className="absolute top-0 left-0 right-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_hsla(220,50%,20%,0.3)_0%,_transparent_70%)] pointer-events-none" />

      <main className="relative pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-semibold text-[hsl(var(--foreground))]">Vortex</h1>
                <span className="text-4xl font-semibold text-[hsl(var(--muted-foreground))]">Lending</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                  <Shield className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                  <span className="text-xs text-[hsl(var(--foreground))]">ZK Privacy</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--primary))]" />
                  <span className="text-xs text-[hsl(var(--foreground))]">AI Fair Matching</span>
                </div>
                {user?.fairnessBadges && user.fairnessBadges.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--secondary))]">
                    <FairnessBadges badges={user.fairnessBadges} size="sm" maxDisplay={3} />
                  </div>
                )}
              </div>

              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-8 max-w-2xl">
                Order book-based DeFi lending protocol on Sui. Place custom orders with ZK privacy, get AI-verified fair matching via Nautilus, and earn subsidy yields through vesting vault integration. Built for fairness and inclusivity.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-b border-[hsl(var(--border))]">
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
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">Exposure</p>
                <div className="flex items-center gap-1">
                  {[
                    { token: "SUI", logo: "/token/sui.png" },
                    { token: "USDC", logo: "/token/usdc.png" },
                    { token: "ETH", logo: "/token/eth.png" },
                  ].map(({ token, logo }) => (
                    <div
                      key={token}
                      className="relative w-8 h-8 rounded-full border-2 border-[hsl(var(--background))] overflow-hidden -ml-2 first:ml-0"
                    >
                      <img src={logo} alt={token} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">APY</p>
                  <div className="w-4 h-4 rounded-full border border-[hsl(var(--border))] flex items-center justify-center cursor-pointer">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">i</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-[hsl(var(--foreground))]">{stats.averageApy}</span>
                  <span className="text-lg text-[hsl(var(--primary))]">%</span>
                  <span className="text-lg text-[hsl(var(--primary))]">+</span>
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-transparent border-b border-[hsl(var(--border))] rounded-none p-0 h-auto">
                <TabsTrigger
                  value="overview"
                  className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
                >
                  Performance
                </TabsTrigger>
                <TabsTrigger
                  value="risk"
                  className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
                >
                  Risk
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--foreground))] data-[state=active]:bg-transparent px-4 py-3 text-sm"
                >
                  Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                {isLoadingMarket ? (
                  <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 h-[320px] flex items-center justify-center">
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

          <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20">
              <AlertCircle className="w-4 h-4 text-[hsl(var(--warning))]" />
              <span className="text-xs text-[hsl(var(--warning))]">1 pending action</span>
            </div>
            <DepositPanel asset="USDC" balance={0} apy={stats.averageApy} />
          </div>
        </div>

        {user?.isConnected && positions.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-6 text-[hsl(var(--foreground))]">Your Active Positions</h2>
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20">
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
                      <tr key={pos.id} className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--secondary))]/10 transition-colors">
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
                          ${formatNumber(pos.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-[hsl(var(--muted-foreground))]">
                          {pos.type === 'borrowing' ? (
                             pos.collaterals ? (
                                <div className="flex flex-col gap-1">
                                    {pos.collaterals.map((c, i) => (
                                        <span key={i}>{c.asset}: {formatNumber(c.amount)}</span>
                                    ))}
                                </div>
                             ) : (
                                <span>{pos.collateralAsset}: {formatNumber(pos.collateralAmount || 0)}</span>
                             )
                          ) : (
                             <span>-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--primary))] font-medium">
                          {pos.interestRate}%
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

        <div className="mt-12">
          {isLoadingMarket ? (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
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
