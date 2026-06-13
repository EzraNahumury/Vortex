#[allow(lint(public_entry), unused_const, deprecated_usage)]
/// Registry Module for Vortex Protocol
/// Manages multiple markets, supported collateral types, and protocol configuration
/// Enables multi-collateral lending with DeepBook integration
module vortex::registry {
    use sui::table::{Self, Table};
    use sui::event;
    use std::type_name::{Self, TypeName};

    // ============== ERROR CODES ==============
    const ECollateralNotSupported: u64 = 0;
    const EAssetNotSupported: u64 = 1;
    const EMarketAlreadyExists: u64 = 2;
    const EMarketNotFound: u64 = 3;
    const EUnauthorized: u64 = 4;
    const EInvalidLTV: u64 = 5;

    // ============== CONSTANTS ==============
    /// Maximum LTV ratio in basis points (80% = 8000 bps)
    const MAX_LTV_BPS: u64 = 8000;
    
    /// Default liquidation threshold in basis points (85% = 8500 bps)
    const DEFAULT_LIQUIDATION_THRESHOLD_BPS: u64 = 8500;

    /// Default liquidation bonus in basis points (5% = 500 bps)
    const DEFAULT_LIQUIDATION_BONUS_BPS: u64 = 500;

    // ============== STRUCTS ==============
    
    /// Protocol Admin capability
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Configuration for a specific collateral type
    public struct CollateralConfig has store, copy, drop {
        /// Type name of the collateral asset
        type_name: TypeName,
        /// Maximum LTV ratio allowed (in basis points, e.g., 7500 = 75%)
        max_ltv_bps: u64,
        /// Liquidation threshold (in basis points, e.g., 8000 = 80%)
        liquidation_threshold_bps: u64,
        /// Liquidation bonus for liquidators (in basis points, e.g., 500 = 5%)
        liquidation_bonus_bps: u64,
        /// Whether this collateral is active
        is_active: bool,
        /// DeepBook pool ID for this collateral (for liquidation routing)
        deepbook_pool_id: option::Option<ID>,
    }

    /// Configuration for a lending asset
    public struct AssetConfig has store, copy, drop {
        /// Type name of the lending asset
        type_name: TypeName,
        /// Whether this asset is active for lending
        is_active: bool,
        /// Minimum interest rate in basis points
        min_interest_rate_bps: u64,
        /// Maximum interest rate in basis points
        max_interest_rate_bps: u64,
    }

    /// Market pair key for lookup
    public struct MarketKey has store, copy, drop {
        asset_type: TypeName,
        collateral_type: TypeName,
    }

    /// Market info stored in registry
    public struct MarketInfo has store, copy, drop {
        market_id: ID,
        asset_type: TypeName,
        collateral_type: TypeName,
        is_active: bool,
        created_at: u64,
    }

    /// The main Registry shared object
    /// Manages all protocol configuration
    public struct Registry has key {
        id: UID,
        /// Supported collateral types: TypeName -> CollateralConfig
        collaterals: Table<TypeName, CollateralConfig>,
        /// Supported lending assets: TypeName -> AssetConfig
        assets: Table<TypeName, AssetConfig>,
        /// Registered markets: MarketKey -> MarketInfo
        markets: Table<MarketKey, MarketInfo>,
        /// Protocol fee in basis points (e.g., 30 = 0.3%)
        protocol_fee_bps: u64,
        /// Treasury address for protocol fees
        treasury: address,
        /// Total markets created
        total_markets: u64,
    }

    // ============== EVENTS ==============
    
    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        admin: address,
    }

    public struct CollateralAdded has copy, drop {
        collateral_type: TypeName,
        max_ltv_bps: u64,
        liquidation_threshold_bps: u64,
    }

    public struct CollateralUpdated has copy, drop {
        collateral_type: TypeName,
        max_ltv_bps: u64,
        is_active: bool,
    }

    public struct AssetAdded has copy, drop {
        asset_type: TypeName,
        min_rate_bps: u64,
        max_rate_bps: u64,
    }

    public struct MarketRegistered has copy, drop {
        market_id: ID,
        asset_type: TypeName,
        collateral_type: TypeName,
    }

    // ============== INIT ==============
    
    fun init(ctx: &mut TxContext) {
        let admin = AdminCap {
            id: object::new(ctx),
        };

        let registry = Registry {
            id: object::new(ctx),
            collaterals: table::new(ctx),
            assets: table::new(ctx),
            markets: table::new(ctx),
            protocol_fee_bps: 30, // 0.3% default
            treasury: tx_context::sender(ctx),
            total_markets: 0,
        };

        event::emit(RegistryCreated {
            registry_id: object::id(&registry),
            admin: tx_context::sender(ctx),
        });

        transfer::share_object(registry);
        transfer::transfer(admin, tx_context::sender(ctx));
    }

    // ============== ADMIN FUNCTIONS ==============

    /// Add a new supported collateral type
    public entry fun add_collateral<C>(
        _admin: &AdminCap,
        registry: &mut Registry,
        max_ltv_bps: u64,
        liquidation_threshold_bps: u64,
        liquidation_bonus_bps: u64,
        _ctx: &mut TxContext
    ) {
        assert!(max_ltv_bps <= MAX_LTV_BPS, EInvalidLTV);
        assert!(liquidation_threshold_bps > max_ltv_bps, EInvalidLTV);

        let collateral_type = type_name::get<C>();
        
        let config = CollateralConfig {
            type_name: collateral_type,
            max_ltv_bps,
            liquidation_threshold_bps,
            liquidation_bonus_bps,
            is_active: true,
            deepbook_pool_id: option::none(),
        };

        table::add(&mut registry.collaterals, collateral_type, config);

        event::emit(CollateralAdded {
            collateral_type,
            max_ltv_bps,
            liquidation_threshold_bps,
        });
    }

    /// Add a new supported lending asset
    public entry fun add_asset<A>(
        _admin: &AdminCap,
        registry: &mut Registry,
        min_interest_rate_bps: u64,
        max_interest_rate_bps: u64,
        _ctx: &mut TxContext
    ) {
        let asset_type = type_name::get<A>();
        
        let config = AssetConfig {
            type_name: asset_type,
            is_active: true,
            min_interest_rate_bps,
            max_interest_rate_bps,
        };

        table::add(&mut registry.assets, asset_type, config);

        event::emit(AssetAdded {
            asset_type,
            min_rate_bps: min_interest_rate_bps,
            max_rate_bps: max_interest_rate_bps,
        });
    }

    /// Update collateral configuration
    public entry fun update_collateral<C>(
        _admin: &AdminCap,
        registry: &mut Registry,
        max_ltv_bps: u64,
        liquidation_threshold_bps: u64,
        is_active: bool,
        _ctx: &mut TxContext
    ) {
        let collateral_type = type_name::get<C>();
        assert!(table::contains(&registry.collaterals, collateral_type), ECollateralNotSupported);
        
        let config = table::borrow_mut(&mut registry.collaterals, collateral_type);
        config.max_ltv_bps = max_ltv_bps;
        config.liquidation_threshold_bps = liquidation_threshold_bps;
        config.is_active = is_active;

        event::emit(CollateralUpdated {
            collateral_type,
            max_ltv_bps,
            is_active,
        });
    }

    /// Set DeepBook pool for collateral liquidation routing
    public entry fun set_collateral_deepbook_pool<C>(
        _admin: &AdminCap,
        registry: &mut Registry,
        pool_id: ID,
        _ctx: &mut TxContext
    ) {
        let collateral_type = type_name::get<C>();
        assert!(table::contains(&registry.collaterals, collateral_type), ECollateralNotSupported);
        
        let config = table::borrow_mut(&mut registry.collaterals, collateral_type);
        config.deepbook_pool_id = option::some(pool_id);
    }

    /// Register a new market
    public fun register_market<Asset, Collateral>(
        _admin: &AdminCap,
        registry: &mut Registry,
        market_id: ID,
        created_at: u64,
        _ctx: &mut TxContext
    ) {
        let asset_type = type_name::get<Asset>();
        let collateral_type = type_name::get<Collateral>();

        // Verify both types are supported
        assert!(table::contains(&registry.assets, asset_type), EAssetNotSupported);
        assert!(table::contains(&registry.collaterals, collateral_type), ECollateralNotSupported);

        let key = MarketKey { asset_type, collateral_type };
        assert!(!table::contains(&registry.markets, key), EMarketAlreadyExists);

        let info = MarketInfo {
            market_id,
            asset_type,
            collateral_type,
            is_active: true,
            created_at,
        };

        table::add(&mut registry.markets, key, info);
        registry.total_markets = registry.total_markets + 1;

        event::emit(MarketRegistered {
            market_id,
            asset_type,
            collateral_type,
        });
    }

    /// Update protocol fee
    public entry fun set_protocol_fee(
        _admin: &AdminCap,
        registry: &mut Registry,
        fee_bps: u64,
        _ctx: &mut TxContext
    ) {
        registry.protocol_fee_bps = fee_bps;
    }

    /// Update treasury address
    public entry fun set_treasury(
        _admin: &AdminCap,
        registry: &mut Registry,
        new_treasury: address,
        _ctx: &mut TxContext
    ) {
        registry.treasury = new_treasury;
    }

    // ============== VIEW FUNCTIONS ==============

    /// Check if a collateral type is supported
    public fun is_collateral_supported<C>(registry: &Registry): bool {
        let collateral_type = type_name::get<C>();
        table::contains(&registry.collaterals, collateral_type)
    }

    /// Check if an asset is supported
    public fun is_asset_supported<A>(registry: &Registry): bool {
        let asset_type = type_name::get<A>();
        table::contains(&registry.assets, asset_type)
    }

    /// Get collateral config
    public fun get_collateral_config<C>(registry: &Registry): CollateralConfig {
        let collateral_type = type_name::get<C>();
        *table::borrow(&registry.collaterals, collateral_type)
    }

    /// Get asset config
    public fun get_asset_config<A>(registry: &Registry): AssetConfig {
        let asset_type = type_name::get<A>();
        *table::borrow(&registry.assets, asset_type)
    }

    /// Get market info
    public fun get_market_info<Asset, Collateral>(registry: &Registry): MarketInfo {
        let key = MarketKey {
            asset_type: type_name::get<Asset>(),
            collateral_type: type_name::get<Collateral>(),
        };
        *table::borrow(&registry.markets, key)
    }

    /// Get max LTV for a collateral type
    public fun get_max_ltv<C>(registry: &Registry): u64 {
        let config = get_collateral_config<C>(registry);
        config.max_ltv_bps
    }

    /// Get liquidation threshold for a collateral type
    public fun get_liquidation_threshold<C>(registry: &Registry): u64 {
        let config = get_collateral_config<C>(registry);
        config.liquidation_threshold_bps
    }

    /// Get protocol fee
    public fun get_protocol_fee(registry: &Registry): u64 {
        registry.protocol_fee_bps
    }

    /// Get treasury address
    public fun get_treasury(registry: &Registry): address {
        registry.treasury
    }

    /// Get total markets count
    public fun get_total_markets(registry: &Registry): u64 {
        registry.total_markets
    }

    /// Verify market exists and is active
    public fun verify_market<Asset, Collateral>(registry: &Registry): bool {
        let key = MarketKey {
            asset_type: type_name::get<Asset>(),
            collateral_type: type_name::get<Collateral>(),
        };
        if (table::contains(&registry.markets, key)) {
            let info = table::borrow(&registry.markets, key);
            info.is_active
        } else {
            false
        }
    }

    // ============== HELPER FUNCTIONS ==============

    /// Calculate required collateral for a borrow amount given LTV
    /// Returns collateral amount needed
    public fun calculate_required_collateral(
        borrow_amount: u64,
        collateral_price: u64,  // Price in base units
        asset_price: u64,       // Price in base units
        ltv_bps: u64           // LTV in basis points
    ): u64 {
        // collateral_value = borrow_value / (ltv_bps / 10000)
        // collateral_amount = (borrow_amount * asset_price * 10000) / (collateral_price * ltv_bps)
        let borrow_value = (borrow_amount as u128) * (asset_price as u128);
        let required_value = borrow_value * 10000 / (ltv_bps as u128);
        ((required_value / (collateral_price as u128)) as u64)
    }

    /// Check if position is liquidatable
    public fun is_liquidatable(
        collateral_amount: u64,
        collateral_price: u64,
        debt_amount: u64,
        asset_price: u64,
        liquidation_threshold_bps: u64
    ): bool {
        let collateral_value = (collateral_amount as u128) * (collateral_price as u128);
        let debt_value = (debt_amount as u128) * (asset_price as u128);
        let threshold_value = collateral_value * (liquidation_threshold_bps as u128) / 10000;
        debt_value > threshold_value
    }

    // ============== TEST ONLY ==============
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_admin_for_testing(ctx: &mut TxContext): AdminCap {
        AdminCap {
            id: object::new(ctx),
        }
    }
}
