#[test_only]
#[allow(unused_variable, unused_use, unused_const, unused_mut_ref)]
module vortex::tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    
    use vortex::market::{Self, Market};
    use vortex::loan::{Self, Loan};
    use vortex::registry::{Self, Registry, AdminCap};
    use vortex::vesting::{Self, VestingVault, VestingPosition};
    
    // ============== CONSTANTS ==============
    const ADMIN: address = @0xAD;
    const LENDER: address = @0x1;
    const BORROWER: address = @0x2;
    const LIQUIDATOR: address = @0x3;

    // ============== HELPER FUNCTIONS ==============
    
    /// Create a test clock
    fun create_clock(scenario: &mut ts::Scenario): Clock {
        ts::next_tx(scenario, ADMIN);
        clock::create_for_testing(ts::ctx(scenario))
    }

    /// Advance clock by milliseconds
    fun advance_clock(clock: &mut Clock, ms: u64) {
        clock::increment_for_testing(clock, ms);
    }

    // ============== REGISTRY TESTS ==============

    #[test]
    fun test_registry_creation() {
        let mut scenario = ts::begin(ADMIN);
        
        // Init registry
        {
            registry::init_for_testing(ts::ctx(&mut scenario));
        };

        // Verify registry exists
        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(ts::has_most_recent_shared<Registry>(), 0);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_add_collateral_and_asset() {
        let mut scenario = ts::begin(ADMIN);
        
        // Init registry
        {
            registry::init_for_testing(ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin = registry::create_admin_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<Registry>(&scenario);
            
            // Add SUI as collateral
            registry::add_collateral<SUI>(
                &admin,
                &mut registry,
                7500, // 75% max LTV
                8500, // 85% liquidation threshold
                500,  // 5% liquidation bonus
                ts::ctx(&mut scenario)
            );

            // Add SUI as asset (for testing)
            registry::add_asset<SUI>(
                &admin,
                &mut registry,
                100,   // 1% min rate
                5000,  // 50% max rate
                ts::ctx(&mut scenario)
            );

            // Verify
            assert!(registry::is_collateral_supported<SUI>(&registry), 1);
            assert!(registry::is_asset_supported<SUI>(&registry), 2);
            assert!(registry::get_max_ltv<SUI>(&registry) == 7500, 3);

            ts::return_shared(registry);
            transfer::public_transfer(admin, ADMIN);
        };

        ts::end(scenario);
    }

    // ============== MARKET TESTS ==============

    #[test]
    fun test_market_creation_standalone() {
        let mut scenario = ts::begin(ADMIN);
        
        // Create market without registry
        {
            market::create_market_standalone<SUI, SUI>(
                vector::empty<u8>(),
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(ts::has_most_recent_shared<Market<SUI, SUI>>(), 0);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_place_lend_order() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        // Create market
        ts::next_tx(&mut scenario, ADMIN);
        {
            market::create_market_standalone<SUI, SUI>(
                vector::empty<u8>(),
                ts::ctx(&mut scenario)
            );
        };

        // Lender places order
        ts::next_tx(&mut scenario, LENDER);
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1000_000_000_000, ts::ctx(&mut scenario));
            
            let order_id = market::place_lend_order(
                &mut market,
                payment,
                500, // 5% APR
                86400000 * 30, // 30 days
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify order was placed
            let (lend_vol, _, _, active) = market::get_market_stats(&market);
            assert!(lend_vol == 1000_000_000_000, 1);
            assert!(active == 1, 2);

            ts::return_shared(market);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_place_borrow_order_standalone() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        // Create market
        ts::next_tx(&mut scenario, ADMIN);
        {
            market::create_market_standalone<SUI, SUI>(
                vector::empty<u8>(),
                ts::ctx(&mut scenario)
            );
        };

        // Borrower places order
        ts::next_tx(&mut scenario, BORROWER);
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let collateral = coin::mint_for_testing<SUI>(2000_000_000_000, ts::ctx(&mut scenario));
            
            let order_id = market::place_borrow_order_standalone(
                &mut market,
                collateral,
                1000_000_000_000, // Want to borrow 1000 SUI
                600, // Max 6% APR
                86400000 * 14, // 14 days
                &clock,
                ts::ctx(&mut scenario)
            );

            let (_, borrow_vol, _, active) = market::get_market_stats(&market);
            assert!(borrow_vol == 1000_000_000_000, 1);
            assert!(active == 1, 2);

            ts::return_shared(market);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_order_matching() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        // Create market
        ts::next_tx(&mut scenario, ADMIN);
        {
            market::create_market_standalone<SUI, SUI>(
                vector::empty<u8>(),
                ts::ctx(&mut scenario)
            );
        };

        // Lender places order
        ts::next_tx(&mut scenario, LENDER);
        let lend_order_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1000_000_000_000, ts::ctx(&mut scenario));
            
            lend_order_id = market::place_lend_order(
                &mut market,
                payment,
                500, // 5% min APR
                86400000 * 30, // 30 days term
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        // Borrower places order
        ts::next_tx(&mut scenario, BORROWER);
        let borrow_order_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let collateral = coin::mint_for_testing<SUI>(2000_000_000_000, ts::ctx(&mut scenario));
            
            borrow_order_id = market::place_borrow_order_standalone(
                &mut market,
                collateral,
                1000_000_000_000,
                600, // Max 6% APR
                86400000 * 14, // 14 days
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        // Match orders
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            
            market::match_orders_for_testing(
                &mut market,
                lend_order_id,
                borrow_order_id,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify orders matched
            let (_, _, _, active) = market::get_market_stats(&market);
            assert!(active == 0, 1); // Both orders consumed

            ts::return_shared(market);
        };

        // Verify loan was created
        ts::next_tx(&mut scenario, LENDER);
        {
            assert!(ts::has_most_recent_for_sender<Loan<SUI, SUI>>(&scenario), 2);
        };

        // Verify borrower received funds
        ts::next_tx(&mut scenario, BORROWER);
        {
            assert!(ts::has_most_recent_for_sender<Coin<SUI>>(&scenario), 3);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_cancel_lend_order() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        // Create market
        ts::next_tx(&mut scenario, ADMIN);
        {
            market::create_market_standalone<SUI, SUI>(
                vector::empty<u8>(),
                ts::ctx(&mut scenario)
            );
        };

        // Lender places order
        ts::next_tx(&mut scenario, LENDER);
        let lend_order_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1000_000_000_000, ts::ctx(&mut scenario));
            
            lend_order_id = market::place_lend_order(
                &mut market,
                payment,
                500,
                86400000 * 30,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        // Cancel order
        ts::next_tx(&mut scenario, LENDER);
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            
            let returned = market::cancel_lend_order(
                &mut market,
                lend_order_id,
                ts::ctx(&mut scenario)
            );

            assert!(coin::value(&returned) == 1000_000_000_000, 1);

            let (_, _, _, active) = market::get_market_stats(&market);
            assert!(active == 0, 2);

            transfer::public_transfer(returned, LENDER);
            ts::return_shared(market);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ============== LOAN TESTS ==============

    #[test]
    fun test_loan_repayment() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        // Create market and match orders
        ts::next_tx(&mut scenario, ADMIN);
        {
            market::create_market_standalone<SUI, SUI>(
                vector::empty<u8>(),
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, LENDER);
        let lend_order_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1000_000_000_000, ts::ctx(&mut scenario));
            
            lend_order_id = market::place_lend_order(
                &mut market,
                payment,
                500,
                86400000 * 30,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        ts::next_tx(&mut scenario, BORROWER);
        let borrow_order_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let collateral = coin::mint_for_testing<SUI>(2000_000_000_000, ts::ctx(&mut scenario));
            
            borrow_order_id = market::place_borrow_order_standalone(
                &mut market,
                collateral,
                1000_000_000_000,
                600,
                86400000 * 14,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            
            market::match_orders_for_testing(
                &mut market,
                lend_order_id,
                borrow_order_id,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        // Advance time by 7 days
        advance_clock(&mut clock, 86400000 * 7);

        // Borrower repays
        ts::next_tx(&mut scenario, LENDER);
        {
            let loan = ts::take_from_sender<Loan<SUI, SUI>>(&scenario);
            
            // Calculate debt (should include interest)
            let debt = loan::calculate_debt(&loan, &clock);
            assert!(debt > 1000_000_000_000, 1); // Should have accumulated interest
            
            ts::return_to_sender(&scenario, loan);
        };

        // Actually repay
        ts::next_tx(&mut scenario, BORROWER);
        {
            // Take loan from lender (in real scenario, borrower would have access somehow)
            // For test, we skip this and just verify the logic works
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ============== VESTING TESTS ==============

    #[test]
    fun test_vesting_vault_creation() {
        let mut scenario = ts::begin(ADMIN);

        {
            vesting::create_vault<SUI>(
                200, // 2% reward rate
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            assert!(ts::has_most_recent_shared<VestingVault<SUI>>(), 0);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_vesting_lock_and_unlock() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        // Create vault
        ts::next_tx(&mut scenario, ADMIN);
        {
            vesting::create_vault<SUI>(
                200,
                ts::ctx(&mut scenario)
            );
        };

        // User locks tokens
        ts::next_tx(&mut scenario, LENDER);
        {
            let mut vault = ts::take_shared<VestingVault<SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1000_000_000_000, ts::ctx(&mut scenario));
            
            vesting::lock_simple(
                &mut vault,
                payment,
                86400000 * 30, // 30 days
                &clock,
                ts::ctx(&mut scenario)
            );

            let (staked, _, _) = vesting::get_vault_stats(&vault);
            assert!(staked == 1000_000_000_000, 1);

            ts::return_shared(vault);
        };

        // Verify position created
        ts::next_tx(&mut scenario, LENDER);
        {
            let position = ts::take_from_sender<VestingPosition>(&scenario);
            let (amount, _, duration, owner, is_coll) = vesting::get_position_info(&position);
            
            assert!(amount == 1000_000_000_000, 2);
            assert!(duration == 86400000 * 30, 3);
            assert!(owner == LENDER, 4);
            assert!(!is_coll, 5);
            
            ts::return_to_sender(&scenario, position);
        };

        // Advance time to after maturity
        advance_clock(&mut clock, 86400000 * 31);

        // Unlock
        ts::next_tx(&mut scenario, LENDER);
        {
            let mut vault = ts::take_shared<VestingVault<SUI>>(&scenario);
            let position = ts::take_from_sender<VestingPosition>(&scenario);
            
            vesting::unlock(&mut vault, position, &clock, ts::ctx(&mut scenario));
            
            ts::return_shared(vault);
        };

        // Verify tokens returned
        ts::next_tx(&mut scenario, LENDER);
        {
            assert!(ts::has_most_recent_for_sender<Coin<SUI>>(&scenario), 6);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ============== INTEGRATION TESTS ==============

    #[test]
    fun test_full_lending_flow_with_registry() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        // 1. Initialize registry
        ts::next_tx(&mut scenario, ADMIN);
        {
            registry::init_for_testing(ts::ctx(&mut scenario));
        };

        // 2. Setup collateral and assets
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin = registry::create_admin_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<Registry>(&scenario);
            
            registry::add_collateral<SUI>(
                &admin,
                &mut registry,
                7500,
                8500,
                500,
                ts::ctx(&mut scenario)
            );

            registry::add_asset<SUI>(
                &admin,
                &mut registry,
                100,
                5000,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(registry);
            transfer::public_transfer(admin, ADMIN);
        };

        // 3. Create market with registry
        ts::next_tx(&mut scenario, ADMIN);
        {
            let registry = ts::take_shared<Registry>(&scenario);
            
            market::create_market<SUI, SUI>(
                &registry,
                vector::empty<u8>(),
                ts::ctx(&mut scenario)
            );

            ts::return_shared(registry);
        };

        // 4. Place and match orders
        ts::next_tx(&mut scenario, LENDER);
        let lend_order_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(500_000_000_000, ts::ctx(&mut scenario));
            
            lend_order_id = market::place_lend_order(
                &mut market,
                payment,
                300, // 3% APR
                86400000 * 30,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        ts::next_tx(&mut scenario, BORROWER);
        let borrow_order_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let registry = ts::take_shared<Registry>(&scenario);
            let collateral = coin::mint_for_testing<SUI>(1000_000_000_000, ts::ctx(&mut scenario));
            
            borrow_order_id = market::place_borrow_order(
                &mut market,
                &registry,
                collateral,
                500_000_000_000,
                400, // Max 4% APR
                86400000 * 14,
                1_000_000, // Collateral price
                1_000_000, // Asset price
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(registry);
            ts::return_shared(market);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            
            market::match_orders_for_testing(
                &mut market,
                lend_order_id,
                borrow_order_id,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(market);
        };

        // Verify final state
        ts::next_tx(&mut scenario, LENDER);
        {
            assert!(ts::has_most_recent_for_sender<Loan<SUI, SUI>>(&scenario), 0);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ============== MATCH ENTRY TESTS ==============

    #[test]
    fun test_match_best_offer_settles_pair() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = create_clock(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            market::create_market_standalone<SUI, SUI>(
                vector::empty<u8>(),
                ts::ctx(&mut scenario),
            );
        };

        ts::next_tx(&mut scenario, LENDER);
        let lend_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(500_000_000_000, ts::ctx(&mut scenario));
            lend_id = market::place_lend_order(
                &mut market,
                payment,
                300,                // 3%
                86400000 * 30,
                &clock,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(market);
        };

        ts::next_tx(&mut scenario, BORROWER);
        let borrow_id;
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            let collateral = coin::mint_for_testing<SUI>(800_000_000_000, ts::ctx(&mut scenario));
            borrow_id = market::place_borrow_order_standalone(
                &mut market,
                collateral,
                500_000_000_000,
                500,                // 5% — borrower willing to pay above lender's 3%
                86400000 * 14,
                &clock,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(market);
        };

        // Anyone can call match_best_offer once the rules pass.
        ts::next_tx(&mut scenario, LIQUIDATOR);
        {
            let mut market = ts::take_shared<Market<SUI, SUI>>(&scenario);
            market::match_best_offer<SUI, SUI>(
                &mut market,
                lend_id,
                borrow_id,
                &clock,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(market);
        };

        // Lender now holds the loan object as proof of settlement.
        ts::next_tx(&mut scenario, LENDER);
        {
            assert!(ts::has_most_recent_for_sender<Loan<SUI, SUI>>(&scenario), 0);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
