"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/predict", label: "Predict" },
  { href: "/earn", label: "Earn" },
  { href: "/borrow", label: "Borrow" },
  { href: "/orderbook", label: "Orderbook" },
  { href: "/positions", label: "Positions" },
  { href: "/vesting", label: "Vesting" },
  { href: "/faucet", label: "Faucet" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--background))]/80 backdrop-blur-xl border-b border-[hsl(var(--border))]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <div className="relative w-8 h-8">
                <Image 
                  src="/logo/Vortex.png" 
                  alt="Vortex" 
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <span className="text-base font-semibold text-[hsl(var(--foreground))]">Vortex</span>
            </Link>

            <nav className="hidden md:flex items-center bg-[hsl(var(--secondary))]/50 rounded-full p-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer",
                    pathname === item.href
                      ? "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--secondary))]/50">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Testnet</span>
            </div>
            <ConnectButton />
            
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[hsl(var(--border))]/50 bg-[hsl(var(--background))]/95 backdrop-blur-xl">
          <nav className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  pathname === item.href
                    ? "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]/50 hover:text-[hsl(var(--foreground))]"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-[hsl(var(--border))]/50">
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Connected to Testnet</span>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
