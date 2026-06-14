"use client";

import { formatNumber, formatPercentage, formatDate } from "@/lib/utils/format";
import { Lock, Unlock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VestingPosition } from "@/lib/types";

interface VestingPositionCardProps {
  position: VestingPosition;
  onUnlock?: (positionId: string) => void;
  isSubmitting?: boolean;
}

export function VestingPositionCard({ position, onUnlock, isSubmitting = false }: VestingPositionCardProps) {
  const now = new Date();
  const unlockDate = new Date(position.unlockDate);
  const unlockDiff = unlockDate.getTime() - now.getTime();
  const daysRemaining = Number.isFinite(unlockDiff)
    ? Math.max(0, Math.ceil(unlockDiff / (1000 * 60 * 60 * 24)))
    : 0;

  const capitalize = (value?: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown";

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

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            position.status === "locked"
              ? "bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary)/0.25)]"
              : position.status === "unlockable"
              ? "bg-[hsl(var(--success))]/10 ring-1 ring-[hsl(var(--success)/0.25)]"
              : "bg-white/[0.04]"
          }`}>
            {position.status === "locked" ? (
              <Lock className="h-6 w-6 text-[hsl(var(--primary))]" />
            ) : (
              <Unlock className={`h-6 w-6 ${
                position.status === "unlockable"
                  ? "text-[hsl(var(--success))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`} />
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-[hsl(var(--foreground))]">
              {formatNumber(position.amount)} SUI
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Locked since {formatDate(position.lockDate)}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusColors[position.status] ?? statusColors.unlocked}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot[position.status] ?? statusDot.unlocked}`} />
          {capitalize(position.status)}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">APY</p>
          <p className="text-sm font-semibold text-[hsl(var(--primary))]">
            {formatPercentage(position.apy)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Earned</p>
          <p className="text-sm font-semibold text-[hsl(var(--success))]">
            +{formatNumber(position.earnedRewards)} SUI
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Unlock Date</p>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {formatDate(position.unlockDate)}
          </p>
        </div>
      </div>

      {position.status === "locked" && daysRemaining > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-3">
          <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {daysRemaining} days until unlock
          </span>
        </div>
      )}

      {position.status === "unlockable" && onUnlock && (
        <Button
          onClick={() => onUnlock(position.id)}
          disabled={isSubmitting}
          className="w-full cursor-pointer rounded-full bg-[hsl(var(--success))] font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting ? "Unlocking..." : "Unlock Tokens"}
        </Button>
      )}
    </div>
  );
}
