"use client";

import { useEffect, useState, Fragment } from "react";
import { Navbar } from "@/components/shared";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/components/providers";
import { formatNumber } from "@/lib/utils/format";
import { ChevronDown, ChevronUp, Calendar, DollarSign, Activity, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { executeRepay, executeLiquidate } from "@/lib/sui/transaction-executor";
import { isMockMode } from "@/lib/config";

export default function PositionsPage() {
  const { positions, fetchPositions, repayPosition, liquidatePosition } = useAppStore();
  const { address, isConnected } = useWallet();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const toggleRow = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
    }
  };

  const handleRepay = async (positionId: string, asset: string, amount: number) => {
    if (!address) return;
    setProcessingId(positionId);
    toast.loading("Processing repayment...");

    try {
      // In a real app, we'd need the coin object ID for the payment
      // For MVP/Mock, we'll assume the wallet handles coin selection or we use a placeholder
      const coinObjectId = "0x...coin"; 

      const result = await executeRepay(positionId, coinObjectId, asset, address);

      if (result.success) {
        toast.dismiss();
        toast.success("Loan repaid successfully!");
        repayPosition(positionId);
      } else {
        toast.dismiss();
        toast.error(`Repayment failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Repay error:", error);
      toast.dismiss();
      toast.error("Failed to repay loan");
    } finally {
      setProcessingId(null);
    }
  };

  const handleLiquidate = async (positionId: string, asset: string) => {
    if (!address) return;
    setProcessingId(positionId);
    toast.loading("Processing liquidation...");

    try {
      // For liquidation, we also need to pay the debt to seize collateral
      const coinObjectId = "0x...coin";

      const result = await executeLiquidate(positionId, coinObjectId, asset, address);

      if (result.success) {
        toast.dismiss();
        toast.success("Loan liquidated successfully!");
        liquidatePosition(positionId);
      } else {
        toast.dismiss();
        toast.error(`Liquidation failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Liquidate error:", error);
      toast.dismiss();
      toast.error("Failed to liquidate loan");
    } finally {
      setProcessingId(null);
    }
  };

  const isOverdue = (endDate: string) => {
    return new Date(endDate).getTime() < Date.now();
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_hsla(220,50%,20%,0.3)_0%,_transparent_70%)] pointer-events-none" />
      
      <main className="relative pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
            <h1 className="text-4xl font-semibold text-[hsl(var(--foreground))]">Your</h1>
            <span className="text-4xl font-semibold text-[hsl(var(--muted-foreground))]">Positions</span>
        </div>

        {!isConnected ? (
             <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
                <p className="text-lg text-[hsl(var(--muted-foreground))]">Please connect your wallet to view positions.</p>
            </div>
        ) : (
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20">
                                <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Asset</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Rate</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-[hsl(var(--muted-foreground))]">
                                        No active positions found.
                                    </td>
                                </tr>
                            ) : (
                                positions.map((pos) => (
                                    <Fragment key={pos.id}>
                                        <tr 
                                            onClick={() => toggleRow(pos.id)}
                                            className={cn(
                                                "border-b border-[hsl(var(--border))] last:border-b-0 cursor-pointer transition-colors",
                                                expandedRow === pos.id ? "bg-[hsl(var(--secondary))]/30" : "hover:bg-[hsl(var(--secondary))]/10"
                                            )}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={cn(
                                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                    pos.type === 'lending' 
                                                        ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" 
                                                        : "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                                                )}>
                                                    {pos.type === 'lending' ? 'Lend' : 'Borrow'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[hsl(var(--foreground))]">
                                                {pos.asset}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--foreground))]">
                                                ${formatNumber(pos.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--primary))] font-medium">
                                                {pos.interestRate}%
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm capitalize text-[hsl(var(--muted-foreground))]">
                                                    {pos.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end">
                                                {expandedRow === pos.id ? (
                                                    <ChevronUp className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                                                )}
                                            </td>
                                        </tr>
                                        {expandedRow === pos.id && (
                                            <tr className="bg-[hsl(var(--secondary))]/5">
                                                <td colSpan={6} className="px-6 py-6 border-b border-[hsl(var(--border))]">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                                                                <Calendar className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                                Timeline
                                                            </h4>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-[hsl(var(--muted-foreground))]">Start Date</span>
                                                                    <span className="text-[hsl(var(--foreground))]">{new Date(pos.startDate).toLocaleDateString()}</span>
                                                                </div>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-[hsl(var(--muted-foreground))]">End Date</span>
                                                                    <span className="text-[hsl(var(--foreground))]">{new Date(pos.endDate).toLocaleDateString()}</span>
                                                                </div>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-[hsl(var(--muted-foreground))]">Duration</span>
                                                                    <span className="text-[hsl(var(--foreground))]">{pos.term} days</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                                                                <DollarSign className="w-4 h-4 text-[hsl(var(--success))]" />
                                                                Financials
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {pos.type === 'lending' && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-[hsl(var(--muted-foreground))]">Earned Interest</span>
                                                                        <span className="text-[hsl(var(--success))] font-medium">+{formatNumber(pos.earnedInterest || 0)} {pos.asset}</span>
                                                                    </div>
                                                                )}
                                                                {pos.type === 'borrowing' && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-[hsl(var(--muted-foreground))]">Paid Interest</span>
                                                                        <span className="text-[hsl(var(--destructive))] font-medium">-{formatNumber(pos.paidInterest || 0)} {pos.asset}</span>
                                                                    </div>
                                                                )}
                                                                
                                                                {pos.status === 'active' && (
                                                                  <div className="mt-4">
                                                                    {pos.type === 'borrowing' ? (
                                                                      <Button 
                                                                        onClick={() => handleRepay(pos.id, pos.asset, pos.amount)}
                                                                        disabled={!!processingId}
                                                                        className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/90] text-white"
                                                                      >
                                                                        {processingId === pos.id ? (
                                                                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                                        ) : (
                                                                          <DollarSign className="w-4 h-4 mr-2" />
                                                                        )}
                                                                        Repay Loan
                                                                      </Button>
                                                                    ) : (
                                                                      <Button 
                                                                        variant="outline"
                                                                        disabled
                                                                        className="w-full border-[hsl(var(--success))/20] text-[hsl(var(--success))]"
                                                                      >
                                                                        <Activity className="w-4 h-4 mr-2" />
                                                                        Earning Interest
                                                                      </Button>
                                                                    )}
                                                                    {(pos.type === 'lending' && isOverdue(pos.endDate)) && (
                                                                        <Button 
                                                                          onClick={() => handleLiquidate(pos.id, pos.asset)}
                                                                          disabled={!!processingId}
                                                                          variant="destructive"
                                                                          className="w-full mt-2"
                                                                        >
                                                                          {processingId === pos.id ? (
                                                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                                          ) : (
                                                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                                                          )}
                                                                          Liquidate (Overdue)
                                                                        </Button>
                                                                    )}
                                                                  </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                                                                <Activity className="w-4 h-4 text-[hsl(var(--warning))]" />
                                                                Risk & Collateral
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {pos.type === 'borrowing' && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-[hsl(var(--muted-foreground))]">LTV (Raw)</span>
                                                                        <span className="text-[hsl(var(--foreground))] tooltip" title="Ratio of Loan Amount to Collateral Amount (Price agnostic)">
                                                                            {(pos.ltv).toFixed(2)}%
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Single Collateral Display (Contract is Single Collateral) */}
                                                                {pos.collateralAsset && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-[hsl(var(--muted-foreground))]">Collateral</span>
                                                                        <span className="text-[hsl(var(--foreground))]">{formatNumber(pos.collateralAmount || 0)} {pos.collateralAsset}</span>
                                                                    </div>
                                                                )}

                                                                <div className="flex justify-between text-sm items-center pt-2 mt-2 border-t border-[hsl(var(--border))]/50">
                                                                    <span className="text-[hsl(var(--muted-foreground))]">Contract ID</span>
                                                                    <a 
                                                                      href={isMockMode() ? "#" : `https://suiscan.xyz/testnet/object/${pos.id.split('-')[0]}`} // Handle suffix
                                                                      target="_blank" 
                                                                      rel="noopener noreferrer"
                                                                      className="font-mono text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                                                                    >
                                                                      {pos.id.split('-')[0].slice(0, 8)}...{pos.id.split('-')[0].slice(-6)}
                                                                      <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
