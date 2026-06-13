import { ArrowUpRight, ArrowDownRight, Clock, Zap } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "deposit" | "withdraw" | "match" | "liquidation";
  asset: string;
  amount: number;
  timestamp: string;
  txHash?: string;
}

const mockActivities: ActivityItem[] = [
  {
    id: "1",
    type: "match",
    asset: "USDC",
    amount: 50000,
    timestamp: "2 min ago",
    txHash: "0x1234...abcd",
  },
  {
    id: "2",
    type: "deposit",
    asset: "USDC",
    amount: 25000,
    timestamp: "15 min ago",
    txHash: "0x5678...efgh",
  },
  {
    id: "3",
    type: "match",
    asset: "SUI",
    amount: 10000,
    timestamp: "32 min ago",
    txHash: "0x9abc...ijkl",
  },
  {
    id: "4",
    type: "withdraw",
    asset: "USDC",
    amount: 15000,
    timestamp: "1 hour ago",
    txHash: "0xdef0...mnop",
  },
  {
    id: "5",
    type: "match",
    asset: "WETH",
    amount: 8500,
    timestamp: "2 hours ago",
    txHash: "0x1234...qrst",
  },
];

function getActivityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "deposit":
      return <ArrowDownRight className="w-4 h-4 text-[hsl(var(--success))]" />;
    case "withdraw":
      return <ArrowUpRight className="w-4 h-4 text-[hsl(var(--warning))]" />;
    case "match":
      return <Zap className="w-4 h-4 text-[hsl(var(--primary))]" />;
    case "liquidation":
      return <Clock className="w-4 h-4 text-[hsl(var(--destructive))]" />;
  }
}

function getActivityLabel(type: ActivityItem["type"]) {
  switch (type) {
    case "deposit":
      return "Deposit";
    case "withdraw":
      return "Withdrawal";
    case "match":
      return "Order Matched";
    case "liquidation":
      return "Liquidation";
  }
}

function getActivityColor(type: ActivityItem["type"]) {
  switch (type) {
    case "deposit":
      return "bg-[hsl(var(--success))]/20";
    case "withdraw":
      return "bg-[hsl(var(--warning))]/20";
    case "match":
      return "bg-[hsl(var(--primary))]/20";
    case "liquidation":
      return "bg-[hsl(var(--destructive))]/20";
  }
}

export function ActivityTab() {
  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Recent Activity</h3>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Last 24 hours</span>
      </div>
      
      <div className="space-y-3">
        {mockActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))]/30 hover:bg-[hsl(var(--secondary))]/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center`}>
                {getActivityIcon(activity.type)}
              </div>
              <div>
                <p className="text-sm text-[hsl(var(--foreground))]">
                  {getActivityLabel(activity.type)}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {activity.txHash}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                {activity.amount.toLocaleString()} {activity.asset}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {activity.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
        <button className="w-full text-center text-sm text-[hsl(var(--primary))] hover:underline cursor-pointer">
          View all activity
        </button>
      </div>
    </div>
  );
}
