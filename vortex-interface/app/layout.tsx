import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import { SuiProvider } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const display = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vortex",
  description: "Structured-yield vault on Sui: earn the DeepBook Predict LP maker spread with a signed, on-chain-verifiable crash-hedge sleeve that caps left-tail drawdown. PLP yield, minus the crash.",
  keywords: ["DeFi", "Sui", "DeepBook Predict", "PLP", "Vault", "Structured Yield", "Crash Hedge", "Sui Overflow"],
  openGraph: {
    title: "Vortex — PLP + Hedge Vault on DeepBook Predict",
    description: "PLP yield, minus the crash. Verifiable structured yield on Sui's DeepBook Predict.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${display.variable}`}>
        <SuiProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </SuiProvider>
      </body>
    </html>
  );
}
