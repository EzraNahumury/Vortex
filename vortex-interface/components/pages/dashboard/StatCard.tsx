"use client";

import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { TrendingUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  suffix?: string;
  subtitle?: string;
  change?: number;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, suffix, subtitle, change, icon }: StatCardProps) {
  const formattedValue = suffix === "%" ? value : formatNumber(value);

  return (
    <div>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-[hsl(var(--foreground))]">
          {suffix === "%" ? "" : "$"}{formattedValue}
        </span>
        {suffix && suffix !== "USD" && (
          <span className="text-lg text-[hsl(var(--primary))]">{suffix}</span>
        )}
        {change !== undefined && (
          <span className={`ml-2 flex items-center text-sm ${change >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
            <TrendingUp className="w-3 h-3 mr-0.5" />
            {change >= 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
