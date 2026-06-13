"use client";

import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { ChevronRight, Shield } from "lucide-react";
import Link from "next/link";
import type { Vault } from "@/lib/types";

interface VaultTableProps {
  vaults: Vault[];
}

export function VaultTable({ vaults }: VaultTableProps) {
  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Vault
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Deposits
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Liquidity
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Curator
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Exposure
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                APY
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {vaults.map((vault) => (
              <tr key={vault.id} className="table-row border-b border-[hsl(var(--border))] last:border-b-0">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[hsl(var(--primary))]/20">
                      <img 
                        src={`/token/${vault.asset.toLowerCase()}.png`} 
                        alt={vault.asset} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<span class="text-sm font-bold text-[hsl(var(--primary))] absolute inset-0 flex items-center justify-center">${vault.asset.slice(0, 2)}</span>`;
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{vault.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{vault.asset}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {formatNumber(vault.deposits)} {vault.asset}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      ${formatNumber(vault.deposits * 1)}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {formatNumber(vault.liquidity)} {vault.asset}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      ${formatNumber(vault.liquidity * 1)}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {vault.curatorVerified && (
                      <div className="w-5 h-5 rounded-full bg-[hsl(var(--success))]/20 flex items-center justify-center">
                        <Shield className="w-3 h-3 text-[hsl(var(--success))]" />
                      </div>
                    )}
                    <span className="text-sm text-[hsl(var(--foreground))]">{vault.curator}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {vault.exposure.slice(0, 4).map((exp, i) => (
                      <div
                        key={i}
                        className="relative w-6 h-6 rounded-full overflow-hidden bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] -ml-1 first:ml-0"
                      >
                        <img 
                          src={`/token/${exp.toLowerCase()}.png`} 
                          alt={exp} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `<span class="text-[10px] font-medium absolute inset-0 flex items-center justify-center">${exp.slice(0, 1)}</span>`;
                          }}
                        />
                      </div>
                    ))}
                    {vault.exposure.length > 4 && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">
                        +{vault.exposure.length - 4}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-[hsl(var(--primary))]">
                    {formatPercentage(vault.apy)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/earn/${vault.id}`}
                    className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
