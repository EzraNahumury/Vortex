
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";
import * as fs from "fs";
import * as path from "path";

// Helper to load env vars manually
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, "utf8");
    const env: Record<string, string> = {};
    content.split("\n").forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, ""); // Remove quotes
      }
    });
    return env;
  } catch (e) {
    return {};
  }
}

const env = loadEnv();
const PACKAGE_ID = env.NEXT_PUBLIC_PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID;
const MNEMONIC = env.DEPLOYER_MNEMONIC || env.MNEMONIC || process.env.DEPLOYER_MNEMONIC || process.env.MNEMONIC;

if (!PACKAGE_ID) {
  console.error("Error: NEXT_PUBLIC_PACKAGE_ID not found in .env.local");
  process.exit(1);
}

if (!MNEMONIC) {
  // Try to generate a random keypair if no mnemonic is provided
  // But warn the user that they need to fund this address
  console.warn("⚠️  WARNING: No DEPLOYER_MNEMONIC found in .env.local");
  console.warn("Generating a random keypair. You must fund this address on Testnet manually!");
}

async function main() {
  console.log("🚀 Initializing Virtual Nautilus Enclave (SDK Mode)...");
  
  // 1. Setup Client and Signer
  const client = new SuiJsonRpcClient({ 
    url: getJsonRpcFullnodeUrl("testnet"),
    network: "testnet" as any
  });
  
  // Create keypair from mnemonic or generate new one
  let keypair: Ed25519Keypair;
  if (MNEMONIC) {
    try {
      keypair = Ed25519Keypair.deriveKeypair(MNEMONIC);
    } catch (e) {
      console.error("Failed to derive keypair from mnemonic:", e);
      // Fallback
      keypair = new Ed25519Keypair();
    }
  } else {
    keypair = new Ed25519Keypair();
  }
  
  const address = keypair.toSuiAddress();
  
  console.log(`📦 Using Wallet: ${address}`);
  console.log(`📦 Target Package: ${PACKAGE_ID}`);

  // Check balance
  try {
    const balance = await client.getBalance({ owner: address });
    console.log(`💰 Balance: ${Number(balance.totalBalance) / 1e9} SUI`);
    
    if (Number(balance.totalBalance) < 50000000) {
      console.error("❌ Insufficient balance! Please fund this address using the faucet.");
      console.log(`   Address: ${address}`);
      process.exit(1);
    }
  } catch (e) {
    console.warn("⚠️  Could not fetch balance. Assuming configured correctly...");
  }

  // 2. Generate new Enclave Keypair
  const enclaveKeypair = new Ed25519Keypair();
  // IMPORTANT: Use RAW 32-byte public key for on-chain verification (remove 1-byte flag from toSuiBytes)
  const fullPublicKey = enclaveKeypair.getPublicKey().toSuiBytes();
  const enclavePublicKey = Array.from(fullPublicKey.slice(1)); 
  
  if (enclavePublicKey.length !== 32) {
      throw new Error(`Invalid Public Key Length: ${enclavePublicKey.length}. Expected 32.`);
  }

  // Handle secret key return type
  const secret = enclaveKeypair.getSecretKey();
  const enclavePrivateKey = typeof secret === 'string' ? secret : toHex(secret);

  console.log("\n🔑 Generated New Enclave Keypair:");
  console.log(`   Public Key (Hex - 32 bytes): ${toHex(new Uint8Array(enclavePublicKey))}`);
  console.log(`   Private Key: ${enclavePrivateKey}`);
  
  // 3. Register Enclave on Chain
  console.log("\n📝 Registering Enclave on-chain...");
  
  // 3. Register Enclave Config
  console.log("\n📝 Registering Enclave Config first...");
  
  const tx1 = new Transaction();
  const dummyPcr = Array(32).fill(0);
  
  tx1.moveCall({
    target: `${PACKAGE_ID}::market::register_enclave_config`,
    arguments: [
      tx1.pure.vector("u8", dummyPcr),
      tx1.pure.vector("u8", dummyPcr),
      tx1.pure.vector("u8", dummyPcr),
      tx1.pure.u64(1), // version
    ],
  });

  let configId: string;
  try {
    const result1 = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx1,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    if (result1.effects?.status.status !== "success") {
      throw new Error(`Config Transaction failed: ${result1.effects?.status.error}`);
    }
    
    // Find created Config ID
    const createdConfig = result1.objectChanges?.find(
      (c: any) => c.type === "created" && c.objectType.includes("::market::EnclaveConfig")
    );

    if (!createdConfig || !("objectId" in createdConfig)) {
      throw new Error("Could not find created EnclaveConfig object");
    }
    configId = createdConfig.objectId;
    console.log(`✅ Enclave Config Registered: ${configId}`);

  } catch (error) {
    console.error("❌ Config Registration failed:", error);
    process.exit(1);
  }

  // 4. Register Enclave Instance
  console.log(`\n📝 Registering Enclave Instance with Config ID: ${configId}`);
  
  // Wait a bit for indexing
  await new Promise(r => setTimeout(r, 2000));
  
  // Fetch the object to ensure it exists and get version if needed
  const configObj = await client.getObject({ id: configId, options: { showOwner: true } });
  if (configObj.error) {
     throw new Error(`Could not fetch created Config object: ${configObj.error}`);
  }
  
  const tx2 = new Transaction();

  if (!configId) {
    throw new Error("Config ID is missing before registering enclave instance");
  }

  tx2.moveCall({
    target: `${PACKAGE_ID}::market::register_enclave`,
    arguments: [
      tx2.object(configId),
      tx2.pure.vector("u8", enclavePublicKey),
      tx2.object("0x6"), // Clock
    ],
  });

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx2,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });
    
    if (result.effects?.status.status !== "success") {
      throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }

    console.log("✅ Enclave Registered Successfully!");
    
    // Find created Enclave ID
    const createdObjects = result.objectChanges?.filter(
      (c: any) => c.type === "created" && c.objectType.includes("::market::RegisteredEnclave")
    ) as any[];

    if (!createdObjects || createdObjects.length === 0) {
      throw new Error("Could not find created Enclave object");
    }

    const enclaveId = createdObjects[0].objectId;
    console.log(`\n🎉 ENCLAVE ID: ${enclaveId}`);
    
    // Update .env file
    console.log("\n💾 Updating .env.local...");
    const envPath = path.resolve(process.cwd(), ".env.local");
    let envContent = fs.readFileSync(envPath, "utf8");
    
    // Helper to update or append env var
    const updateEnv = (key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    };
    
    updateEnv("NEXT_PUBLIC_NAUTILUS_ENCLAVE_ID", enclaveId);
    updateEnv("NEXT_PUBLIC_NAUTILUS_DEV_PRIVATE_KEY", enclavePrivateKey);
    
    fs.writeFileSync(envPath, envContent);
    console.log("✅ .env.local updated automatically!");
    console.log("👉 Please restart your frontend server to apply changes.");

  } catch (error) {
    console.error("❌ Registration failed:", error);
    process.exit(1);
  }
}

main();
