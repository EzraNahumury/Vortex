/**
 * Strategist signer — the verifiable off-chain brain of the PLP+Hedge vault.
 *
 * Each strategy leg (supply to PLP, mint a hedge, unwind PLP) is authorized by an ed25519
 * signature over a domain-separated message whose byte layout MUST match
 * `vortex_predict::vault` exactly. The on-chain vault re-derives the same bytes and calls
 * `ed25519_verify` against its registered strategist public key, so anyone can audit that a
 * given allocation was the one the strategist actually signed.
 *
 * Layouts (little-endian u64, 32-byte object ids):
 *   supply       : [0x01] | vault_id | nonce | amount
 *   hedge        : [0x02] | vault_id | nonce | oracle_id | expiry | strike | is_up | quantity | budget
 *   withdraw_plp : [0x03] | vault_id | nonce | plp_amount
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { fromHex, normalizeSuiAddress } from "@mysten/sui/utils";

export const TAG_SUPPLY = 1;
export const TAG_HEDGE = 2;
export const TAG_WITHDRAW_PLP = 3;

function u64le(v: bigint | number): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt(v), true);
  return buf;
}

function idBytes(id: string): Uint8Array {
  return fromHex(normalizeSuiAddress(id));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function buildSupplyMessage(vaultId: string, nonce: bigint | number, amount: bigint | number): Uint8Array {
  return concat([new Uint8Array([TAG_SUPPLY]), idBytes(vaultId), u64le(nonce), u64le(amount)]);
}

export function buildHedgeMessage(params: {
  vaultId: string;
  nonce: bigint | number;
  oracleId: string;
  expiry: bigint | number;
  strike: bigint | number;
  isUp: boolean;
  quantity: bigint | number;
  budget: bigint | number;
}): Uint8Array {
  return concat([
    new Uint8Array([TAG_HEDGE]),
    idBytes(params.vaultId),
    u64le(params.nonce),
    idBytes(params.oracleId),
    u64le(params.expiry),
    u64le(params.strike),
    new Uint8Array([params.isUp ? 1 : 0]),
    u64le(params.quantity),
    u64le(params.budget),
  ]);
}

export function buildWithdrawPlpMessage(vaultId: string, nonce: bigint | number, plpAmount: bigint | number): Uint8Array {
  return concat([new Uint8Array([TAG_WITHDRAW_PLP]), idBytes(vaultId), u64le(nonce), u64le(plpAmount)]);
}

/** Construct the strategist keypair from a suiprivkey... or hex secret key. */
export function strategistKeypair(secret: string): Ed25519Keypair {
  if (secret.startsWith("suiprivkey")) {
    const { secretKey } = decodeSuiPrivateKey(secret);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const clean = secret.startsWith("0x") ? secret.slice(2) : secret;
  return Ed25519Keypair.fromSecretKey(fromHex(clean));
}

/** Sign a leg message; returns the raw 64-byte ed25519 signature the Move verifier expects. */
export async function signLeg(keypair: Ed25519Keypair, message: Uint8Array): Promise<Uint8Array> {
  return keypair.sign(message);
}
