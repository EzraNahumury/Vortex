"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/shared";
import { VaultTable, VaultFilters } from "@/components/pages/earn";
import { useAppStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/components/providers";
import { executeVaultDeposit, executeAllocationPlan } from "@/lib/sui/transaction-executor";
import { isMockMode } from "@/lib/config";

const AGGREGATOR_VAULT_ID = process.env.NEXT_PUBLIC_AGGREGATOR_VAULT_ID || "";
const AGGREGATOR_VAULT_ASSET = process.env.NEXT_PUBLIC_AGGREGATOR_VAULT_ASSET || "USDC";

export default function EarnPage() {
  const { vaults, positions, isLoadingVaults, fetchVaults, fetchPositions } = useAppStore();
  const { address } = useWallet();
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);

  const handleVaultDeposit = async () => {
    if (!address) {
      toast.error("Connect wallet first");
      return;
    }
    if (!AGGREGATOR_VAULT_ID) {
      toast.error("Aggregator vault not configured. Set NEXT_PUBLIC_AGGREGATOR_VAULT_ID.");
      return;
    }
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }

    setIsDepositing(true);
    try {
      const result = await executeVaultDeposit(
        { vaultId: AGGREGATOR_VAULT_ID, asset: AGGREGATOR_VAULT_ASSET, amount },
        address,
      );
      if (!result.success) {
        toast.error(result.error || "Vault deposit failed");
        return;
      }
      toast.success(`Deposited ${amount} ${AGGREGATOR_VAULT_ASSET} to aggregator vault`);
      setDepositOpen(false);
      setDepositAmount("");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleAutoAllocate = async () => {
    if (!address) return;
    const enclaveId = process.env.NEXT_PUBLIC_NAUTILUS_ENCLAVE_ID;
    if (!enclaveId || !AGGREGATOR_VAULT_ID) {
      toast.error("Aggregator vault or enclave not configured");
      return;
    }
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Set the deposit amount first to size the allocation");
      return;
    }

    setIsAllocating(true);
    try {
      const marketIds = (process.env.NEXT_PUBLIC_VAULT_MARKETS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (marketIds.length === 0) {
        toast.error("Set NEXT_PUBLIC_VAULT_MARKETS=<id1>,<id2> first");
        return;
      }
      const weight = 1 / marketIds.length;
      const decimals = AGGREGATOR_VAULT_ASSET === "USDC" ? 6 : AGGREGATOR_VAULT_ASSET === "ETH" ? 8 : 9;
      const amountSmallest = Math.floor(amount * Math.pow(10, decimals));

      const { legResults, success } = await executeAllocationPlan(
        {
          vaultId: AGGREGATOR_VAULT_ID,
          enclaveId,
          asset: AGGREGATOR_VAULT_ASSET,
          collateral: "SUI",
          amount: amountSmallest,
          legs: marketIds.map((marketId) => ({
            marketId,
            weight,
            rateBps: 500,                       // 5% default; in production the enclave proposes per-market rates
            durationMs: 30 * 24 * 60 * 60 * 1000,
          })),
        },
        address,
      );

      if (success) {
        toast.success(`Routed across ${legResults.length} markets`);
      } else {
        const failed = legResults.find((r) => !r.success);
        toast.error(`Allocation halted: ${failed?.error ?? "unknown error"}`);
      }
    } finally {
      setIsAllocating(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [depositFilter, setDepositFilter] = useState("all");
  const [curatorFilter, setCuratorFilter] = useState("all");

  useEffect(() => {
    fetchVaults();
    fetchPositions();
  }, [fetchVaults, fetchPositions]);

  const lendingPositions = positions.filter((p) => p.type === "lending");

  const filteredVaults = vaults.filter((vault) => {
    const matchesSearch = vault.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDeposit = depositFilter === "all" || vault.asset.toLowerCase() === depositFilter;
    const matchesCurator =
      curatorFilter === "all" ||
      (curatorFilter === "verified" && vault.curatorVerified) ||
      (curatorFilter === "community" && !vault.curatorVerified);
    return matchesSearch && matchesDeposit && matchesCurator;
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">Earn</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Deposit assets into vaults to earn yield through lending
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-[hsl(var(--primary))]/30 bg-[hsl(var(--card))] p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--primary))]">
                <Sparkles className="w-4 h-4" />
                Nautilus Aggregator Vault
              </div>
              <h2 className="mt-1 text-xl font-semibold text-[hsl(var(--foreground))]">
                Auto-route {AGGREGATOR_VAULT_ASSET} into best-rate markets
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                The off-chain enclave designs the allocation plan and signs each leg. The vault
                only routes capital after verifying those signatures on-chain.
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
                <DialogTrigger asChild>
                  <Button>Deposit</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px] bg-[hsl(var(--card))] border-[hsl(var(--border))]">
                  <DialogHeader>
                    <DialogTitle className="text-[hsl(var(--foreground))]">
                      Deposit {AGGREGATOR_VAULT_ASSET} into Aggregator
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDepositOpen(false)} disabled={isDepositing}>
                        Cancel
                      </Button>
                      <Button onClick={handleVaultDeposit} disabled={isDepositing}>
                        {isDepositing ? "Depositing..." : "Confirm"}
                      </Button>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {isMockMode() ? "Mock mode: no on-chain transaction will be sent." : "On-chain deposit via vault::deposit."}
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={handleAutoAllocate} disabled={isAllocating}>
                {isAllocating ? "Allocating..." : "Auto-Allocate"}
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="vaults" className="w-full">
          <TabsList className="mb-6 bg-[hsl(var(--secondary))]">
            <TabsTrigger value="positions" className="cursor-pointer">Your positions</TabsTrigger>
            <TabsTrigger value="vaults" className="cursor-pointer">Vaults</TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            {lendingPositions.length === 0 ? (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 text-center">
                <p className="text-[hsl(var(--muted-foreground))] mb-4">
                  You have no active lending positions
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Deposit assets into a vault to start earning yield
                </p>
              </div>
            ) : (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))]">
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Asset</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">APY</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Earned</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lendingPositions.map((pos) => (
                      <tr key={pos.id} className="border-b border-[hsl(var(--border))] last:border-b-0">
                        <td className="px-6 py-4 text-sm text-[hsl(var(--foreground))]">{pos.asset}</td>
                        <td className="px-6 py-4 text-sm text-[hsl(var(--foreground))]">${pos.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-[hsl(var(--primary))]">{pos.interestRate}%</td>
                        <td className="px-6 py-4 text-sm text-[hsl(var(--success))]">+${pos.earnedInterest?.toLocaleString() || 0}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]">
                            {pos.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="vaults">
            <VaultFilters
              onSearch={setSearchQuery}
              onDepositFilter={setDepositFilter}
              onCuratorFilter={setCuratorFilter}
            />
            {isLoadingVaults ? (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 flex items-center justify-center">
                <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading vaults...</div>
              </div>
            ) : filteredVaults.length === 0 ? (
              <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-12 text-center">
                <p className="text-[hsl(var(--muted-foreground))] mb-2">
                  No vaults available yet
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Vaults will be created when lenders deposit assets into the protocol
                </p>
              </div>
            ) : (
              <VaultTable vaults={filteredVaults} />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
