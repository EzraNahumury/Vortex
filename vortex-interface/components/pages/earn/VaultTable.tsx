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
    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl">
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
            {vaults.map((vault) => {
              const asset = vault.asset ?? "";
              const exposure = vault.exposure ?? [];
              return (
              <tr
                key={vault.id}
                className="group table-row border-b border-[hsl(var(--border))] transition-colors last:border-b-0 hover:bg-white/[0.025]"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[hsl(var(--primary))]/15 ring-1 ring-[hsl(var(--border))]">
                      <img
                        src={`/token/${asset.toLowerCase()}.png`}
                        alt={asset}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `<span class="text-sm font-bold text-[hsl(var(--primary))] absolute inset-0 flex items-center justify-center">${asset.slice(0, 2)}</span>`;
                          }
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{vault.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{asset}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {formatNumber(vault.deposits ?? 0)} {asset}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      ${formatNumber(vault.deposits ?? 0)}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {formatNumber(vault.liquidity ?? 0)} {asset}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      ${formatNumber(vault.liquidity ?? 0)}
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
                    {exposure.slice(0, 4).map((exp, i) => (
                      <div
                        key={`${exp}-${i}`}
                        className="relative w-6 h-6 rounded-full overflow-hidden bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] -ml-1 first:ml-0"
                      >
                        <img
                          src={`/token/${exp.toLowerCase()}.png`}
                          alt={exp}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            if (target.parentElement) {
                              target.parentElement.innerHTML = `<span class="text-[10px] font-medium absolute inset-0 flex items-center justify-center">${exp.slice(0, 1)}</span>`;
                            }
                          }}
                        />
                      </div>
                    ))}
                    {exposure.length > 4 && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">
                        +{exposure.length - 4}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-base font-bold text-[hsl(var(--primary))]">
                    {formatPercentage(vault.apy ?? 0)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/earn/${vault.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-white/[0.02] text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))] cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
