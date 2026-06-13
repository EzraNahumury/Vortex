"use client";

import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useEffect, useCallback } from "react";
import { setSignAndExecuteCallback } from "@/lib/sui/transaction-executor";
import { Transaction } from "@mysten/sui/transactions";

/**
 * Hook that sets up transaction execution capability for the app.
 * This must be used within a component that has access to dapp-kit hooks.
 * It sets a global callback that transaction-executor can use.
 */
export function useTransactionExecutor() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const executeTransaction = useCallback(async (tx: Transaction) => {
    const result = await signAndExecute({
      transaction: tx,
    });
    return {
      digest: result.digest,
      effects: result.effects,
    };
  }, [signAndExecute]);

  // Set the callback when the hook is mounted
  useEffect(() => {
    setSignAndExecuteCallback(executeTransaction);
    return () => {
      setSignAndExecuteCallback(null);
    };
  }, [executeTransaction]);

  return { executeTransaction };
}
