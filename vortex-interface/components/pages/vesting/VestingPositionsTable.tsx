"use client";

import { formatNumber, formatPercentage, formatDate } from "@/lib/utils/format";
import { Lock, Unlock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VestingPosition } from "@/lib/types";

interface VestingPositionsTableProps {
  positions: VestingPosition[];
  title: string;
  onUnlock?: (positionId: string) => void;
  isSubmitting?: boolean;
  emptyMessage?: string;
}

export function VestingPositionsTable({
  positions,
  title,
  onUnlock,
  isSubmitting = false,
  emptyMessage = "No positions yet",
}: VestingPositionsTableProps) {
  const statusColors: Record<string, string> = {
    locked: "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]",
    unlockable: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
    unlocked: "bg-white/[0.04] text-[hsl(var(--muted-foreground))]",
  };

  const statusDot: Record<string, string> = {
    locked: "bg-[hsl(var(--primary))]",
    unlockable: "bg-[hsl(var(--success))]",
    unlocked: "bg-[hsl(var(--muted-foreground))]",
  };

  const getDaysRemaining = (unlockDate: string) => {
    const now = new Date();
    const unlock = new Date(unlockDate);
    const diff = unlock.getTime() - now.getTime();
    if (!Number.isFinite(diff)) return 0;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const capitalize = (value?: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown";

  if (!positions || positions.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl">
        <div className="border-b border-[hsl(var(--border))] px-6 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]">{title}</h3>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
            <Lock className="h-5 w-5 text-[hsl(var(--primary))]" />
          </span>
          <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl">
      <div className="border-b border-[hsl(var(--border))] px-6 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--foreground))]">{title}</h3>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Position
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                APY
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Earned
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Time Remaining
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Status
              </th>
              {onUnlock && (
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const daysRemaining = getDaysRemaining(position.unlockDate);

              return (
                <tr
                  key={position.id}
                  className="border-b border-[hsl(var(--border))] transition-colors last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          position.status === "locked"
                            ? "bg-[hsl(var(--primary))]/10"
                            : position.status === "unlockable"
                            ? "bg-[hsl(var(--success))]/10"
                            : "bg-white/[0.04]"
                        }`}
                      >
                        {position.status === "locked" ? (
                          <Lock className="h-4 w-4 text-[hsl(var(--primary))]" />
                        ) : (
                          <Unlock
                            className={`h-4 w-4 ${
                              position.status === "unlockable"
                                ? "text-[hsl(var(--success))]"
                                : "text-[hsl(var(--muted-foreground))]"
                            }`}
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                          Vesting Lock
                        </p>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatDate(position.lockDate)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      {formatNumber(position.amount)} SUI
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm font-semibold text-[hsl(var(--primary))]">
                      {formatPercentage(position.apy)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm font-semibold text-[hsl(var(--success))]">
                      +{formatNumber(position.earnedRewards)} SUI
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2">
                      {position.status === "locked" && daysRemaining > 0 ? (
                        <>
                          <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-sm text-[hsl(var(--muted-foreground))]">
                            {daysRemaining} days
                          </span>
                        </>
                      ) : position.status === "unlockable" ? (
                        <span className="text-sm font-medium text-[hsl(var(--success))]">Ready to unlock</span>
                      ) : (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">Completed</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        statusColors[position.status] ?? statusColors.unlocked
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[position.status] ?? statusDot.unlocked}`} />
                      {capitalize(position.status)}
                    </span>
                  </td>
                  {onUnlock && (
                    <td className="whitespace-nowrap px-6 py-4">
                      {position.status === "unlockable" ? (
                        <Button
                          size="sm"
                          onClick={() => onUnlock(position.id)}
                          disabled={isSubmitting}
                          className="cursor-pointer rounded-full bg-[hsl(var(--success))] font-semibold text-white hover:brightness-110 disabled:opacity-50"
                        >
                          {isSubmitting ? "..." : "Unlock"}
                        </Button>
                      ) : (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
