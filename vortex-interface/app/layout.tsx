import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { SuiProvider } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vortex - DeFi Lending Protocol",
  description: "Fair and inclusive order book-based lending protocol built natively on Sui blockchain with ZK privacy and AI fair matching",
  keywords: ["DeFi", "Lending", "Sui", "Blockchain", "ZK Privacy", "Order Book"],
  openGraph: {
    title: "Vortex - DeFi Lending Protocol",
    description: "Order book-based DeFi lending with ZK privacy and AI fair matching on Sui",
    type: "website",
  },
  icons: {
    icon: "/logo/icon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SuiProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </SuiProvider>
      </body>
    </html>
  );
}
