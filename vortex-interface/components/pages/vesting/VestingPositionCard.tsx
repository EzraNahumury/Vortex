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
  const daysRemaining = Math.max(0, Math.ceil((unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const statusColors = {
    locked: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]",
    unlockable: "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]",
    unlocked: "bg-[hsl(var(--muted-foreground))]/20 text-[hsl(var(--muted-foreground))]",
  };

  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            position.status === "locked" 
              ? "bg-[hsl(var(--primary))]/20" 
              : position.status === "unlockable"
              ? "bg-[hsl(var(--success))]/20"
              : "bg-[hsl(var(--muted))]/20"
          }`}>
            {position.status === "locked" ? (
              <Lock className="w-6 h-6 text-[hsl(var(--primary))]" />
            ) : (
              <Unlock className={`w-6 h-6 ${
                position.status === "unlockable" 
                  ? "text-[hsl(var(--success))]" 
                  : "text-[hsl(var(--muted-foreground))]"
              }`} />
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {formatNumber(position.amount)} SUI
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Locked since {formatDate(position.lockDate)}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[position.status]}`}>
          {position.status.charAt(0).toUpperCase() + position.status.slice(1)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">APY</p>
          <p className="text-sm font-medium text-[hsl(var(--primary))]">
            {formatPercentage(position.apy)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Earned</p>
          <p className="text-sm font-medium text-[hsl(var(--accent))]">
            +{formatNumber(position.earnedRewards)} SUI
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Unlock Date</p>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {formatDate(position.unlockDate)}
          </p>
        </div>
      </div>

      {position.status === "locked" && daysRemaining > 0 && (
        <div className="flex items-center gap-2 p-3 bg-[hsl(var(--secondary))] rounded-lg mb-4">
          <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {daysRemaining} days until unlock
          </span>
        </div>
      )}

      {position.status === "unlockable" && onUnlock && (
        <Button
          onClick={() => onUnlock(position.id)}
          disabled={isSubmitting}
          className="w-full cursor-pointer bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]/90 disabled:opacity-50"
        >
          {isSubmitting ? "Unlocking..." : "Unlock Tokens"}
        </Button>
      )}
    </div>
  );
}
