#[allow(lint(public_entry), unused_variable, unused_mut_parameter, lint(self_transfer))]
/// Mock USDC Module for Vortex MVP
/// Provides USDC (stablecoin) mock token for testing
module vortex::mock_usdc {
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::url;

    // ============== MOCK USDC ==============
    /// One-Time-Witness for USDC
    public struct MOCK_USDC has drop {}

    /// USDC Faucet capability (shared object)
    public struct USDCAdminCap has key, store {
        id: UID,
        treasury: TreasuryCap<MOCK_USDC>,
    }

    // ============== CONSTANTS ==============
    const USDC_DECIMALS: u8 = 6;  // Standard USDC decimals

    // ============== INIT ==============
    fun init(witness: MOCK_USDC, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            USDC_DECIMALS,
            b"USDC",
            b"USD Coin (Mock)",
            b"Mock USDC for Vortex testnet - 6 decimals",
            option::some(url::new_unsafe_from_bytes(
                b"https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdc.png/public"
            )),
            ctx
        );
        
        transfer::public_freeze_object(metadata);
        
        let admin = USDCAdminCap {
            id: object::new(ctx),
            treasury,
        };
        // Share the object so anyone can mint (Public Faucet)
        transfer::share_object(admin);
    }

    // ============== USDC FUNCTIONS ==============
    /// Public faucet for USDC
    public entry fun faucet(
        cap: &mut USDCAdminCap,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(&mut cap.treasury, amount, ctx);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    /// Mint USDC to recipient (Admin)
    public entry fun mint(
        admin: &mut USDCAdminCap,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(&mut admin.treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Mint USDC and return the coin (for composability)
    public fun mint_coin(
        admin: &mut USDCAdminCap,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<MOCK_USDC> {
        coin::mint(&mut admin.treasury, amount, ctx)
    }

    // ============== HELPER FUNCTIONS ==============
    /// Get USDC amount from human-readable format (e.g., 100 USDC = 100_000000)
    public fun amount(amount: u64): u64 {
        amount * 1_000_000 // 6 decimals
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(MOCK_USDC {}, ctx);
    }

    #[test_only]
    public fun get_witness(): MOCK_USDC {
        MOCK_USDC {}
    }
}
