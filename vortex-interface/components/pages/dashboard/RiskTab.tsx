import { Shield, AlertTriangle, Info, CheckCircle } from "lucide-react";

interface RiskTabProps {
  marketExposure: {
    asset: string;
    allocation: number;
    utilization: number;
  }[];
}

export function RiskTab({ marketExposure }: RiskTabProps) {
  const calculateRiskLevel = (utilization: number): "low" | "medium" | "high" => {
    if (utilization < 60) return "low";
    if (utilization < 85) return "medium";
    return "high";
  };

  const getRiskColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low":
        return "text-[hsl(var(--success))]";
      case "medium":
        return "text-[hsl(var(--warning))]";
      case "high":
        return "text-[hsl(var(--destructive))]";
    }
  };

  const getRiskBg = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low":
        return "bg-[hsl(var(--success))]/20";
      case "medium":
        return "bg-[hsl(var(--warning))]/20";
      case "high":
        return "bg-[hsl(var(--destructive))]/20";
    }
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-6">
      <h3 className="font-display text-xl font-bold text-[hsl(var(--foreground))] mb-5">Risk Analysis</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[hsl(var(--success))]/25 bg-[hsl(var(--success))]/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--success))]/15">
              <Shield className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--success))]">Overall Risk</span>
          </div>
          <span className="text-2xl font-bold text-[hsl(var(--success))]">Low</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Diversified collateral</p>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
              <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Smart Contract</span>
          </div>
          <span className="text-2xl font-bold text-[hsl(var(--foreground))]">Audited</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Move language</p>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
              <Info className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Liquidation Buffer</span>
          </div>
          <span className="text-2xl font-bold text-[hsl(var(--foreground))]">15%</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Above threshold</p>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-5">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-4">Collateral Risk Breakdown</h4>
        <div className="space-y-3">
          {(!marketExposure || marketExposure.length === 0) ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">No collateral exposure to analyze yet.</p>
          ) : (
            marketExposure.slice(0, 5).map((market, index) => {
              const assetLabel = market.asset || "Unknown";
              const utilization = Number.isFinite(market.utilization) ? market.utilization : 0;
              const iconKey = assetLabel.includes("/") ? assetLabel.split(" / ")[0] : assetLabel;
              const fallbackChar = assetLabel.charAt(0) || "?";
              const riskLevel = calculateRiskLevel(utilization);
              return (
                <div key={`${assetLabel}-${index}`} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))]/60 bg-white/[0.015] px-3 py-2.5 transition-colors hover:border-[hsl(var(--primary)/0.25)]">
                  <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[hsl(var(--secondary))] ring-1 ring-[hsl(var(--border))]">
                      <img
                        src={`/token/${iconKey.toLowerCase()}.png`}
                        alt={assetLabel}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `<span class="text-xs font-medium absolute inset-0 flex items-center justify-center">${fallbackChar}</span>`;
                          }
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{assetLabel}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{market.allocation ?? 0}% allocation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getRiskBg(riskLevel)} ${getRiskColor(riskLevel)}`}>
                      {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk
                    </span>
                    {riskLevel === "high" && (
                      <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
