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
  const rawPriceBuffer =
    currentPrice > 0 ? ((currentPrice - liquidationPrice) / currentPrice) * 100 : 0;
  // Guard against NaN/Infinity (e.g. missing/zero oracle price) and keep the
  // displayed buffer within a sane [0, 100] range for the progress bar.
  const priceBuffer = Number.isFinite(rawPriceBuffer)
    ? Math.max(0, Math.min(rawPriceBuffer, 100))
    : 0;
  const healthStatus = priceBuffer > 30 ? "healthy" : priceBuffer > 15 ? "moderate" : "risky";

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/15">
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
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
          healthStatus === "healthy"
            ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
            : healthStatus === "moderate"
            ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
            : "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${
            healthStatus === "healthy"
              ? "bg-[hsl(var(--success))]"
              : healthStatus === "moderate"
              ? "bg-[hsl(var(--warning))]"
              : "bg-[hsl(var(--destructive))]"
          }`} />
          {healthStatus === "healthy" ? "Healthy" : healthStatus === "moderate" ? "Moderate" : "At Risk"}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">LTV</p>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {formatPercentage(position.ltv)}
          </p>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Interest Rate</p>
          <p className="text-sm font-semibold text-[hsl(var(--warning))]">
            {formatPercentage(position.interestRate)}
          </p>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Accrued Interest</p>
          <p className="text-sm font-semibold text-[hsl(var(--destructive))]">
            -${formatNumber(position.paidInterest || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Days Left</p>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {position.term} days
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Current Price</span>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" />
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              ${formatNumber(currentPrice)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Liquidation Price</span>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--destructive))]" />
            <span className="text-sm font-semibold text-[hsl(var(--destructive))]">
              ${formatNumber(liquidationPrice)}
            </span>
          </div>
        </div>
        <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
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
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            {formatPercentage(priceBuffer)} buffer to liquidation
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        {onRepay && (
          <Button
            onClick={() => onRepay(position.id)}
            className="flex-1 cursor-pointer rounded-full bg-[hsl(var(--primary))] font-semibold text-[hsl(var(--primary-foreground))] transition hover:brightness-110"
          >
            Repay
          </Button>
        )}
        {onAddCollateral && (
          <Button
            onClick={() => onAddCollateral(position.id)}
            variant="outline"
            className="flex-1 cursor-pointer rounded-full border-[hsl(var(--border))] bg-white/[0.02] hover:bg-white/[0.05]"
          >
            Add Collateral
          </Button>
        )}
      </div>
    </div>
  );
}
