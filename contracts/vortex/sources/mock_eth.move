#[allow(lint(public_entry), unused_variable, unused_mut_parameter, lint(self_transfer))]
/// Mock ETH Module for Vortex MVP
/// Provides ETH (wrapped ETH) mock token for testing
module vortex::mock_eth {
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::url;

    // ============== MOCK ETH ==============
    /// One-Time-Witness for ETH
    public struct MOCK_ETH has drop {}

    /// ETH Faucet capability (shared object)
    public struct ETHAdminCap has key, store {
        id: UID,
        treasury: TreasuryCap<MOCK_ETH>,
    }

    // ============== CONSTANTS ==============
    const ETH_DECIMALS: u8 = 8;   // 8 decimals for wrapped ETH

    // ============== INIT ==============
    fun init(witness: MOCK_ETH, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            ETH_DECIMALS,
            b"ETH",
            b"Wrapped Ether (Mock)",
            b"Mock wETH for Vortex testnet - 8 decimals",
            option::some(url::new_unsafe_from_bytes(
                b"https://cryptologos.cc/logos/ethereum-eth-logo.png"
            )),
            ctx
        );
        
        transfer::public_freeze_object(metadata);
        
        let admin = ETHAdminCap {
            id: object::new(ctx),
            treasury,
        };
        // Share the object so anyone can mint (Public Faucet)
        transfer::share_object(admin);
    }

    // ============== ETH FUNCTIONS ==============
    /// Public faucet for ETH
    public entry fun faucet(
        cap: &mut ETHAdminCap,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(&mut cap.treasury, amount, ctx);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    /// Mint ETH to recipient (Admin)
    public entry fun mint(
        admin: &mut ETHAdminCap,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(&mut admin.treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Mint ETH and return the coin (for composability)
    public fun mint_coin(
        admin: &mut ETHAdminCap,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<MOCK_ETH> {
        coin::mint(&mut admin.treasury, amount, ctx)
    }

    // ============== HELPER FUNCTIONS ==============
    /// Get ETH amount from human-readable format (e.g., 1 ETH = 1_00000000)
    public fun amount(amount: u64): u64 {
        amount * 100_000_000 // 8 decimals
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(MOCK_ETH {}, ctx);
    }

    #[test_only]
    public fun get_witness(): MOCK_ETH {
        MOCK_ETH {}
    }
}
