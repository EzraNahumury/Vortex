"use client";

import { formatNumber, formatPercentage, formatRelativeTime } from "@/lib/utils/format";
import { EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FairnessScoreBadge } from "@/components/shared";
import type { Order } from "@/lib/types";

interface OrderCardProps {
  order: Order;
  onCancel?: (orderId: string) => void;
}

export function OrderCard({ order, onCancel }: OrderCardProps) {
  const statusColors = {
    pending: "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]",
    matched: "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]",
    active: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]",
    completed: "bg-[hsl(var(--muted-foreground))]/20 text-[hsl(var(--muted-foreground))]",
    cancelled: "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]",
  };

  return (
    <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-5 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            order.type === "lend" 
              ? "bg-[hsl(var(--success))]/20" 
              : "bg-[hsl(var(--warning))]/20"
          }`}>
            <span className={`text-sm font-bold ${
              order.type === "lend" 
                ? "text-[hsl(var(--success))]" 
                : "text-[hsl(var(--warning))]"
            }`}>
              {order.type === "lend" ? "L" : "B"}
            </span>
          </div>
          <div>
            <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {order.type === "lend" ? "Lend" : "Borrow"} {order.asset}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {formatRelativeTime(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.isHidden && (
            <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]" title="ZK Hidden Order">
              <EyeOff className="w-4 h-4 text-[hsl(var(--primary))]" />
            </div>
          )}
          <Badge className={statusColors[order.status]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Amount</p>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            ${formatNumber(order.amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Interest Rate</p>
          <p className="text-sm font-medium text-[hsl(var(--primary))]">
            {formatPercentage(order.interestRate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">LTV</p>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {formatPercentage(order.ltv)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Term</p>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {order.term} days
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[hsl(var(--border))]">
        <div className="flex items-center gap-3">
          {order.fairnessScore && (
            <FairnessScoreBadge score={order.fairnessScore} size="sm" />
          )}
          {order.zkProofHash && (
            <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">
              ZK: {order.zkProofHash.slice(0, 10)}...
            </span>
          )}
        </div>
        {order.status === "pending" && onCancel && (
          <button
            onClick={() => onCancel(order.id)}
            className="text-xs text-[hsl(var(--destructive))] hover:underline cursor-pointer"
          >
            Cancel Order
          </button>
        )}
      </div>
    </div>
  );
}

