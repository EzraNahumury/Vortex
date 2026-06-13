"use client";

import { formatNumber, formatPercentage, formatRelativeTime } from "@/lib/utils/format";
import { EyeOff } from "lucide-react";
import { FairnessScoreBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/lib/types";

interface OrdersTableProps {
  orders: Order[];
  title: string;
  onCancel?: (orderId: string) => void;
  emptyMessage?: string;
}

export function OrdersTable({ orders, title, onCancel, emptyMessage = "No orders yet" }: OrdersTableProps) {
  const statusColors: Record<string, string> = {
    pending: "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]",
    matched: "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]",
    active: "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]",
    completed: "bg-[hsl(var(--muted-foreground))]/20 text-[hsl(var(--muted-foreground))]",
    cancelled: "bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]",
  };

  if (orders.length === 0) {
    return (
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
        <div className="px-6 py-4 border-b border-[hsl(var(--border))]">
          <h3 className="text-base font-medium text-[hsl(var(--foreground))]">{title}</h3>
        </div>
        <div className="px-6 py-12 text-center">
          <p className="text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <h3 className="text-base font-medium text-[hsl(var(--foreground))]">{title}</h3>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{orders.length} orders</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Rate
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                LTV
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Creator
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Term
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Fairness
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Status
              </th>
              {onCancel && (
                <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-[hsl(var(--border))] last:border-b-0 hover:bg-[hsl(var(--secondary))]/30 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          order.type === "lend"
                            ? "bg-[hsl(var(--success))]/20"
                            : "bg-[hsl(var(--warning))]/20"
                        }`}
                      >
                        <span
                          className={`text-xs font-bold ${
                            order.type === "lend"
                              ? "text-[hsl(var(--success))]"
                              : "text-[hsl(var(--warning))]"
                          }`}
                        >
                          {order.type === "lend" ? "L" : "B"}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full overflow-hidden border-2 border-[hsl(var(--card))]">
                        <img 
                          src={`/token/${order.asset.toLowerCase()}.png`} 
                          alt={order.asset} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {order.type === "lend" ? "Lend" : "Borrow"} {order.asset}
                        </p>
                        {order.isHidden && (
                          <span title="ZK Hidden">
                            <EyeOff className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatRelativeTime(order.createdAt)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                    {(order.isHidden && order.status !== 'matched') ? (
                        <span className="font-mono text-[hsl(var(--muted-foreground))]">****</span>
                    ) : (
                        `$${formatNumber(order.amount)}`
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-[hsl(var(--primary))]">
                    {(order.isHidden && order.status !== 'matched') ? (
                        <span className="font-mono">**.**%</span>
                    ) : (
                        formatPercentage(order.interestRate)
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    {(order.isHidden && order.status !== 'matched') ? (
                        <span className="font-mono">**.**%</span>
                    ) : (
                        formatPercentage(order.ltv)
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                    {order.creator ? `${order.creator.slice(0, 6)}...${order.creator.slice(-4)}` : "—"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    {order.term} days
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {order.fairnessScore ? (
                    <FairnessScoreBadge score={order.fairnessScore} size="sm" />
                  ) : (
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge className={statusColors[order.status]}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </td>
                {onCancel && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.status === "pending" ? (
                      <button
                        onClick={() => onCancel(order.id)}
                        className="text-xs text-[hsl(var(--destructive))] hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
