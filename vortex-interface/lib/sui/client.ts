import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { env } from "@/lib/config";

export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

const clientCache: Map<SuiNetwork, SuiJsonRpcClient> = new Map();

export function getSuiClient(network?: SuiNetwork): SuiJsonRpcClient {
  const targetNetwork = (network || env.sui.network) as SuiNetwork;
  
  if (clientCache.has(targetNetwork)) {
    return clientCache.get(targetNetwork)!;
  }

  const rpcUrl = env.sui.rpcUrl || getJsonRpcFullnodeUrl(targetNetwork);
  const client = new SuiJsonRpcClient({ 
    url: rpcUrl,
    network: targetNetwork,
  });
  
  clientCache.set(targetNetwork, client);
  return client;
}

export async function getBalance(address: string, coinType?: string): Promise<bigint> {
  const client = getSuiClient();
  const balance = await client.getBalance({
    owner: address,
    coinType: coinType || "0x2::sui::SUI",
  });
  return BigInt(balance.totalBalance);
}

export async function getSuiBalance(address: string): Promise<number> {
  const balanceRaw = await getBalance(address);
  return Number(balanceRaw) / 1_000_000_000;
}

export async function getOwnedObjects(
  address: string,
  options?: {
    filter?: { StructType: string };
    limit?: number;
  }
): Promise<unknown[]> {
  const client = getSuiClient();
  const result = await client.getOwnedObjects({
    owner: address,
    filter: options?.filter,
    options: {
      showContent: true,
      showType: true,
    },
    limit: options?.limit || 50,
  });
  return result.data;
}

export async function getObject(objectId: string) {
  const client = getSuiClient();
  return client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showType: true,
      showOwner: true,
    },
  });
}

export { SuiJsonRpcClient, getJsonRpcFullnodeUrl };
