"use client";

import { useEffect, useState } from "react";
import { Navbar, AppBackground } from "@/components/shared";
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
import { Sparkles, ShieldCheck, Layers, TrendingUp, Wallet } from "lucide-react";
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
    // In mock mode the executor short-circuits to a simulated success, so the
    // on-chain vault id is not required. Only enforce it for real transactions.
    if (!isMockMode() && !AGGREGATOR_VAULT_ID) {
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
    if (!address) {
      toast.error("Connect wallet first");
      return;
    }
    const mock = isMockMode();
    const enclaveId = process.env.NEXT_PUBLIC_NAUTILUS_ENCLAVE_ID || "";
    // In mock mode the allocation is simulated end-to-end, so the on-chain enclave/vault
    // ids are not required. Only enforce them for real transactions.
    if (!mock && (!enclaveId || !AGGREGATOR_VAULT_ID)) {
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
      // Mock mode: fall back to placeholder market ids so the simulated routing still runs.
      const effectiveMarketIds = marketIds.length > 0 ? marketIds : mock ? ["0x1", "0x2"] : [];
      if (effectiveMarketIds.length === 0) {
        toast.error("Set NEXT_PUBLIC_VAULT_MARKETS=<id1>,<id2> first");
        return;
      }
      const weight = 1 / effectiveMarketIds.length;
      const decimals = AGGREGATOR_VAULT_ASSET === "USDC" ? 6 : AGGREGATOR_VAULT_ASSET === "ETH" ? 8 : 9;
      const amountSmallest = Math.floor(amount * Math.pow(10, decimals));

      const { legResults, success } = await executeAllocationPlan(
        {
          vaultId: AGGREGATOR_VAULT_ID || "0x1",
          enclaveId: enclaveId || "0x1",
          asset: AGGREGATOR_VAULT_ASSET,
          collateral: "SUI",
          amount: amountSmallest,
          legs: effectiveMarketIds.map((marketId) => ({
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
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] font-display">
      <AppBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* ============================ HEADER ============================ */}
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-white/[0.03] px-3.5 py-1.5 text-xs tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            <span className="lp-muted uppercase">Vaults · Verifiable yield</span>
          </div>
          <h1 className="text-[clamp(34px,5vw,56px)] font-bold leading-[1.02] text-[hsl(var(--foreground))]">
            Earn <span className="text-[hsl(var(--primary))]">structured yield.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Deposit assets into vaults to earn yield through lending — every allocation leg is
            signed off-chain and verified on-chain before capital moves.
          </p>
        </div>

        {/* ===================== AGGREGATOR VAULT CARD ===================== */}
        <div className="mb-10 overflow-hidden rounded-3xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--card))]/60 p-6 backdrop-blur-xl shadow-[0_24px_70px_-30px_rgba(0,0,0,0.8)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 text-xs font-medium text-[hsl(var(--primary))]">
                <Sparkles className="h-3.5 w-3.5" />
                Nautilus Aggregator Vault
              </div>
              <h2 className="mt-4 text-2xl font-bold leading-snug text-[hsl(var(--foreground))] sm:text-3xl">
                Auto-route{" "}
                <span className="text-[hsl(var(--primary))]">{AGGREGATOR_VAULT_ASSET}</span> into
                best-rate markets
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                The off-chain enclave designs the allocation plan and signs each leg. The vault
                only routes capital after verifying those signatures on-chain.
              </p>

              {/* trust chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { icon: ShieldCheck, label: "ed25519-signed legs" },
                  { icon: Layers, label: "On-chain verified" },
                  { icon: TrendingUp, label: "Best-rate routing" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]"
                  >
                    <chip.icon className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-full">
                    <Wallet className="h-4 w-4" />
                    Deposit
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px] rounded-2xl border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 backdrop-blur-xl">
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
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setDepositOpen(false)}
                        disabled={isDepositing}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="rounded-full"
                        onClick={handleVaultDeposit}
                        disabled={isDepositing}
                      >
                        {isDepositing ? "Depositing..." : "Confirm"}
                      </Button>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {isMockMode() ? "Mock mode: no on-chain transaction will be sent." : "On-chain deposit via vault::deposit."}
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={handleAutoAllocate}
                disabled={isAllocating}
              >
                <Sparkles className="h-4 w-4" />
                {isAllocating ? "Allocating..." : "Auto-Allocate"}
              </Button>
            </div>
          </div>
        </div>

        {/* ============================= TABS ============================= */}
        <Tabs defaultValue="vaults" className="w-full">
          <TabsList className="mb-6 rounded-full border border-[hsl(var(--border))] bg-white/[0.02] p-1">
            <TabsTrigger value="positions" className="cursor-pointer rounded-full">Your positions</TabsTrigger>
            <TabsTrigger value="vaults" className="cursor-pointer rounded-full">Vaults</TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            {lendingPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-14 text-center backdrop-blur-xl">
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                  <Wallet className="h-5 w-5 text-[hsl(var(--primary))]" />
                </span>
                <p className="mb-2 text-base font-semibold text-[hsl(var(--foreground))]">
                  You have no active lending positions
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Deposit assets into a vault to start earning yield
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 backdrop-blur-xl">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))]">
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Asset</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Amount</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">APY</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Earned</th>
                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lendingPositions.map((pos) => (
                        <tr
                          key={pos.id}
                          className="border-b border-[hsl(var(--border))] transition-colors last:border-b-0 hover:bg-white/[0.02]"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-[hsl(var(--foreground))]">{pos.asset}</td>
                          <td className="px-6 py-4 text-sm font-medium text-[hsl(var(--foreground))]">${pos.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-[hsl(var(--primary))]">{pos.interestRate}%</td>
                          <td className="px-6 py-4 text-sm font-semibold text-[hsl(var(--success))]">+${pos.earnedInterest?.toLocaleString() || 0}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-xs font-medium text-[hsl(var(--primary))]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
                              {pos.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              <div className="flex items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-14 backdrop-blur-xl">
                <div className="animate-pulse text-[hsl(var(--muted-foreground))]">Loading vaults...</div>
              </div>
            ) : filteredVaults.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/60 p-14 text-center backdrop-blur-xl">
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                  <Layers className="h-5 w-5 text-[hsl(var(--primary))]" />
                </span>
                <p className="mb-2 text-base font-semibold text-[hsl(var(--foreground))]">
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
