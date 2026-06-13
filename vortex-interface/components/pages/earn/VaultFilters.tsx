"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

import Image from "next/image";

interface VaultFiltersProps {
  onSearch: (query: string) => void;
  onDepositFilter: (value: string) => void;
  onCuratorFilter: (value: string) => void;
}

export function VaultFilters({ onSearch, onDepositFilter, onCuratorFilter }: VaultFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[hsl(var(--muted-foreground))]">Deposit:</span>
        <Select onValueChange={onDepositFilter} defaultValue="all">
          <SelectTrigger className="w-[140px] bg-[hsl(var(--secondary))] border-none cursor-pointer">
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
          <SelectTrigger className="w-[100px] bg-[hsl(var(--secondary))] border-none cursor-pointer">
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder="Filter vaults"
          className="pl-10 w-[200px] bg-[hsl(var(--secondary))] border-none"
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </div>
  );
}
