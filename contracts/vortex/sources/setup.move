module vortex::setup {
    use sui::package;
    use sui::display;
    use vortex::loan::{Loan};
    use vortex::vesting::{VestingPosition};

    /// One-Time-Witness for the package
    public struct SETUP has drop {}

    fun init(otw: SETUP, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        // 1. Setup Display for Loan (generic with SUI/SUI as example)
        let keys = vector[
            b"name".to_string(),
            b"description".to_string(),
            b"image_url".to_string(),
            b"project_url".to_string(),
        ];
        let values = vector[
            b"Vortex Loan".to_string(),
            b"A lending position in the Vortex Protocol - Multi-collateral DeFi lending with DeepBook orderbook".to_string(),
            b"https://raw.githubusercontent.com/EzraNahumury/Vortex/refs/heads/main/vortex-interface/public/logo/Vortex.png".to_string(),
            b"https://vortex-fi.vercel.app".to_string(),
        ];
        let mut display = display::new_with_fields<Loan<sui::sui::SUI, sui::sui::SUI>>(
            &publisher, keys, values, ctx
        );
        display::update_version(&mut display);
        transfer::public_transfer(display, tx_context::sender(ctx));

        // 2. Setup Display for VestingPosition
        let keys_v = vector[
            b"name".to_string(),
            b"description".to_string(),
            b"image_url".to_string(),
            b"project_url".to_string(),
        ];
        let values_v = vector[
            b"Vortex Vested Position".to_string(),
            b"Locked tokens earning rewards - Use as collateral for priority lending".to_string(),
            b"https://raw.githubusercontent.com/EzraNahumury/Vortex/refs/heads/main/vortex-interface/public/logo/Vortex.png".to_string(),
            b"https://vortex-fi.vercel.app".to_string(),
        ];
        let mut display_v = display::new_with_fields<VestingPosition>(
            &publisher, keys_v, values_v, ctx
        );
        display::update_version(&mut display_v);
        transfer::public_transfer(display_v, tx_context::sender(ctx));

        transfer::public_transfer(publisher, tx_context::sender(ctx));
    }
}
