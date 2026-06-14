"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";

import Image from "next/image";

interface VaultFiltersProps {
  onSearch: (query: string) => void;
  onDepositFilter: (value: string) => void;
  onCuratorFilter: (value: string) => void;
}

export function VaultFilters({ onSearch, onDepositFilter, onCuratorFilter }: VaultFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/40 p-3 backdrop-blur-xl sm:gap-4 sm:p-4">
      <div className="flex items-center gap-1.5 pl-1 text-xs text-[hsl(var(--muted-foreground))]">
        <SlidersHorizontal className="h-4 w-4 text-[hsl(var(--primary))]" />
        <span className="uppercase tracking-wide">Filters</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-[hsl(var(--muted-foreground))]">Deposit:</span>
        <Select onValueChange={onDepositFilter} defaultValue="all">
          <SelectTrigger className="w-[140px] rounded-full border-[hsl(var(--border))] bg-white/[0.02] cursor-pointer transition hover:bg-white/[0.05]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="usdc">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src="/token/usdc.png" alt="USDC" fill sizes="20px" className="object-cover" />
                </div>
                <span>USDC</span>
              </div>
            </SelectItem>
            <SelectItem value="sui">
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src="/token/sui.png" alt="SUI" fill sizes="20px" className="object-cover" />
                </div>
                <span>SUI</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-[hsl(var(--muted-foreground))]">Curator:</span>
        <Select onValueChange={onCuratorFilter} defaultValue="all">
          <SelectTrigger className="w-[110px] rounded-full border-[hsl(var(--border))] bg-white/[0.02] cursor-pointer transition hover:bg-white/[0.05]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder="Filter vaults"
          className="pl-10 w-full sm:w-[220px] rounded-full border-[hsl(var(--border))] bg-white/[0.02] transition focus-visible:bg-white/[0.04]"
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </div>
  );
}
