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
    <div className="bg-[hsl(var(--secondary))]/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-[hsl(var(--foreground))]">{value}</span>
        {change !== undefined && (
          <span className={`text-sm ${isPositive ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
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
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Performance Metrics</h3>
      
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
        <div className="bg-[hsl(var(--secondary))]/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3">Historical Returns</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Last 7 days</span>
              <span className="text-sm text-[hsl(var(--success))]">+0.08%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Last 30 days</span>
              <span className="text-sm text-[hsl(var(--success))]">+0.35%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Last 90 days</span>
              <span className="text-sm text-[hsl(var(--success))]">+1.05%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-[hsl(var(--secondary))]/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3">Matching Stats</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Orders matched today</span>
              <span className="text-sm text-[hsl(var(--foreground))]">142</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Fairness score</span>
              <span className="text-sm text-[hsl(var(--primary))]">{stats.fairnessScore}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">AI matches</span>
              <span className="text-sm text-[hsl(var(--foreground))]">89%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
