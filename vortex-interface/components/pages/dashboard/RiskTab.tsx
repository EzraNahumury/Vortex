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
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Risk Analysis</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[hsl(var(--success))]" />
            <span className="text-sm text-[hsl(var(--success))]">Overall Risk</span>
          </div>
          <span className="text-xl font-semibold text-[hsl(var(--success))]">Low</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Diversified collateral</p>
        </div>
        
        <div className="bg-[hsl(var(--secondary))]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Smart Contract</span>
          </div>
          <span className="text-xl font-semibold text-[hsl(var(--foreground))]">Audited</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Move language</p>
        </div>
        
        <div className="bg-[hsl(var(--secondary))]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Liquidation Buffer</span>
          </div>
          <span className="text-xl font-semibold text-[hsl(var(--foreground))]">15%</span>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Above threshold</p>
        </div>
      </div>
      
      <div className="bg-[hsl(var(--secondary))]/30 rounded-xl p-4">
        <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3">Collateral Risk Breakdown</h4>
        <div className="space-y-3">
          {marketExposure.slice(0, 5).map((market) => {
            const riskLevel = calculateRiskLevel(market.utilization);
            return (
              <div key={market.asset} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[hsl(var(--secondary))]">
                    {market.asset.includes("/") ? (
                      <img 
                        src={`/token/${market.asset.split(" / ")[0].toLowerCase()}.png`} 
                        alt={market.asset} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<span class="text-xs font-medium absolute inset-0 flex items-center justify-center">${market.asset[0]}</span>`;
                        }}
                      />
                    ) : (
                      <img 
                        src={`/token/${market.asset.toLowerCase()}.png`} 
                        alt={market.asset} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = `<span class="text-xs font-medium absolute inset-0 flex items-center justify-center">${market.asset[0]}</span>`;
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-[hsl(var(--foreground))]">{market.asset}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{market.allocation}% allocation</p>
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
          })}
        </div>
      </div>
    </div>
  );
}
