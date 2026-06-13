#[allow(lint(public_entry), unused_const, duplicate_alias, deprecated_usage, unused_use)]
/// Market Module for Vortex Protocol
/// Implements Dynamic Order Book Matching with multi-collateral support
/// Integrates with DeepBook V3 for liquidation routing and price discovery
module vortex::market {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::ed25519;
    use std::option;
    use deepbook::pool::{Self as db_pool, Pool};
    use deepbook::balance_manager::{Self, BalanceManager, TradeProof};
    use token::deep::DEEP;
    
    use vortex::loan::{Self};
    use vortex::registry::{Self, Registry};
    use vortex::vesting::{Self, VestingPosition};

    // ============== ERROR CODES ==============
    const EOrderNotFound: u64 = 0;
    const ERateMismatch: u64 = 1;
    const EAmountMismatch: u64 = 2;
    const EDurationMismatch: u64 = 3;
    const EInvalidFairnessProof: u64 = 4;
    const EInsufficientLiquidation: u64 = 5;
    const EUnauthorizedBalanceManager: u64 = 6;
    const EInsufficientProfit: u64 = 7;
    const EInsufficientCollateral: u64 = 8;
    const ECollateralNotSupported: u64 = 9;
    const EAssetNotSupported: u64 = 10;
    const EExceedsMaxLTV: u64 = 11;
    const EMarketPaused: u64 = 12;
    const EUnauthorized: u64 = 13;
    const EInvalidPrice: u64 = 14;
    const EInvalidVestingPosition: u64 = 15;

    // ============== STRUCTS ==============

    /// Nautilus Enclave Configuration
    public struct EnclaveConfig has key, store {
        id: UID,
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        version: u64,
    }

    /// Registered Nautilus Enclave
    public struct RegisteredEnclave has key, store {
        id: UID,
        public_key: vector<u8>,
        config_version: u64,
        registered_at: u64,
        is_active: bool,
    }

    /// Represents an Order in the orderbook
    public struct Order has store, drop {
        creator: address,
        amount: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        is_lend: bool,
        created_at: u64,
        /// Price at order creation (for LTV calculation)
        collateral_price: u64,
        asset_price: u64,
    }

    /// Borrow order with vesting collateral (gets priority + subsidy)
    public struct VestedBorrowOrder has store, drop {
        creator: address,
        amount: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        vesting_position_id: ID,
        fairness_boost: u64,
        subsidy_rate_bps: u64,
        created_at: u64,
    }

    /// Represents a ZK-Hidden Order
    public struct HiddenOrder has store, drop {
        creator: address,
        commitment: vector<u8>,
        is_lend: bool,
        created_at: u64,
    }

    /// The Market shared object
    /// Supports multi-collateral lending via Registry
    /// Asset: The token being lent/borrowed (e.g. USDC)
    /// Collateral: The token used as collateral (e.g. SUI, ETH)
    public struct Market<phantom Asset, phantom Collateral> has key {
        id: UID,
        /// Normal limit orders
        orders: Table<ID, Order>,
        /// ZK-hidden orders
        hidden_orders: Table<ID, HiddenOrder>,
        /// Lender deposits indexed by order ID
        lend_balances: Table<ID, Balance<Asset>>,
        /// Borrower collateral indexed by order ID
        collateral_balances: Table<ID, Balance<Collateral>>,
        /// Deprecated: use enclave_id
        fairness_verifier: vector<u8>,
        /// Reference to RegisteredEnclave
        enclave_id: option::Option<ID>,
        /// Vesting collateral orders
        vested_orders: Table<ID, VestedBorrowOrder>,
        /// Track vested collateral usage
        total_vested_volume: u64,
        /// DeepBook Pool for liquidations
        deepbook_pool_id: option::Option<ID>,
        /// Market status
        is_active: bool,
        /// Total volume lent
        total_lend_volume: u64,
        /// Total volume borrowed
        total_borrow_volume: u64,
        /// Active orders count
        active_orders: u64,
    }

    // ============== EVENTS ==============

    public struct MarketCreated has copy, drop {
        market_id: ID,
        asset_type: std::ascii::String,
        collateral_type: std::ascii::String,
    }

    public struct OrderPlaced has copy, drop {
        order_id: ID,
        market_id: ID,
        is_lend: bool,
        amount: u64,
        rate: u64,
        duration: u64,
    }

    public struct OrderMatched has copy, drop {
        lend_order_id: ID,
        borrow_order_id: ID,
        amount: u64,
        duration: u64,
        final_rate: u64,
    }

    public struct OrderCancelled has copy, drop {
        order_id: ID,
        creator: address,
        is_lend: bool,
    }

    public struct LoanLiquidated has copy, drop {
        loan_id: ID,
        liquidator: address,
        collateral_sold: u64,
        asset_received: u64,
        debt_repaid: u64,
        profit: u64,
    }

    public struct HiddenOrderPlaced has copy, drop {
        order_id: ID,
        creator: address,
        is_lend: bool,
        amount: u64,
    }

    public struct EnclaveRegistered has copy, drop {
        enclave_id: ID,
        public_key: vector<u8>,
        config_version: u64,
    }

    public struct FairnessVerified has copy, drop {
        lend_order_id: ID,
        borrow_order_id: ID,
        fairness_score: u64,
        enclave_id: ID,
    }

    public struct VestedOrderPlaced has copy, drop {
        order_id: ID,
        creator: address,
        amount: u64,
        vesting_position_id: ID,
        fairness_boost: u64,
        subsidy_rate_bps: u64,
    }

    public struct DeepBookPoolSet has copy, drop {
        market_id: ID,
        pool_id: ID,
    }

    // ============== INIT ==============

    fun init(_ctx: &mut TxContext) {
    }

    // ============== MARKET CREATION ==============

    /// Create a new market pair with Registry validation
    public entry fun create_market<Asset, Collateral>(
        registry: &Registry,
        fairness_verifier: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Validate asset and collateral are supported
        assert!(registry::is_asset_supported<Asset>(registry), EAssetNotSupported);
        assert!(registry::is_collateral_supported<Collateral>(registry), ECollateralNotSupported);

        let market = Market<Asset, Collateral> {
            id: object::new(ctx),
            orders: table::new(ctx),
            hidden_orders: table::new(ctx),
            lend_balances: table::new(ctx),
            collateral_balances: table::new(ctx),
            fairness_verifier,
            enclave_id: option::none(),
            vested_orders: table::new(ctx),
            total_vested_volume: 0,
            deepbook_pool_id: option::none(),
            is_active: true,
            total_lend_volume: 0,
            total_borrow_volume: 0,
            active_orders: 0,
        };

        event::emit(MarketCreated {
            market_id: object::id(&market),
            asset_type: std::type_name::get<Asset>().into_string(),
            collateral_type: std::type_name::get<Collateral>().into_string(),
        });

        transfer::share_object(market);
    }

    /// Create market without registry (for testing/bootstrap)
    public entry fun create_market_standalone<Asset, Collateral>(
        fairness_verifier: vector<u8>,
        ctx: &mut TxContext
    ) {
        let market = Market<Asset, Collateral> {
            id: object::new(ctx),
            orders: table::new(ctx),
            hidden_orders: table::new(ctx),
            lend_balances: table::new(ctx),
            collateral_balances: table::new(ctx),
            fairness_verifier,
            enclave_id: option::none(),
            vested_orders: table::new(ctx),
            total_vested_volume: 0,
            deepbook_pool_id: option::none(),
            is_active: true,
            total_lend_volume: 0,
            total_borrow_volume: 0,
            active_orders: 0,
        };

        event::emit(MarketCreated {
            market_id: object::id(&market),
            asset_type: std::type_name::get<Asset>().into_string(),
            collateral_type: std::type_name::get<Collateral>().into_string(),
        });

        transfer::share_object(market);
    }

    // ============== ENCLAVE MANAGEMENT ==============

    /// Register Nautilus Enclave Configuration
    public entry fun register_enclave_config(
        pcr0: vector<u8>,
        pcr1: vector<u8>,
        pcr2: vector<u8>,
        version: u64,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&pcr0) == 32, 0);
        assert!(vector::length(&pcr1) == 32, 0);
        assert!(vector::length(&pcr2) == 32, 0);

        let config = EnclaveConfig {
            id: object::new(ctx),
            pcr0,
            pcr1,
            pcr2,
            version,
        };
        transfer::share_object(config);
    }

    /// Register Nautilus Enclave Instance
    public entry fun register_enclave(
        config: &EnclaveConfig,
        public_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let enclave = RegisteredEnclave {
            id: object::new(ctx),
            public_key,
            config_version: config.version,
            registered_at: clock::timestamp_ms(clock),
            is_active: true,
        };

        let enclave_id = object::id(&enclave);
        
        event::emit(EnclaveRegistered {
            enclave_id,
            public_key,
            config_version: config.version,
        });

        transfer::share_object(enclave);
    }

    /// Public accessor for the enclave's Ed25519 public key. Other modules (e.g. the
    /// aggregator vault) need this to verify signatures produced by the same enclave.
    public fun enclave_public_key(enclave: &RegisteredEnclave): vector<u8> {
        enclave.public_key
    }

    /// Link enclave to market
    public entry fun set_market_enclave<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        enclave: &RegisteredEnclave,
        _ctx: &mut TxContext
    ) {
        market.enclave_id = option::some(object::id(enclave));
    }

    // ============== DEEPBOOK INTEGRATION ==============

    /// Set DeepBook pool for liquidations
    public entry fun set_deepbook_pool<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        pool_id: ID,
        _ctx: &mut TxContext
    ) {
        market.deepbook_pool_id = option::some(pool_id);
        
        event::emit(DeepBookPoolSet {
            market_id: object::id(market),
            pool_id,
        });
    }

    // ============== ORDER PLACEMENT ==============

    /// Place a Lending Order with Custom Terms
    public fun place_lend_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        payment: Coin<Asset>,
        interest_rate_bps: u64,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        assert!(market.is_active, EMarketPaused);
        
        let amount = coin::value(&payment);
        
        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let order = Order {
            creator: tx_context::sender(ctx),
            amount,
            interest_rate_bps,
            duration_ms,
            is_lend: true,
            created_at: clock::timestamp_ms(clock),
            collateral_price: 0,
            asset_price: 0,
        };

        table::add(&mut market.orders, id, order);
        table::add(&mut market.lend_balances, id, coin::into_balance(payment));

        market.total_lend_volume = market.total_lend_volume + amount;
        market.active_orders = market.active_orders + 1;

        event::emit(OrderPlaced {
            order_id: id,
            market_id: object::id(market),
            is_lend: true,
            amount,
            rate: interest_rate_bps,
            duration: duration_ms,
        });

        id
    }

    /// Place a Borrow Order with Custom Terms and LTV validation
    public fun place_borrow_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        registry: &Registry,
        collateral: Coin<Collateral>,
        amount_requested: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        collateral_price: u64,
        asset_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        assert!(market.is_active, EMarketPaused);
        assert!(collateral_price > 0 && asset_price > 0, EInvalidPrice);

        // Validate LTV
        let collateral_amount = coin::value(&collateral);
        assert!(collateral_amount > 0, EInsufficientCollateral);
        let max_ltv = registry::get_max_ltv<Collateral>(registry);
        let collateral_value = (collateral_amount as u128) * (collateral_price as u128);
        assert!(collateral_value > 0, EInsufficientCollateral);
        let borrow_value = (amount_requested as u128) * (asset_price as u128);
        let current_ltv = borrow_value * 10000 / collateral_value;
        assert!(current_ltv <= (max_ltv as u128), EExceedsMaxLTV);

        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let order = Order {
            creator: tx_context::sender(ctx),
            amount: amount_requested,
            interest_rate_bps,
            duration_ms,
            is_lend: false,
            created_at: clock::timestamp_ms(clock),
            collateral_price,
            asset_price,
        };

        table::add(&mut market.orders, id, order);
        table::add(&mut market.collateral_balances, id, coin::into_balance(collateral));

        market.total_borrow_volume = market.total_borrow_volume + amount_requested;
        market.active_orders = market.active_orders + 1;

        event::emit(OrderPlaced {
            order_id: id,
            market_id: object::id(market),
            is_lend: false,
            amount: amount_requested,
            rate: interest_rate_bps,
            duration: duration_ms,
        });

        id
    }

    /// Place a Borrow Order without registry (for testing)
    public fun place_borrow_order_standalone<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        collateral: Coin<Collateral>,
        amount_requested: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        assert!(market.is_active, EMarketPaused);

        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let order = Order {
            creator: tx_context::sender(ctx),
            amount: amount_requested,
            interest_rate_bps,
            duration_ms,
            is_lend: false,
            created_at: clock::timestamp_ms(clock),
            collateral_price: 0,
            asset_price: 0,
        };

        table::add(&mut market.orders, id, order);
        table::add(&mut market.collateral_balances, id, coin::into_balance(collateral));

        market.total_borrow_volume = market.total_borrow_volume + amount_requested;
        market.active_orders = market.active_orders + 1;

        event::emit(OrderPlaced {
            order_id: id,
            market_id: object::id(market),
            is_lend: false,
            amount: amount_requested,
            rate: interest_rate_bps,
            duration: duration_ms,
        });

        id
    }

    /// Place Borrow Order with Vesting Collateral
    /// Requires reference to caller's VestingPosition to prove ownership and prevent
    /// free fairness boosts via fake position IDs.
    public fun place_vested_borrow_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        vesting_position: &VestingPosition,
        collateral: Coin<Collateral>,
        amount_requested: u64,
        interest_rate_bps: u64,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        assert!(market.is_active, EMarketPaused);

        // Authenticate vesting position ownership and unused state
        let (_, _, _, vp_owner, vp_collateralized) = vesting::get_position_info(vesting_position);
        assert!(vp_owner == tx_context::sender(ctx), EUnauthorized);
        assert!(!vp_collateralized, EInvalidVestingPosition);

        let vesting_position_id = object::id(vesting_position);

        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let fairness_boost = calculate_vesting_boost(amount_requested, duration_ms);
        let subsidy_rate_bps = calculate_subsidy_rate(duration_ms);

        let order = VestedBorrowOrder {
            creator: tx_context::sender(ctx),
            amount: amount_requested,
            interest_rate_bps,
            duration_ms,
            vesting_position_id,
            fairness_boost,
            subsidy_rate_bps,
            created_at: clock::timestamp_ms(clock),
        };

        table::add(&mut market.vested_orders, id, order);
        table::add(&mut market.collateral_balances, id, coin::into_balance(collateral));
        
        market.total_vested_volume = market.total_vested_volume + amount_requested;
        market.active_orders = market.active_orders + 1;

        event::emit(VestedOrderPlaced {
            order_id: id,
            creator: tx_context::sender(ctx),
            amount: amount_requested,
            vesting_position_id,
            fairness_boost,
            subsidy_rate_bps,
        });

        id
    }

    // ============== ORDER CANCELLATION ==============

    /// Cancel a lend order and return funds
    public fun cancel_lend_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        order_id: ID,
        ctx: &mut TxContext
    ): Coin<Asset> {
        assert!(table::contains(&market.orders, order_id), EOrderNotFound);
        
        let order = table::remove(&mut market.orders, order_id);
        assert!(order.is_lend, EOrderNotFound);
        assert!(order.creator == tx_context::sender(ctx), EUnauthorized);

        let balance = table::remove(&mut market.lend_balances, order_id);
        market.active_orders = market.active_orders - 1;

        event::emit(OrderCancelled {
            order_id,
            creator: order.creator,
            is_lend: true,
        });

        coin::from_balance(balance, ctx)
    }

    /// Cancel a borrow order and return collateral
    public fun cancel_borrow_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        order_id: ID,
        ctx: &mut TxContext
    ): Coin<Collateral> {
        assert!(table::contains(&market.orders, order_id), EOrderNotFound);
        
        let order = table::remove(&mut market.orders, order_id);
        assert!(!order.is_lend, EOrderNotFound);
        assert!(order.creator == tx_context::sender(ctx), EUnauthorized);

        let balance = table::remove(&mut market.collateral_balances, order_id);
        market.active_orders = market.active_orders - 1;

        event::emit(OrderCancelled {
            order_id,
            creator: order.creator,
            is_lend: false,
        });

        coin::from_balance(balance, ctx)
    }

    // ============== ZK HIDDEN ORDERS ==============

    /// Place a Hidden Lending Order (ZK-Privacy)
    public fun place_hidden_lend_order<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        payment: Coin<Asset>,
        commitment: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        assert!(market.is_active, EMarketPaused);
        
        let amount = coin::value(&payment);
        
        let uid = object::new(ctx);
        let id = object::uid_to_inner(&uid);
        object::delete(uid);

        let order = HiddenOrder {
            creator: tx_context::sender(ctx),
            commitment,
            is_lend: true,
            created_at: clock::timestamp_ms(clock),
        };

        table::add(&mut market.hidden_orders, id, order);
        table::add(&mut market.lend_balances, id, coin::into_balance(payment));

        event::emit(HiddenOrderPlaced {
            order_id: id,
            creator: tx_context::sender(ctx),
            is_lend: true,
            amount,
        });

        id
    }

    // ============== ORDER MATCHING ==============

    /// Calculate fairness boost for vested collateral
    fun calculate_vesting_boost(amount: u64, duration_ms: u64): u64 {
        let mut boost = 50;

        if (amount < 10000_000000) {
            boost = boost + 30;
        };

        let days = duration_ms / 86400000;
        if (days >= 30) {
            boost = boost + 20;
        };

        boost
    }

    /// Calculate subsidy rate for vested collateral
    fun calculate_subsidy_rate(duration_ms: u64): u64 {
        let days = duration_ms / 86400000;
        
        let mut subsidy = 200;
        
        if (days >= 90) {
            subsidy = 300;
        } else if (days >= 30) {
            subsidy = 250;
        };
        
        subsidy
    }

    /// Execute a match with AI Fairness Check
    public fun match_orders<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        enclave: &RegisteredEnclave,
        lend_order_id: ID,
        borrow_order_id: ID,
        fairness_score: u64,
        fairness_proof: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(enclave.is_active, EInvalidFairnessProof);
        if (option::is_some(&market.enclave_id)) {
            assert!(option::borrow(&market.enclave_id) == &object::id(enclave), EInvalidFairnessProof);
        };

        let mut msg = vector::empty<u8>();
        vector::append(&mut msg, object::id_to_bytes(&lend_order_id));
        vector::append(&mut msg, object::id_to_bytes(&borrow_order_id));
        
        let score_bytes = sui::bcs::to_bytes(&fairness_score);
        vector::append(&mut msg, score_bytes);
        
        assert!(
            ed25519::ed25519_verify(
                &fairness_proof, 
                &enclave.public_key, 
                &msg
            ), 
            EInvalidFairnessProof
        );

        event::emit(FairnessVerified {
            lend_order_id,
            borrow_order_id,
            fairness_score,
            enclave_id: object::id(enclave),
        });

        match_orders_internal(market, lend_order_id, borrow_order_id, clock, ctx);
    }

    /// Internal function to execute matching logic
    fun match_orders_internal<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        lend_order_id: ID,
        borrow_order_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&market.orders, lend_order_id), EOrderNotFound);
        assert!(table::contains(&market.orders, borrow_order_id), EOrderNotFound);

        let lend_order = table::remove(&mut market.orders, lend_order_id);
        let borrow_order = table::remove(&mut market.orders, borrow_order_id);

        assert!(lend_order.is_lend, EOrderNotFound);
        assert!(!borrow_order.is_lend, EOrderNotFound);

        assert!(borrow_order.interest_rate_bps >= lend_order.interest_rate_bps, ERateMismatch);
        assert!(lend_order.duration_ms >= borrow_order.duration_ms, EDurationMismatch);
        assert!(lend_order.amount == borrow_order.amount, EAmountMismatch);

        let lend_balance = table::remove(&mut market.lend_balances, lend_order_id);
        let loan_amount = balance::value(&lend_balance);
        let asset_coin = coin::from_balance(lend_balance, ctx);
        transfer::public_transfer(asset_coin, borrow_order.creator);

        let collateral_balance = table::remove(&mut market.collateral_balances, borrow_order_id);
        
        // Calculate final rate (midpoint between lend and borrow rates)
        let final_rate = (lend_order.interest_rate_bps + borrow_order.interest_rate_bps) / 2;

        let loan = loan::create_loan<Asset, Collateral>(
            borrow_order.creator,
            lend_order.creator,
            loan_amount,
            final_rate,
            clock::timestamp_ms(clock),
            borrow_order.duration_ms,
            collateral_balance,
            ctx
        );

        transfer::public_transfer(loan, lend_order.creator);

        market.active_orders = market.active_orders - 2;

        event::emit(OrderMatched {
            lend_order_id,
            borrow_order_id,
            amount: loan_amount,
            duration: borrow_order.duration_ms,
            final_rate,
        });
    }

    /// Deterministic match entry — no Nautilus enclave required.
    /// Settles a (lend, borrow) pair via classical price-time priority rules:
    ///   borrow.rate >= lend.rate, lend.duration >= borrow.duration, amounts equal.
    /// Use this when the off-chain fairness service is unavailable. Anyone can call it,
    /// because the rule set is fully verifiable on-chain.
    public entry fun match_best_offer<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        lend_order_id: ID,
        borrow_order_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        match_orders_internal(market, lend_order_id, borrow_order_id, clock, ctx);
    }

    #[test_only]
    public fun match_orders_for_testing<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        lend_order_id: ID,
        borrow_order_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        match_orders_internal(market, lend_order_id, borrow_order_id, clock, ctx);
    }

    // ============== LIQUIDATION VIA DEEPBOOK ==============

    /// Entry function for DeepBook-routed liquidation of a defaulted loan.
    /// Pays lender the principal+interest, returns remaining swap output (and base/deep dust)
    /// to the liquidator as their reward.
    public entry fun liquidate_and_swap<Asset, Collateral>(
        loan: loan::Loan<Asset, Collateral>,
        db_pool: &mut Pool<Collateral, Asset>,
        deep_coin: Coin<DEEP>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let loan_id = object::id(&loan);
        let (collateral_balance, total_debt, lender) = loan::unwrap_for_liquidation(loan, clock);
        let collateral_amount = balance::value(&collateral_balance);

        let collateral_coin = coin::from_balance(collateral_balance, ctx);
        let quote_in = coin::zero<Asset>(ctx);

        let (base_out, quote_out, deep_out) = db_pool::swap_exact_quantity(
            db_pool,
            collateral_coin,
            quote_in,
            deep_coin,
            total_debt,
            clock,
            ctx
        );

        let asset_received = coin::value(&quote_out);
        assert!(asset_received >= total_debt, EInsufficientLiquidation);
        let profit = asset_received - total_debt;

        // Pay lender principal + interest first, liquidator keeps the rest
        let mut quote_remaining = quote_out;
        let lender_payment = coin::split(&mut quote_remaining, total_debt, ctx);
        transfer::public_transfer(lender_payment, lender);

        event::emit(LoanLiquidated {
            loan_id,
            liquidator: tx_context::sender(ctx),
            collateral_sold: collateral_amount,
            asset_received,
            debt_repaid: total_debt,
            profit,
        });

        let sender = tx_context::sender(ctx);
        if (coin::value(&base_out) > 0) {
            transfer::public_transfer(base_out, sender);
        } else {
            coin::destroy_zero(base_out);
        };
        if (coin::value(&quote_remaining) > 0) {
            transfer::public_transfer(quote_remaining, sender);
        } else {
            coin::destroy_zero(quote_remaining);
        };
        if (coin::value(&deep_out) > 0) {
            transfer::public_transfer(deep_out, sender);
        } else {
            coin::destroy_zero(deep_out);
        };
    }

    // ============== VIEW FUNCTIONS ==============

    /// Get market statistics
    public fun get_market_stats<Asset, Collateral>(market: &Market<Asset, Collateral>): (u64, u64, u64, u64) {
        (
            market.total_lend_volume,
            market.total_borrow_volume,
            market.total_vested_volume,
            market.active_orders
        )
    }

    /// Check if market is active
    public fun is_market_active<Asset, Collateral>(market: &Market<Asset, Collateral>): bool {
        market.is_active
    }

    /// Get order details
    public fun get_order_info<Asset, Collateral>(
        market: &Market<Asset, Collateral>,
        order_id: ID
    ): (address, u64, u64, u64, bool) {
        let order = table::borrow(&market.orders, order_id);
        (
            order.creator,
            order.amount,
            order.interest_rate_bps,
            order.duration_ms,
            order.is_lend
        )
    }

    // ============== ADMIN FUNCTIONS ==============

    /// Pause market
    public entry fun pause_market<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        _ctx: &mut TxContext
    ) {
        market.is_active = false;
    }

    /// Unpause market
    public entry fun unpause_market<Asset, Collateral>(
        market: &mut Market<Asset, Collateral>,
        _ctx: &mut TxContext
    ) {
        market.is_active = true;
    }
}
