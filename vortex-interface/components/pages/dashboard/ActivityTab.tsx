"use client";

import { useState } from "react";
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
  {
    id: "6",
    type: "deposit",
    asset: "SUI",
    amount: 12000,
    timestamp: "3 hours ago",
    txHash: "0xaa11...bb22",
  },
  {
    id: "7",
    type: "match",
    asset: "USDC",
    amount: 30000,
    timestamp: "5 hours ago",
    txHash: "0xcc33...dd44",
  },
  {
    id: "8",
    type: "liquidation",
    asset: "ETH",
    amount: 4.2,
    timestamp: "8 hours ago",
    txHash: "0xee55...ff66",
  },
  {
    id: "9",
    type: "withdraw",
    asset: "SUI",
    amount: 7000,
    timestamp: "12 hours ago",
    txHash: "0x1122...3344",
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
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? mockActivities : mockActivities.slice(0, 5);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-xl font-bold text-[hsl(var(--foreground))]">Recent Activity</h3>
        <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">Last 24 hours</span>
      </div>

      <div className="space-y-2.5">
        {visible.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-white/[0.02] p-3.5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.3)] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center`}>
                {getActivityIcon(activity.type)}
              </div>
              <div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {getActivityLabel(activity.type)}
                </p>
                <p className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                  {activity.txHash}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                {activity.amount.toLocaleString()} {activity.asset}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {activity.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-[hsl(var(--border))]">
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full rounded-full border border-[hsl(var(--border))] bg-white/[0.02] py-2.5 text-center text-sm font-medium text-[hsl(var(--foreground))] transition hover:bg-white/[0.05] hover:border-[hsl(var(--primary)/0.3)] cursor-pointer"
        >
          {showAll ? "Show less" : `View all activity (${mockActivities.length})`}
        </button>
      </div>
    </div>
  );
}
