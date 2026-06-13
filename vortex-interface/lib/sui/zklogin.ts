import { generateNonce, generateRandomness, getZkLoginSignature } from "@mysten/sui/zklogin";
import { jwtToAddress } from "@mysten/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { env } from "@/lib/config";

const STORAGE_KEYS = {
  EPHEMERAL_KEYPAIR: "vortex_ephemeral_keypair",
  RANDOMNESS: "vortex_randomness",
  NONCE: "vortex_nonce",
  MAX_EPOCH: "vortex_max_epoch",
  JWT: "vortex_jwt",
  ZK_PROOF: "vortex_zk_proof",
  USER_ADDRESS: "vortex_user_address",
  USER_SALT: "vortex_user_salt",
} as const;

// Enoki API URLs - Enoki allows registering custom OAuth client IDs
// Unlike the direct prover service which only accepts whitelisted IDs
const ENOKI_API_BASE = "https://api.enoki.mystenlabs.com/v1";
const ENOKI_ZK_PROOF_URL = `${ENOKI_API_BASE}/zklogin/zkp`;
const ENOKI_ZK_ADDRESS_URL = `${ENOKI_API_BASE}/zklogin`;

// Legacy prover URLs (kept for reference, but not used when Enoki is configured)
const LEGACY_PROVER_URL = "https://prover.mystenlabs.com/v1";
const LEGACY_SALT_SERVICE_URL = "https://salt.api.mystenlabs.com/get_salt";

export interface ZkLoginSession {
  ephemeralPublicKey: string;
  nonce: string;
  randomness: string;
  maxEpoch: number;
}

export interface ZkLoginUser {
  address: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface ZkProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
  addressSeed: string;
}

export function generateEphemeralKeyPair(): Ed25519Keypair {
  return new Ed25519Keypair();
}

/**
 * Get raw public key bytes (32 bytes) in base64 format for Enoki API.
 * The standard toBase64() includes a flag prefix byte (33 bytes total),
 * but Enoki expects just the raw 32-byte Ed25519 public key.
 */
export function getRawPublicKeyBase64(keypair: Ed25519Keypair): string {
  // toRawBytes() returns the raw public key without the flag prefix
  const rawBytes = keypair.getPublicKey().toRawBytes();
  // Convert to base64 using browser's btoa
  const binaryString = Array.from(rawBytes)
    .map(byte => String.fromCharCode(byte))
    .join('');
  return btoa(binaryString);
}

export function getStoredKeyPair(): Ed25519Keypair | null {
  if (typeof window === "undefined") return null;
  
  const secretKey = sessionStorage.getItem(STORAGE_KEYS.EPHEMERAL_KEYPAIR);
  if (!secretKey) return null;
  
  try {
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch {
    return null;
  }
}

export async function initZkLoginSession(maxEpoch: number): Promise<ZkLoginSession> {
  const ephemeralKeyPair = generateEphemeralKeyPair();
  const randomness = generateRandomness();
  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

  if (typeof window !== "undefined") {
    const secretKey = ephemeralKeyPair.getSecretKey();
    sessionStorage.setItem(STORAGE_KEYS.EPHEMERAL_KEYPAIR, secretKey);
    sessionStorage.setItem(STORAGE_KEYS.RANDOMNESS, randomness);
    sessionStorage.setItem(STORAGE_KEYS.NONCE, nonce);
    sessionStorage.setItem(STORAGE_KEYS.MAX_EPOCH, maxEpoch.toString());
  }

  return {
    ephemeralPublicKey: ephemeralKeyPair.getPublicKey().toBase64(),
    nonce,
    randomness,
    maxEpoch,
  };
}

export function getGoogleLoginUrl(nonce: string): string {
  const clientId = env.zkLogin.googleClientId;
  const redirectUrl = env.zkLogin.redirectUrl;

  if (!clientId) {
    throw new Error("Google Client ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUrl,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decoded);
}

export function extractIdTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("id_token");
}

export function getStoredSession(): Partial<ZkLoginSession> | null {
  if (typeof window === "undefined") return null;

  const randomness = sessionStorage.getItem(STORAGE_KEYS.RANDOMNESS);
  const nonce = sessionStorage.getItem(STORAGE_KEYS.NONCE);
  const maxEpochStr = sessionStorage.getItem(STORAGE_KEYS.MAX_EPOCH);
  const keypairData = sessionStorage.getItem(STORAGE_KEYS.EPHEMERAL_KEYPAIR);

  if (!randomness || !nonce || !maxEpochStr || !keypairData) {
    return null;
  }

  return {
    randomness,
    nonce,
    maxEpoch: parseInt(maxEpochStr, 10),
  };
}

export function getStoredUserAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.USER_ADDRESS);
}

export function setStoredUserAddress(address: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.USER_ADDRESS, address);
  }
}

export function getStoredSalt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.USER_SALT);
}

export function setStoredSalt(salt: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.USER_SALT, salt);
  }
}

export function getStoredJwt(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEYS.JWT);
}

export function setStoredJwt(jwt: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEYS.JWT, jwt);
  }
}

export function getStoredZkProof(): ZkProof | null {
  if (typeof window === "undefined") return null;
  const proof = sessionStorage.getItem(STORAGE_KEYS.ZK_PROOF);
  return proof ? JSON.parse(proof) : null;
}

export function setStoredZkProof(proof: ZkProof): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEYS.ZK_PROOF, JSON.stringify(proof));
  }
}

export function clearZkLoginSession(): void {
  if (typeof window === "undefined") return;

  Object.values(STORAGE_KEYS).forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
}

export function isZkLoginSupported(): boolean {
  return Boolean(env.zkLogin.googleClientId);
}

export function isEnokiConfigured(): boolean {
  return Boolean(env.zkLogin.enokiApiKey && env.zkLogin.enokiApiKey !== "your_enoki_api_key_here");
}

/**
 * Fetch salt and address using Enoki API
 * Enoki manages salt per-app, ensuring consistent addresses
 */
export async function fetchSaltAndAddressFromEnoki(jwt: string): Promise<{ salt: string; address: string }> {
  const enokiApiKey = env.zkLogin.enokiApiKey;
  
  if (!enokiApiKey || enokiApiKey === "your_enoki_api_key_here") {
    throw new Error("Enoki API key not configured. Please set NEXT_PUBLIC_ENOKI_API_KEY in .env.local");
  }
  
  const response = await fetch(ENOKI_ZK_ADDRESS_URL, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${enokiApiKey}`,
      "zklogin-jwt": jwt,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Enoki address API error:", errorText);
    throw new Error(`Enoki address API error: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  return {
    salt: result.data.salt,
    address: result.data.address,
  };
}

export async function fetchSalt(jwt: string): Promise<string> {
  const storedSalt = getStoredSalt();
  if (storedSalt) {
    return storedSalt;
  }
  
  // If Enoki is configured, use Enoki to get salt
  if (isEnokiConfigured()) {
    try {
      const { salt } = await fetchSaltAndAddressFromEnoki(jwt);
      setStoredSalt(salt);
      return salt;
    } catch (error) {
      console.error("Enoki salt fetch failed:", error);
      throw error;
    }
  }
  
  // Fallback to legacy salt service (will likely fail for custom OAuth clients)
  const payload = parseJwtPayload(jwt);
  const sub = payload.sub as string;
  const aud = payload.aud as string;
  
  try {
    const response = await fetch(LEGACY_SALT_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: jwt,
      }),
    });

    if (!response.ok) {
      console.warn("Salt service unavailable, generating deterministic salt");
      const deterministicSalt = generateDeterministicSalt(sub, aud);
      setStoredSalt(deterministicSalt);
      return deterministicSalt;
    }

    const data = await response.json();
    const salt = data.salt;
    setStoredSalt(salt);
    return salt;
  } catch (error) {
    console.warn("Salt service error, generating deterministic salt:", error);
    const deterministicSalt = generateDeterministicSalt(sub, aud);
    setStoredSalt(deterministicSalt);
    return deterministicSalt;
  }
}

function generateDeterministicSalt(sub: string, aud: string): string {
  // Generate a deterministic 128-bit salt from sub and aud
  // This follows the zkLogin specification for salt values
  const input = `${sub}:${aud}:vortex-hackathon-2026`;
  
  // Use multiple hash iterations to generate a 128-bit value
  // We need roughly 39 decimal digits for a 128-bit number
  let hash1 = 0;
  let hash2 = 0;
  let hash3 = 0;
  let hash4 = 0;
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1 + char) >>> 0;
    hash2 = ((hash2 << 7) - hash2 + char) >>> 0;
    hash3 = ((hash3 << 11) - hash3 + char) >>> 0;
    hash4 = ((hash4 << 13) - hash4 + char) >>> 0;
  }
  
  // Combine hashes to create a large number (simulating 128-bit)
  // Each hash is 32-bit, so 4 hashes give us 128 bits
  const bigHash = BigInt(hash1) * BigInt(2**96) + 
                  BigInt(hash2) * BigInt(2**64) + 
                  BigInt(hash3) * BigInt(2**32) + 
                  BigInt(hash4);
  
  return bigHash.toString();
}

export async function deriveZkLoginAddress(jwt: string, salt: string): Promise<string> {
  const payload = parseJwtPayload(jwt);
  const iss = payload.iss as string;
  const aud = payload.aud as string;
  
  try {
    const address = jwtToAddress(jwt, salt);
    return address;
  } catch (error) {
    console.error("Error deriving zkLogin address:", error);
    throw new Error("Failed to derive zkLogin address");
  }
}

export async function fetchZkProof(
  jwt: string,
  salt: string,
  ephemeralPublicKey: string,
  maxEpoch: number,
  randomness: string
): Promise<ZkProof> {
  const storedProof = getStoredZkProof();
  if (storedProof) {
    return storedProof;
  }

  // Use Enoki if configured
  if (isEnokiConfigured()) {
    return fetchZkProofFromEnoki(jwt, ephemeralPublicKey, maxEpoch, randomness, salt);
  }

  // Fallback to legacy prover (will likely fail for custom OAuth clients)
  try {
    const response = await fetch(LEGACY_PROVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jwt,
        extendedEphemeralPublicKey: ephemeralPublicKey,
        maxEpoch,
        jwtRandomness: randomness,
        salt,
        keyClaimName: "sub",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Prover service error:", errorText);
      throw new Error(`Prover service error: ${response.status} - ${errorText}`);
    }

    const proof = await response.json() as Omit<ZkProof, 'addressSeed'>;
    const addressSeed = salt;
    
    const fullProof: ZkProof = {
      ...proof,
      addressSeed,
    };

    setStoredZkProof(fullProof);
    return fullProof;
  } catch (error) {
    console.error("Failed to fetch ZK proof:", error);
    throw error;
  }
}

/**
 * Fetch ZK proof using Enoki API
 * This is the preferred method as it allows custom OAuth client IDs
 */
async function fetchZkProofFromEnoki(
  jwt: string,
  ephemeralPublicKey: string,
  maxEpoch: number,
  randomness: string,
  salt: string
): Promise<ZkProof> {
  const enokiApiKey = env.zkLogin.enokiApiKey;
  const network = env.sui.network;
  
  if (!enokiApiKey || enokiApiKey === "your_enoki_api_key_here") {
    throw new Error("Enoki API key not configured. Please set NEXT_PUBLIC_ENOKI_API_KEY in .env.local");
  }
  
  try {
    const response = await fetch(ENOKI_ZK_PROOF_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${enokiApiKey}`,
        "Content-Type": "application/json",
        "zklogin-jwt": jwt,
      },
      body: JSON.stringify({
        network: network,
        ephemeralPublicKey: ephemeralPublicKey,
        maxEpoch: maxEpoch,
        randomness: randomness,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Enoki ZK proof API error:", errorText);
      throw new Error(`Enoki ZK proof API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const proofData = result.data;
    
    // Enoki returns addressSeed in the response
    const fullProof: ZkProof = {
      proofPoints: proofData.proofPoints,
      issBase64Details: proofData.issBase64Details,
      headerBase64: proofData.headerBase64,
      addressSeed: proofData.addressSeed || salt,
    };

    setStoredZkProof(fullProof);
    return fullProof;
  } catch (error) {
    console.error("Failed to fetch ZK proof from Enoki:", error);
    throw error;
  }
}

export async function completeZkLogin(jwt: string): Promise<{
  address: string;
  salt: string;
  proof?: ZkProof;
}> {
  let salt: string;
  let address: string;
  
  // If Enoki is configured, get salt and address from Enoki
  // This ensures we use the exact same values that Enoki uses for ZK proof
  if (isEnokiConfigured()) {
    try {
      const enokiResult = await fetchSaltAndAddressFromEnoki(jwt);
      salt = enokiResult.salt;
      address = enokiResult.address;
      setStoredSalt(salt);
    } catch (error) {
      console.error("Failed to get salt/address from Enoki:", error);
      throw error;
    }
  } else {
    // Fallback to legacy method
    salt = await fetchSalt(jwt);
    address = await deriveZkLoginAddress(jwt, salt);
  }
  
  setStoredUserAddress(address);
  setStoredJwt(jwt);

  const session = getStoredSession();
  let proof: ZkProof | undefined;
  
  if (session?.randomness && session?.maxEpoch) {
    const keypair = getStoredKeyPair();
    if (keypair) {
      try {
        // Use different public key format based on prover service
        // Enoki expects raw 32-byte Ed25519 key in base64
        // Legacy prover expects SuiPublicKey format (33 bytes with flag prefix)
        const ephemeralPubKey = isEnokiConfigured() 
          ? getRawPublicKeyBase64(keypair)
          : keypair.getPublicKey().toBase64();
        
        proof = await fetchZkProof(
          jwt,
          salt,
          ephemeralPubKey,
          session.maxEpoch,
          session.randomness
        );
      } catch (error) {
        console.error("ZK proof generation failed:", error);
        // Re-throw the error so the user knows there's an issue
        throw error;
      }
    }
  }

  return { address, salt, proof };
}

export { jwtToAddress, getZkLoginSignature };
