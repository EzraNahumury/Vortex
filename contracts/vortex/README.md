# Equinox Protocol Smart Contracts

This directory contains the Move smart contracts for the Equinox Protocol, a multi-collateral lending platform on Sui with DeepBook integration.

## Deployment Information (Testnet)

| Object Name              | Description                    | Object ID                                                            |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| **Package ID**           | Main contract package          | `0x60db99c5af7bea80b5ff36922cf73964688923449e59347457be8e6e20e4c13a` |
| **Registry**             | Central configuration registry | `0xa62c9a091b001bb7e76fb416c8a87e426e468bca4d05a01f8c0418d4b762b741` |
| **Legacy Vesting Vault** | Vault for legacy SUI locking   | `0x50b306dc4d0301582fb13d11d7e09ad8de1bae7f23b89e72ab3664b63561c65f` |
| **AdminCap**             | Administrative capability      | `0xcf32ca8ac67d54a10f3d68338e9ee6db6e9dc3c068f9737a34ec3b5672c2e8ae` |
| **Publisher**            | Package publisher object       | `0x9d303dcc1a9075e85255b33b530184ac81031bd9b7d03cb5df688d1b4ab6dae1` |
| **UpgradeCap**           | Capability to upgrade package  | `0xbe3bfc862989b3502c16ea3c897ddb9374a88ca7df4a944a4bf5437687415e0b` |

### Transaction Details

- **Transaction Digest**: `6h3LkBB1sFm6mooFpcYmkiPb54oYiphDcF1aPQR1zPFf`
- **Sender**: `0x5d160e661324a35683964b3d45448eefe2b91054b3c6ea872cb7da32a0dec7c3`
- **Network**: Sui Testnet
- **Deployed At**: 2026-02-08

## Modules

1. **`registry`**: Central hub for protocol configuration, supported assets, and markets.
2. **`market`**: Core lending logic with order book, ZK-hidden orders, and DeepBook integration.
3. **`loan`**: Defines the Loan object and repayment logic.
4. **`vesting`**: Manages collateralized vesting positions.
5. **`mock_usdc`**: Mock USDC for testing.
6. **`mock_eth`**: Mock ETH for testing.
7. **`setup`**: Package initialization and Display setup.

## Development

### Build

Use the provided Docker-based build script:

```bash
./build.sh
```

### Test

Run the comprehensive test suite:

```bash
./test.sh
```

### Deploy

Deploy to testnet (requires ~/.sui configuration):

```bash
./deploy.sh [gas_budget]
```
