import { TrendingUp, TrendingDown, BarChart3, Percent, Clock } from "lucide-react";
import { formatNumber, formatPercentage } from "@/lib/utils/format";

interface PerformanceCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  icon: "trending-up" | "trending-down" | "chart" | "percent" | "clock";
}

function PerformanceCard({ title, value, change, subtitle, icon }: PerformanceCardProps) {
  const IconMap = {
    "trending-up": TrendingUp,
    "trending-down": TrendingDown,
    "chart": BarChart3,
    "percent": Percent,
    "clock": Clock,
  };
  
  const Icon = IconMap[icon];
  const isPositive = change && change > 0;

  return (
    <div className="min-w-0 rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-4 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-white/[0.02]">
          <Icon className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
        </span>
        <span className="truncate text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{title}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-2xl font-bold text-[hsl(var(--foreground))]">{value}</span>
        {change !== undefined && (
          <span className={`text-sm font-medium ${isPositive ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
            {isPositive ? "+" : ""}{change.toFixed(2)}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{subtitle}</p>
      )}
    </div>
  );
}

interface PerformanceTabProps {
  stats: {
    totalValueLocked: number;
    averageApy: number;
    fairnessScore: number;
    volume24h: number;
  };
}

export function PerformanceTab({ stats }: PerformanceTabProps) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-6">
      <h3 className="font-display text-xl font-bold text-[hsl(var(--foreground))] mb-5">Performance Metrics</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <PerformanceCard
          title="30D APY"
          value={formatPercentage(stats.averageApy)}
          change={0.15}
          icon="percent"
        />
        <PerformanceCard
          title="7D Volume"
          value={`$${formatNumber(stats.volume24h * 7)}`}
          change={12.3}
          icon="chart"
        />
        <PerformanceCard
          title="Utilization"
          value="72.4%"
          change={-2.1}
          icon="trending-up"
        />
        <PerformanceCard
          title="Avg Match Time"
          value="~8 min"
          subtitle="400ms finality"
          icon="clock"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-4">Historical Returns</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/60 pb-2.5">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Last 7 days</span>
              <span className="text-sm font-medium text-[hsl(var(--success))]">+0.08%</span>
            </div>
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/60 pb-2.5">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Last 30 days</span>
              <span className="text-sm font-medium text-[hsl(var(--success))]">+0.35%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Last 90 days</span>
              <span className="text-sm font-medium text-[hsl(var(--success))]">+1.05%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-4">Matching Stats</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/60 pb-2.5">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Orders matched today</span>
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">142</span>
            </div>
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/60 pb-2.5">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Fairness score</span>
              <span className="text-sm font-medium text-[hsl(var(--primary))]">{stats.fairnessScore}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">AI matches</span>
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">89%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
