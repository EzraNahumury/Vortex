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
    locked: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]",
    unlockable: "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]",
    unlocked: "bg-[hsl(var(--muted-foreground))]/20 text-[hsl(var(--muted-foreground))]",
  };

  const getDaysRemaining = (unlockDate: string) => {
    const now = new Date();
    const unlock = new Date(unlockDate);
    return Math.max(0, Math.ceil((unlock.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  if (positions.length === 0) {
    return (
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
        <div className="px-6 py-4 border-b border-[hsl(var(--border))]">
          <h3 className="text-base font-medium text-[hsl(var(--foreground))]">{title}</h3>
        </div>
        <div className="px-6 py-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

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
                Position
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                APY
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Earned
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Time Remaining
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Status
              </th>
              {onUnlock && (
                <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
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
                  className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--secondary))]/30 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          position.status === "locked"
                            ? "bg-[hsl(var(--primary))]/20"
                            : position.status === "unlockable"
                            ? "bg-[hsl(var(--success))]/20"
                            : "bg-[hsl(var(--muted))]/20"
                        }`}
                      >
                        {position.status === "locked" ? (
                          <Lock className="w-4 h-4 text-[hsl(var(--primary))]" />
                        ) : (
                          <Unlock
                            className={`w-4 h-4 ${
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {formatNumber(position.amount)} SUI
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[hsl(var(--primary))]">
                      {formatPercentage(position.apy)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-[hsl(var(--accent))]">
                      +{formatNumber(position.earnedRewards)} SUI
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {position.status === "locked" && daysRemaining > 0 ? (
                        <>
                          <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-sm text-[hsl(var(--muted-foreground))]">
                            {daysRemaining} days
                          </span>
                        </>
                      ) : position.status === "unlockable" ? (
                        <span className="text-sm text-[hsl(var(--success))]">Ready to unlock</span>
                      ) : (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">Completed</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        statusColors[position.status]
                      }`}
                    >
                      {position.status.charAt(0).toUpperCase() + position.status.slice(1)}
                    </span>
                  </td>
                  {onUnlock && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {position.status === "unlockable" ? (
                        <Button
                          size="sm"
                          onClick={() => onUnlock(position.id)}
                          disabled={isSubmitting}
                          className="cursor-pointer bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]/90 disabled:opacity-50"
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
