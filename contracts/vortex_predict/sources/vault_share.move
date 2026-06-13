/// Tokenized share for the Vortex PLP+Hedge vault.
///
/// `VAULT_SHARE` is a fungible coin minted 1:1 with dUSDC deposited into the vault and
/// burned on withdrawal. Because it is a standard `Coin`, a depositor's vault position is
/// portable across the wider Sui DeFi ecosystem — it can be used as margin collateral,
/// supplied to other LPs, or composed into structured products, exactly as the DeepBook
/// Predict track encourages ("build tokenized share tokens on top of PredictManager").
#[allow(deprecated_usage)]
module vortex_predict::vault_share {
    use sui::coin;

    /// One-Time-Witness for the share currency.
    public struct VAULT_SHARE has drop {}

    /// Register the share currency at publish and hand the `TreasuryCap` to the publisher,
    /// who passes it into `vault::create_vault` so the vault owns mint/burn rights.
    fun init(witness: VAULT_SHARE, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            6, // match dUSDC decimals so 1 share == 1 dUSDC at par
            b"VPV",
            b"Vortex Predict Vault",
            b"Tokenized share of the Vortex PLP+Hedge vault on DeepBook Predict",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, tx_context::sender(ctx));
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(VAULT_SHARE {}, ctx);
    }
}
