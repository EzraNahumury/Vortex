/**
 * DeepBook Predict + Equinox PLP/Hedge vault configuration.
 *
 * Defaults point at the live testnet deployment so the app works with zero env setup for
 * the demo; every value can be overridden via NEXT_PUBLIC_* env vars.
 */

export const predictConfig = {
  network: process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet",
  rpcUrl: process.env.NEXT_PUBLIC_SUI_RPC_URL || "https://fullnode.testnet.sui.io:443",

  // DeepBook Predict protocol (branch predict-testnet-4-16)
  predictPackageId:
    process.env.NEXT_PUBLIC_PREDICT_PACKAGE_ID ||
    "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  predictObjectId:
    process.env.NEXT_PUBLIC_PREDICT_OBJECT_ID ||
    "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  registryId:
    process.env.NEXT_PUBLIC_PREDICT_REGISTRY_ID ||
    "0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64",
  dusdcType:
    process.env.NEXT_PUBLIC_DUSDC_TYPE ||
    "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",

  // Equinox PLP+Hedge vault (our package)
  vaultPackageId:
    process.env.NEXT_PUBLIC_VAULT_PACKAGE_ID ||
    "0xd4d556eea3435ff1f2a102b784ba1cc00a116c277513f73242409ad762a55e39",
  vaultId:
    process.env.NEXT_PUBLIC_VAULT_ID ||
    "0x14e0ef423ca0d50e0b47b0b225ad3fd510cc2ca2ce6cafc7d4bcabf25596c391",
  managerId:
    process.env.NEXT_PUBLIC_VAULT_MANAGER_ID ||
    "0x0de4ed88b9c7e7c2fe60b9cb064c45580884389f1cc800f31584366856aa1711",

  // Public indexer
  serverBaseUrl:
    process.env.NEXT_PUBLIC_PREDICT_SERVER_URL ||
    "https://predict-server.testnet.mystenlabs.com",

  // dUSDC has 6 decimals; Predict prices/probabilities use 1e9 fixed-point.
  quoteDecimals: 6,
  floatScaling: 1_000_000_000,

  clockId: "0x6",
} as const;

export const SHARE_TYPE = `${predictConfig.vaultPackageId}::vault_share::VAULT_SHARE`;
export const PLP_TYPE = `${predictConfig.predictPackageId}::plp::PLP`;

/** dUSDC human <-> base unit helpers (6 decimals). */
export function toQuoteBase(amount: number): bigint {
  return BigInt(Math.floor(amount * 10 ** predictConfig.quoteDecimals));
}
export function fromQuoteBase(base: bigint | number | string): number {
  return Number(base) / 10 ** predictConfig.quoteDecimals;
}

/** Strikes / prices are scaled by 1e9 on-chain. */
export function fromPriceScaled(v: bigint | number | string): number {
  return Number(v) / predictConfig.floatScaling;
}
export function toPriceScaled(v: number): bigint {
  return BigInt(Math.round(v * predictConfig.floatScaling));
}
