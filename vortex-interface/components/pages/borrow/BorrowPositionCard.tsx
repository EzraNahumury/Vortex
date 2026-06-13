"use client";

import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Position } from "@/lib/types";

interface BorrowPositionCardProps {
  position: Position;
  collateralAsset: string;
  collateralAmount: number;
  currentPrice: number;
  liquidationPrice: number;
  onRepay?: (positionId: string) => void;
  onAddCollateral?: (positionId: string) => void;
}

export function BorrowPositionCard({
  position,
  collateralAsset,
  collateralAmount,
  currentPrice,
  liquidationPrice,
  onRepay,
  onAddCollateral,
}: BorrowPositionCardProps) {
  const priceBuffer = ((currentPrice - liquidationPrice) / currentPrice) * 100;
  const healthStatus = priceBuffer > 30 ? "healthy" : priceBuffer > 15 ? "moderate" : "risky";

  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[hsl(var(--warning))]/20 flex items-center justify-center">
            <span className="text-lg font-bold text-[hsl(var(--warning))]">B</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
              ${formatNumber(position.amount)} {position.asset}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Collateral: {formatNumber(collateralAmount)} {collateralAsset}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
          healthStatus === "healthy"
            ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]"
            : healthStatus === "moderate"
            ? "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]"
            : "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]"
        }`}>
          {healthStatus === "healthy" ? "Healthy" : healthStatus === "moderate" ? "Moderate" : "At Risk"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">LTV</p>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {formatPercentage(position.ltv)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Interest Rate</p>
          <p className="text-sm font-medium text-[hsl(var(--warning))]">
            {formatPercentage(position.interestRate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Accrued Interest</p>
          <p className="text-sm font-medium text-[hsl(var(--destructive))]">
            -${formatNumber(position.paidInterest || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Days Left</p>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {position.term} days
          </p>
        </div>
      </div>

      <div className="p-4 bg-[hsl(var(--secondary))] rounded-xl mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Current Price</span>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[hsl(var(--success))]" />
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
              ${formatNumber(currentPrice)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Liquidation Price</span>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--destructive))]" />
            <span className="text-sm font-medium text-[hsl(var(--destructive))]">
              ${formatNumber(liquidationPrice)}
            </span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
          <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
            <div
              className={`h-full rounded-full ${
                healthStatus === "healthy"
                  ? "bg-[hsl(var(--success))]"
                  : healthStatus === "moderate"
                  ? "bg-[hsl(var(--warning))]"
                  : "bg-[hsl(var(--destructive))]"
              }`}
              style={{ width: `${Math.min(priceBuffer, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            {formatPercentage(priceBuffer)} buffer to liquidation
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {onRepay && (
          <Button
            onClick={() => onRepay(position.id)}
            className="flex-1 cursor-pointer bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
          >
            Repay
          </Button>
        )}
        {onAddCollateral && (
          <Button
            onClick={() => onAddCollateral(position.id)}
            variant="outline"
            className="flex-1 cursor-pointer"
          >
            Add Collateral
          </Button>
        )}
      </div>
    </div>
  );
}
