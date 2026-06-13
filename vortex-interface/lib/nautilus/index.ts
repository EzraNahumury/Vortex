/**
 * Nautilus Integration Module
 * 
 * This module provides integration with Nautilus - Sui's verifiable off-chain compute layer.
 * For production, this would connect to a real AWS Nitro Enclave running Nautilus.
 * For hackathon demo, we provide a simulated enclave that demonstrates the flow.
 * 
 * Architecture:
 * 1. Client calls computeFairnessScore with order parameters
 * 2. Nautilus enclave (real or simulated) computes the fairness score
 * 3. Returns signed response that can be verified on-chain
 * 4. Smart contract verifies signature and executes matching
 * 
 * @see https://docs.sui.io/concepts/cryptography/nautilus
 * @see https://github.com/MystenLabs/nautilus
 */

import { env } from "@/lib/config";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromHex, normalizeSuiAddress } from "@mysten/sui/utils";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

// Nautilus enclave configuration
export interface EnclaveConfig {
  // Enclave public key (Ed25519)
  publicKey: Uint8Array;
  // Platform Configuration Registers (SHA-384 hashes)
  pcr0: string;
  pcr1: string;
  pcr2: string;
  // Enclave URL (for real mode)
  enclaveUrl?: string;
}

// Request to compute fairness score
export interface FairnessRequest {
  lendOrderId: string;
  borrowOrderId: string;
  lendAmount: number;
  borrowAmount: number;
  lendRate: number;
  borrowRate: number;
  lenderAddress: string;
  borrowerAddress: string;
  // Optional vesting info for priority boost
  isVested?: boolean;
  vestingPositionId?: string;
}

// Response from Nautilus enclave
export interface FairnessResponse {
  // Computed fairness score (0-100)
  score: number;
  // Final matched rate (midpoint)
  finalRate: number;
  // Components of the score
  scoreBreakdown: {
    retailBoost: number;      // Boost for small orders
    diversityBonus: number;   // Bonus for risk diversification
    vestingBonus: number;     // Bonus for vested collateral
    concentrationPenalty: number; // Penalty for over-concentration
  };
  // Ed25519 signature over the message
  signature: Uint8Array;
  // The message that was signed
  message: Uint8Array;
  // Timestamp of computation
  timestamp: number;
}

/**
 * Simulated Nautilus Enclave for Demo Purposes
 * 
 * In production, this would be replaced by actual HTTP calls to an AWS Nitro Enclave.
 * The enclave would run the fairness algorithm and sign results with its private key.
 */
class SimulatedNautilusEnclave {
  private keypair: Ed25519Keypair;
  
  constructor(privateKeyHex?: string) {
    if (privateKeyHex) {
      if (privateKeyHex.startsWith("suiprivkey")) {
        const { secretKey } = decodeSuiPrivateKey(privateKeyHex);
        this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
      } else {
        // Use provided private key for real signatures
        const cleanHex = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
        this.keypair = Ed25519Keypair.fromSecretKey(fromHex(cleanHex));
      }
    } else {
      // Generate random ephemeral key for mock mode if no key provided
      this.keypair = new Ed25519Keypair();
    }
  }

  /**
   * Compute fairness score using Vortex's AI-fairness algorithm
   * 
   * The algorithm prioritizes:
   * 1. Small/retail orders (anti-whale)
   * 2. Risk diversification
   * 3. Vested collateral holders
   * 4. First-come-first-served for equal scores
   */
  async computeFairnessScore(request: FairnessRequest): Promise<FairnessResponse> {
    const breakdown = {
      retailBoost: 0,
      diversityBonus: 0,
      vestingBonus: 0,
      concentrationPenalty: 0,
    };

    // 1. Retail Boost (small orders get priority)
    // Orders < $10,000 get up to 20 points boost
    const maxRetailSize = 10000;
    if (request.lendAmount < maxRetailSize) {
      breakdown.retailBoost = Math.floor(20 * (1 - request.lendAmount / maxRetailSize));
    }
    if (request.borrowAmount < maxRetailSize) {
      breakdown.retailBoost += Math.floor(10 * (1 - request.borrowAmount / maxRetailSize));
    }
    breakdown.retailBoost = Math.min(breakdown.retailBoost, 30);

    // 2. Diversity Bonus
    // Different addresses = good for ecosystem
    if (request.lenderAddress !== request.borrowerAddress) {
      breakdown.diversityBonus = 15;
    }

    // 3. Vesting Bonus
    // Vested collateral holders get priority matching
    if (request.isVested) {
      breakdown.vestingBonus = 25;
    }

    // 4. Concentration Penalty
    // Large orders that might dominate the market
    const totalVolume = request.lendAmount + request.borrowAmount;
    if (totalVolume > 100000) {
      breakdown.concentrationPenalty = Math.min(20, Math.floor((totalVolume - 100000) / 10000));
    }

    // Calculate final score (base 50 + bonuses - penalties)
    const baseScore = 50;
    const score = Math.max(0, Math.min(100,
      baseScore +
      breakdown.retailBoost +
      breakdown.diversityBonus +
      breakdown.vestingBonus -
      breakdown.concentrationPenalty
    ));

    // Calculate final rate (midpoint between lend and borrow rates)
    const finalRate = (request.lendRate + request.borrowRate) / 2;

    // Create message to sign
    // IMPORTANT: Must match Move contract serialization exactly
    const message = this.createMessage(
      request.lendOrderId,
      request.borrowOrderId,
      score
    );

    // Sign with Ed25519
    const signature = await this.keypair.sign(message);

    return {
      score,
      finalRate,
      scoreBreakdown: breakdown,
      signature,
      message,
      timestamp: Date.now(),
    };
  }

  /**
   * Create the message to be signed
   * Format: lendOrderId || borrowOrderId || fairnessScore (BCS encoded)
   */
  private createMessage(
    lendOrderId: string,
    borrowOrderId: string,
    score: number
  ): Uint8Array {
    // Convert order IDs to normalized 32-byte address format
    const lendIdBytes = fromHex(normalizeSuiAddress(lendOrderId));
    const borrowIdBytes = fromHex(normalizeSuiAddress(borrowOrderId));
    
    // BCS encode the score as u64 (Little Endian)
    const scoreBytes = new Uint8Array(8);
    const view = new DataView(scoreBytes.buffer);
    view.setBigUint64(0, BigInt(score), true); // little-endian

    // Concatenate all parts
    // IMPORTANT: Must match Move contract serialization exactly
    // Format: lendId (32 bytes) || borrowId (32 bytes) || score (8 bytes)
    const message = new Uint8Array(
      lendIdBytes.length + borrowIdBytes.length + scoreBytes.length
    );
    let offset = 0;
    message.set(lendIdBytes, offset); offset += lendIdBytes.length;
    message.set(borrowIdBytes, offset); offset += borrowIdBytes.length;
    message.set(scoreBytes, offset);

    // console.log("Nautilus Message Bytes:", Array.from(message));
    return message;
  }

  getPublicKey(): Uint8Array {
    return this.keypair.getPublicKey().toSuiBytes();
  }

  /**
   * Sign an arbitrary message under the enclave's key. Used by the vault aggregator path
   * where each allocation leg has its own signed payload.
   */
  async signRaw(message: Uint8Array): Promise<Uint8Array> {
    return this.keypair.sign(message);
  }
}

// Helper function to convert hex string to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Helper function to convert bytes to hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Vault allocation request — given a deposit amount, the enclave proposes how to split it
 * across one or more markets to chase yield. In production the recommendation comes from a
 * Nautilus-hosted model; here we return a deterministic-but-tunable plan.
 */
export interface AllocationLegRequest {
  marketId: string;
  weight: number;       // fraction of the deposit, 0..1
  rateBps: number;
  durationMs: number;
}

export interface AllocationPlanRequest {
  vaultId: string;
  amount: number;       // raw smallest-unit amount
  legs: AllocationLegRequest[];
}

export interface SignedAllocationLeg {
  marketId: string;
  amount: number;       // raw smallest-unit amount
  rateBps: number;
  durationMs: number;
  nonce: number;
  signature: Uint8Array;
}

/**
 * Sign an allocation plan using the enclave keypair so the on-chain vault can verify each
 * leg before routing capital. Each leg gets its own signature so the keeper can submit
 * legs independently if some markets are temporarily paused.
 */
export async function signAllocationPlan(
  request: AllocationPlanRequest,
): Promise<SignedAllocationLeg[]> {
  const enclave = getEnclave();
  const nonce = Date.now();
  const totalWeight = request.legs.reduce((acc, leg) => acc + leg.weight, 0);
  if (totalWeight <= 0) throw new Error("Allocation plan has zero total weight");

  const out: SignedAllocationLeg[] = [];
  let allocated = 0;
  for (let i = 0; i < request.legs.length; i++) {
    const leg = request.legs[i];
    // Last leg absorbs rounding so the sum exactly equals request.amount.
    const isLast = i === request.legs.length - 1;
    const legAmount = isLast
      ? request.amount - allocated
      : Math.floor(request.amount * (leg.weight / totalWeight));
    allocated += legAmount;

    const message = buildAllocationLegMessage({
      vaultId: request.vaultId,
      nonce,
      marketId: leg.marketId,
      amount: legAmount,
      rateBps: leg.rateBps,
      durationMs: leg.durationMs,
    });
    const signature = await enclave.signRaw(message);

    out.push({
      marketId: leg.marketId,
      amount: legAmount,
      rateBps: leg.rateBps,
      durationMs: leg.durationMs,
      nonce,
      signature,
    });
  }
  return out;
}

function buildAllocationLegMessage(args: {
  vaultId: string;
  nonce: number;
  marketId: string;
  amount: number;
  rateBps: number;
  durationMs: number;
}): Uint8Array {
  const vaultBytes = fromHex(normalizeSuiAddress(args.vaultId));
  const marketBytes = fromHex(normalizeSuiAddress(args.marketId));
  const u64 = (n: number) => {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, BigInt(n), true);
    return buf;
  };
  const parts = [
    vaultBytes,
    u64(args.nonce),
    marketBytes,
    u64(args.amount),
    u64(args.rateBps),
    u64(args.durationMs),
  ];
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// Singleton instance
let nautilusEnclave: SimulatedNautilusEnclave | null = null;

function getEnclave(): SimulatedNautilusEnclave {
  if (!nautilusEnclave) {
    // Check for dev private key in environment
    const devPrivateKey = process.env.NEXT_PUBLIC_NAUTILUS_DEV_PRIVATE_KEY;
    nautilusEnclave = new SimulatedNautilusEnclave(devPrivateKey);
    
    if (devPrivateKey) {
      console.log("Initialized Virtual Enclave with configured Private Key");
    } else {
      console.warn("Initialized Virtual Enclave with RANDOM ephemeral key (will not match on-chain unless registered)");
    }
  }
  return nautilusEnclave;
}

/**
 * Main API: Compute fairness score for order matching
 * 
 * @param request - Order matching request
 * @returns Signed fairness response from Nautilus enclave
 */
export async function computeFairnessScore(
  request: FairnessRequest
): Promise<FairnessResponse> {
  // Simulate network latency to enclave
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const enclave = getEnclave();
  return await enclave.computeFairnessScore(request);
}

/**
 * Get the enclave's public key for on-chain registration
 */
export function getEnclavePublicKey(): Uint8Array {
  return getEnclave().getPublicKey();
}

/**
 * Get PCRs for demo enclave
 * In production, these would be actual SHA-384 hashes of enclave code
 */
export function getEnclavePCRs(): { pcr0: string; pcr1: string; pcr2: string } {
  // 48-byte (96 hex chars) SHA-384 hashes
  // These are demo values - in production they're computed from enclave image
  return {
    pcr0: "0x" + "00".repeat(48), // Demo PCR0
    pcr1: "0x" + "00".repeat(48), // Demo PCR1
    pcr2: "0x" + "00".repeat(48), // Demo PCR2
  };
}

/**
 * Check if real Nautilus enclave is available
 */
export function isRealEnclaveAvailable(): boolean {
  // In future, this would check if a real enclave URL is configured
  const enclaveUrl = process.env.NEXT_PUBLIC_NAUTILUS_ENCLAVE_URL;
  return !!enclaveUrl;
}

/**
 * Format signature for on-chain verification
 * Returns the signature as a vector<u8> compatible format
 */
export function formatSignatureForChain(signature: Uint8Array): number[] {
  return Array.from(signature);
}

/**
 * Format message for on-chain verification
 * Returns the message as a vector<u8> compatible format
 */
export function formatMessageForChain(message: Uint8Array): number[] {
  return Array.from(message);
}
