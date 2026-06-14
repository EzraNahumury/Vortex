"use client";

import { formatNumber, formatPercentage } from "@/lib/utils/format";
import type { MarketExposure } from "@/lib/types";

interface PositionsTableProps {
  positions: MarketExposure[];
  title: string;
}

export function PositionsTable({ positions, title }: PositionsTableProps) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-[hsl(var(--border))]">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
        <h3 className="font-display text-lg font-bold text-[hsl(var(--foreground))]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] bg-white/[0.02]">
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Asset
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Vault Allocation
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Supply Cap
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                APY
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Utilization
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No market exposure data available.
                </td>
              </tr>
            ) : (
              positions.map((position, index) => {
                const symbol = position.symbol || position.asset || "?";
                const utilization = Number.isFinite(position.utilization) ? position.utilization : 0;
                return (
                  <tr
                    key={index}
                    className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-[hsl(var(--secondary))] ring-1 ring-[hsl(var(--border))]">
                          <img
                            src={`/token/${symbol.toLowerCase()}.png`}
                            alt={symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              if (target.parentElement) {
                                target.parentElement.innerHTML = `<span class="text-xs font-semibold text-[hsl(var(--foreground))] absolute inset-0 flex items-center justify-center">${symbol.slice(0, 2)}</span>`;
                              }
                            }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--foreground))]">{position.asset}</p>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {position.allocation ?? 0}% allocation
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-[hsl(var(--foreground))]">
                        ${formatNumber(position.vaultAllocation ?? 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-[hsl(var(--foreground))]">
                        ${formatNumber(position.supplyCap ?? 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-[hsl(var(--primary))]">
                        {formatPercentage(position.apy ?? 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                          <div
                            className="h-full bg-[hsl(var(--primary))] rounded-full"
                            style={{ width: `${Math.min(Math.max(utilization, 0), 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                          {formatPercentage(utilization)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
