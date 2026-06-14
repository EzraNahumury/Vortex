"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  extractIdTokenFromUrl, 
  parseJwtPayload, 
  getStoredSession,
  setStoredJwt,
  completeZkLogin,
} from "@/lib/sui/zklogin";
import { Loader2, CheckCircle, XCircle, Shield } from "lucide-react";

type CallbackStatus = "processing" | "deriving" | "proving" | "success" | "error";

interface JwtPayload {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  nonce?: string;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const idToken = extractIdTokenFromUrl();

      if (!idToken) {
        setStatus("error");
        setMessage("No authentication token found. Please try again.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      const payload = parseJwtPayload(idToken) as JwtPayload;

      const storedSession = getStoredSession();
      if (!storedSession) {
        setStatus("error");
        setMessage("Session expired. Please try again.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      if (payload.nonce !== storedSession.nonce) {
        setStatus("error");
        setMessage("Invalid session. Please try again.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        setStatus("error");
        setMessage("Token expired. Please try again.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      setStoredJwt(idToken);
      sessionStorage.setItem("vortex_user_email", payload.email || "");
      sessionStorage.setItem("vortex_user_name", payload.name || "");
      if (payload.picture) {
        sessionStorage.setItem("vortex_user_picture", payload.picture);
      }

      setStatus("deriving");
      setMessage("Deriving your zkLogin address...");

      try {
        const result = await completeZkLogin(idToken);
        setDerivedAddress(result.address);

        if (result.proof) {
          setStatus("proving");
          setMessage("ZK proof generated successfully!");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        setStatus("success");
        setMessage("Authentication successful! Redirecting...");

        await new Promise((resolve) => setTimeout(resolve, 1500));
        window.location.href = "/predict?auth=success";
      } catch (zkError) {
        console.error("zkLogin completion error:", zkError);
        setStatus("error");
        setMessage("Failed to derive address. Please try again.");
        setTimeout(() => router.push("/"), 3000);
      }
    } catch (error) {
      console.error("Auth callback error:", error);
      setStatus("error");
      setMessage("Authentication failed. Please try again.");
      setTimeout(() => router.push("/"), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          {(status === "processing" || status === "deriving" || status === "proving") && (
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--primary))]/20 flex items-center justify-center mx-auto">
              {status === "proving" ? (
                <Shield className="w-8 h-8 text-[hsl(var(--primary))] animate-pulse" />
              ) : (
                <Loader2 className="w-8 h-8 text-[hsl(var(--primary))] animate-spin" />
              )}
            </div>
          )}
          {status === "success" && (
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--success))]/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-[hsl(var(--success))]" />
            </div>
          )}
          {status === "error" && (
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--destructive))]/20 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-[hsl(var(--destructive))]" />
            </div>
          )}
        </div>

        <h1 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">
          {status === "processing" && "Authenticating"}
          {status === "deriving" && "Deriving Address"}
          {status === "proving" && "Generating ZK Proof"}
          {status === "success" && "Welcome to Vortex"}
          {status === "error" && "Authentication Failed"}
        </h1>

        <p className="text-[hsl(var(--muted-foreground))]">{message}</p>

        {derivedAddress && status !== "error" && (
          <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--secondary))]">
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Your zkLogin Address</p>
            <p className="text-sm font-mono text-[hsl(var(--foreground))] break-all">
              {derivedAddress.slice(0, 20)}...{derivedAddress.slice(-8)}
            </p>
          </div>
        )}

        {status !== "error" && status !== "success" && (
          <div className="mt-6 flex justify-center gap-2">
            {["processing", "deriving", "proving"].map((step, index) => {
              const currentIndex = ["processing", "deriving", "proving"].indexOf(status);
              const stepIndex = index;
              return (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    stepIndex <= currentIndex
                      ? "bg-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--muted))]"
                  }`}
                />
              );
            })}
          </div>
        )}

        {status === "error" && (
          <button
            onClick={() => router.push("/")}
            className="mt-6 px-6 py-2 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium cursor-pointer hover:bg-[hsl(var(--primary))]/90 transition-colors"
          >
            Return Home
          </button>
        )}
      </div>
    </div>
  );
}
