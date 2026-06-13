"use client";

import { formatNumber, formatPercentage } from "@/lib/utils/format";
import type { MarketExposure } from "@/lib/types";

interface PositionsTableProps {
  positions: MarketExposure[];
  title: string;
}

export function PositionsTable({ positions, title }: PositionsTableProps) {
  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="px-6 py-4 border-b border-[hsl(var(--border))]">
        <h3 className="text-base font-medium text-[hsl(var(--foreground))]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
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
            {positions.map((position, index) => (
              <tr
                key={index}
                className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--secondary))]/30 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-[hsl(var(--secondary))]">
                      <img 
                        src={`/token/${position.symbol.toLowerCase()}.png`} 
                        alt={position.symbol} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<span class="text-xs font-semibold text-[hsl(var(--foreground))] absolute inset-0 flex items-center justify-center">${position.symbol.slice(0, 2)}</span>`;
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{position.asset}</p>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {position.allocation}% allocation
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    ${formatNumber(position.vaultAllocation)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    ${formatNumber(position.supplyCap)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    {formatPercentage(position.apy)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                      <div
                        className="h-full bg-[hsl(var(--primary))] rounded-full"
                        style={{ width: `${position.utilization}%` }}
                      />
                    </div>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                      {formatPercentage(position.utilization)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
