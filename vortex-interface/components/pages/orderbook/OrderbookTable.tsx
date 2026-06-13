"use client";

import { formatNumber, formatPercentage, formatRelativeTime } from "@/lib/utils/format";
import { EyeOff, TrendingUp, TrendingDown } from "lucide-react";
import { FairnessScoreBadge } from "@/components/shared";
import type { Order } from "@/lib/types";

interface OrderbookTableProps {
  bids: Order[];
  asks: Order[];
  isLoading?: boolean;
}

interface OrderRowData {
  price: number;
  amount: number;
  total: number;
  percentage: number;
  order: Order;
}

function aggregateOrders(orders: Order[], type: "lend" | "borrow"): OrderRowData[] {
  // Group by interest rate and aggregate
  const priceMap = new Map<number, { amount: number; orders: Order[] }>();

  orders.forEach((order) => {
    const existing = priceMap.get(order.interestRate);
    if (existing) {
      existing.amount += order.amount;
      existing.orders.push(order);
    } else {
      priceMap.set(order.interestRate, { amount: order.amount, orders: [order] });
    }
  });

  // Convert to array and sort
  const sorted = Array.from(priceMap.entries())
    .map(([price, data]) => ({
      price,
      amount: data.amount,
      order: data.orders[0],
    }))
    .sort((a, b) => (type === "lend" ? b.price - a.price : a.price - b.price));

  // Calculate running totals and percentages
  let runningTotal = 0;
  const maxTotal = sorted.reduce((acc, item) => acc + item.amount, 0);

  return sorted.map((item) => {
    runningTotal += item.amount;
    return {
      price: item.price,
      amount: item.amount,
      total: runningTotal,
      percentage: (runningTotal / maxTotal) * 100,
      order: item.order,
    };
  });
}

function OrderbookSide({
  rows,
  type,
  maxRows = 10,
}: {
  rows: OrderRowData[];
  type: "bid" | "ask";
  maxRows?: number;
}) {
  const displayRows = rows.slice(0, maxRows);
  const isBid = type === "bid";

  return (
    <div className="flex-1">
      <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          {isBid ? (
            <TrendingUp className="w-4 h-4 text-[hsl(var(--success))]" />
          ) : (
            <TrendingDown className="w-4 h-4 text-[hsl(var(--destructive))]" />
          )}
          <h4
            className={`text-sm font-medium ${
              isBid ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"
            }`}
          >
            {isBid ? "Bids (Lend Orders)" : "Asks (Borrow Requests)"}
          </h4>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            ({rows.length})
          </span>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">
                Rate
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">
                Amount
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No {isBid ? "lend" : "borrow"} orders
                </td>
              </tr>
            ) : (
              displayRows.map((row, index) => (
                <tr
                  key={`${row.price}-${index}`}
                  className="relative hover:bg-[hsl(var(--secondary))]/50 transition-colors group"
                >
                  {/* Background bar */}
                  <td
                    colSpan={3}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: isBid
                        ? `linear-gradient(to left, transparent ${100 - row.percentage}%, hsla(var(--success), 0.1) ${100 - row.percentage}%)`
                        : `linear-gradient(to right, transparent ${100 - row.percentage}%, hsla(var(--destructive), 0.1) ${100 - row.percentage}%)`,
                    }}
                  />

                  {/* Price */}
                  <td className="px-4 py-2.5 relative">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isBid ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"
                        }`}
                      >
                        {row.order.isHidden ? (
                          <span className="font-mono">**.**%</span>
                        ) : (
                          `${row.price.toFixed(2)}%`
                        )}
                      </span>
                      {row.order.isHidden && (
                        <EyeOff className="w-3 h-3 text-[hsl(var(--primary))] opacity-60" />
                      )}
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-2.5 text-right relative">
                    <span className="text-sm text-[hsl(var(--foreground))]">
                      {row.order.isHidden ? (
                        <span className="font-mono text-[hsl(var(--muted-foreground))]">****</span>
                      ) : (
                        `$${formatNumber(row.amount)}`
                      )}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="px-4 py-2.5 text-right relative">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                      {row.order.isHidden ? (
                        <span className="font-mono">****</span>
                      ) : (
                        `$${formatNumber(row.total)}`
                      )}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OrderbookTable({ bids, asks, isLoading = false }: OrderbookTableProps) {
  const bidRows = aggregateOrders(bids, "lend");
  const askRows = aggregateOrders(asks, "borrow");

  // Calculate spread
  const bestBid = bidRows.length > 0 ? bidRows[0].price : 0;
  const bestAsk = askRows.length > 0 ? askRows[0].price : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? (bestAsk - bestBid).toFixed(2) : "—";

  if (isLoading) {
    return (
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
        <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading orderbook...</div>
      </div>
    );
  }

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <h3 className="text-base font-medium text-[hsl(var(--foreground))]">Order Book</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Spread:</span>
            <span className="text-xs font-medium text-[hsl(var(--foreground))]">{spread}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Market:</span>
            <span className="text-xs font-medium text-[hsl(var(--foreground))]">USDC</span>
          </div>
        </div>
      </div>

      {/* Two-column orderbook */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[hsl(var(--border))]">
        <OrderbookSide rows={bidRows} type="bid" maxRows={8} />
        <OrderbookSide rows={askRows} type="ask" maxRows={8} />
      </div>

      {/* Footer with market info */}
      <div className="px-6 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
        <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center gap-4">
            <span>Total Bids: ${formatNumber(bidRows.reduce((acc, r) => acc + r.amount, 0))}</span>
            <span>Total Asks: ${formatNumber(askRows.reduce((acc, r) => acc + r.amount, 0))}</span>
          </div>
          <span>Powered by Vortex CLOB • DeepBook Style</span>
        </div>
      </div>
    </div>
  );
}
