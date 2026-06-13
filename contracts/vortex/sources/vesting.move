#[allow(lint(public_entry), lint(share_owned), unused_const, unused_use, deprecated_usage, lint(self_transfer))]
/// Vesting Module for Vortex Protocol
/// Manages locked vesting positions that can be used as collateral for borrowing
/// Supports multi-collateral with SUI, USDC, and ETH
module vortex::vesting {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::table::{Self, Table};
    
    // ============== ERROR CODES ==============
    const EPositionNotMature: u64 = 0;
    const EInvalidProof: u64 = 1;
    const ENotOwner: u64 = 2;
    const EVaultNotFound: u64 = 3;
    const EPositionAlreadyUsedAsCollateral: u64 = 4;
    const EInsufficientBalance: u64 = 5;

    // ============== CONSTANTS ==============
    /// Minimum lock duration: 7 days in milliseconds
    const MIN_LOCK_DURATION_MS: u64 = 604800000;
    
    /// Maximum lock duration: 365 days in milliseconds
    const MAX_LOCK_DURATION_MS: u64 = 31536000000;
    
    /// Base subsidy APR: 2%
    const BASE_SUBSIDY_BPS: u64 = 200;

    // ============== STRUCTS ==============

    /// Generic Vesting Vault for any token type
    public struct VestingVault<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_staked: u64,
        total_rewards_distributed: u64,
        reward_rate_bps: u64,
    }

    /// Represents a user's locked vesting position (generic for any token)
    public struct VestingPosition has key, store {
        id: UID,
        /// Amount of tokens locked
        amount: u64,
        /// Token type name (for display)
        token_type: std::ascii::String,
        /// When the lock started
        start_timestamp: u64,
        /// How long tokens are locked
        lock_duration: u64,
        /// Owner of this position
        owner: address,
        /// Whether this position is being used as collateral
        is_collateralized: bool,
        /// Loan ID if used as collateral
        loan_id: option::Option<ID>,
        /// Earned rewards (claimable after maturity)
        pending_rewards: u64,
    }

    /// Legacy SUI-specific vault (for backwards compatibility)
    public struct LegacyVestingVault has key {
        id: UID,
        balance: Balance<SUI>,
    }

    // ============== EVENTS ==============

    public struct VaultCreated has copy, drop {
        vault_id: ID,
        token_type: std::ascii::String,
        reward_rate_bps: u64,
    }

    public struct Locked has copy, drop {
        position_id: ID,
        vault_id: ID,
        user: address,
        amount: u64,
        token_type: std::ascii::String,
        unlock_time: u64,
    }

    public struct Unlocked has copy, drop {
        position_id: ID,
        user: address,
        amount: u64,
        reward: u64,
    }

    public struct PositionCollateralized has copy, drop {
        position_id: ID,
        loan_id: ID,
        owner: address,
    }

    public struct PositionReleased has copy, drop {
        position_id: ID,
        owner: address,
    }

    // ============== INIT ==============
    
    #[allow(lint(share_owned))]
    fun init(ctx: &mut TxContext) {
        // Create legacy SUI vault for backwards compatibility
        let vault = LegacyVestingVault {
            id: object::new(ctx),
            balance: balance::zero(),
        };
        transfer::share_object(vault);
    }

    // ============== VAULT CREATION ==============

    /// Create a new vesting vault for any token type
    public entry fun create_vault<T>(
        reward_rate_bps: u64,
        ctx: &mut TxContext
    ) {
        let vault = VestingVault<T> {
            id: object::new(ctx),
            balance: balance::zero(),
            total_staked: 0,
            total_rewards_distributed: 0,
            reward_rate_bps,
        };

        event::emit(VaultCreated {
            vault_id: object::id(&vault),
            token_type: std::type_name::get<T>().into_string(),
            reward_rate_bps,
        });

        transfer::share_object(vault);
    }

    // ============== LOCKING ==============

    /// Lock tokens in vault with ZK proof verification
    public entry fun lock<T>(
        vault: &mut VestingVault<T>,
        payment: Coin<T>,
        duration: u64,
        zk_proof_points: vector<u8>,
        zk_public_inputs: vector<u8>,
        zk_verifying_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify ZK Proof (Groth16 - BN254)
        let curve = sui::groth16::bn254();
        let pvk = sui::groth16::prepare_verifying_key(&curve, &zk_verifying_key);
        let proof_points = sui::groth16::proof_points_from_bytes(zk_proof_points);
        let public_inputs = sui::groth16::public_proof_inputs_from_bytes(zk_public_inputs);

        let verified = sui::groth16::verify_groth16_proof(
            &curve, 
            &pvk, 
            &public_inputs, 
            &proof_points
        );
        assert!(verified, EInvalidProof);

        lock_internal(vault, payment, duration, clock, ctx);
    }

    /// Lock tokens without ZK proof (for testing or trusted sources)
    public entry fun lock_simple<T>(
        vault: &mut VestingVault<T>,
        payment: Coin<T>,
        duration: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        lock_internal(vault, payment, duration, clock, ctx);
    }

    /// Internal lock logic
    fun lock_internal<T>(
        vault: &mut VestingVault<T>,
        payment: Coin<T>,
        duration: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut vault.balance, coin_balance);

        vault.total_staked = vault.total_staked + amount;

        let start_time = clock::timestamp_ms(clock);
        
        // Calculate pending rewards based on lock duration
        let pending_rewards = calculate_rewards(amount, duration, vault.reward_rate_bps);
        
        let position = VestingPosition {
            id: object::new(ctx),
            amount,
            token_type: std::type_name::get<T>().into_string(),
            start_timestamp: start_time,
            lock_duration: duration,
            owner: tx_context::sender(ctx),
            is_collateralized: false,
            loan_id: option::none(),
            pending_rewards,
        };

        event::emit(Locked {
            position_id: object::id(&position),
            vault_id: object::id(vault),
            user: tx_context::sender(ctx),
            amount,
            token_type: std::type_name::get<T>().into_string(),
            unlock_time: start_time + duration,
        });

        transfer::public_transfer(position, tx_context::sender(ctx));
    }

    /// Calculate rewards based on amount, duration, and rate
    fun calculate_rewards(amount: u64, duration_ms: u64, reward_rate_bps: u64): u64 {
        // Rewards = amount * rate * (duration / year)
        let year_ms: u128 = 31536000000;
        let principal = (amount as u128);
        let rate = (reward_rate_bps as u128);
        let time = (duration_ms as u128);
        
        let rewards = (principal * rate * time) / (10000 * year_ms);
        (rewards as u64)
    }

    // ============== UNLOCKING ==============

    /// Unlock tokens after duration ends
    public entry fun unlock<T>(
        vault: &mut VestingVault<T>,
        position: VestingPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= position.start_timestamp + position.lock_duration, EPositionNotMature);
        assert!(!position.is_collateralized, EPositionAlreadyUsedAsCollateral);
        assert!(position.owner == tx_context::sender(ctx), ENotOwner);

        let VestingPosition { 
            id, 
            amount, 
            token_type: _, 
            start_timestamp: _, 
            lock_duration: _, 
            owner: _,
            is_collateralized: _,
            loan_id: _,
            pending_rewards,
        } = position;
        
        let position_id = object::uid_to_inner(&id);
        object::delete(id);

        // Withdraw principal
        let principal = balance::split(&mut vault.balance, amount);
        let coin = coin::from_balance(principal, ctx);

        // Calculate and distribute rewards
        let reward_amount = pending_rewards;
        vault.total_staked = vault.total_staked - amount;
        vault.total_rewards_distributed = vault.total_rewards_distributed + reward_amount;

        event::emit(Unlocked {
            position_id,
            user: tx_context::sender(ctx),
            amount,
            reward: reward_amount,
        });

        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    // ============== COLLATERALIZATION ==============

    /// Mark position as collateralized (called by market module)
    public fun collateralize_position(
        position: &mut VestingPosition,
        loan_id: ID,
        _ctx: &mut TxContext
    ) {
        assert!(!position.is_collateralized, EPositionAlreadyUsedAsCollateral);
        
        position.is_collateralized = true;
        position.loan_id = option::some(loan_id);

        event::emit(PositionCollateralized {
            position_id: object::id(position),
            loan_id,
            owner: position.owner,
        });
    }

    /// Release position from collateralization (called after loan repayment)
    public fun release_position(
        position: &mut VestingPosition,
        _ctx: &mut TxContext
    ) {
        position.is_collateralized = false;
        position.loan_id = option::none();

        event::emit(PositionReleased {
            position_id: object::id(position),
            owner: position.owner,
        });
    }

    // ============== LEGACY SUI VAULT ==============

    /// Lock SUI in legacy vault (for backwards compatibility)
    public entry fun lock_sui_legacy(
        vault: &mut LegacyVestingVault,
        payment: Coin<SUI>,
        duration: u64,
        zk_proof_points: vector<u8>,
        zk_public_inputs: vector<u8>,
        zk_verifying_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let curve = sui::groth16::bn254();
        let pvk = sui::groth16::prepare_verifying_key(&curve, &zk_verifying_key);
        let proof_points = sui::groth16::proof_points_from_bytes(zk_proof_points);
        let public_inputs = sui::groth16::public_proof_inputs_from_bytes(zk_public_inputs);

        let verified = sui::groth16::verify_groth16_proof(
            &curve, 
            &pvk, 
            &public_inputs, 
            &proof_points
        );
        assert!(verified, EInvalidProof);

        let amount = coin::value(&payment);
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut vault.balance, coin_balance);

        let start_time = clock::timestamp_ms(clock);
        
        let position = VestingPosition {
            id: object::new(ctx),
            amount,
            token_type: std::type_name::get<SUI>().into_string(),
            start_timestamp: start_time,
            lock_duration: duration,
            owner: tx_context::sender(ctx),
            is_collateralized: false,
            loan_id: option::none(),
            pending_rewards: calculate_rewards(amount, duration, BASE_SUBSIDY_BPS),
        };

        event::emit(Locked {
            position_id: object::id(&position),
            vault_id: object::id(vault),
            user: tx_context::sender(ctx),
            amount,
            token_type: std::type_name::get<SUI>().into_string(),
            unlock_time: start_time + duration,
        });

        transfer::public_transfer(position, tx_context::sender(ctx));
    }

    /// Unlock SUI from legacy vault
    public entry fun unlock_sui_legacy(
        vault: &mut LegacyVestingVault,
        position: VestingPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= position.start_timestamp + position.lock_duration, EPositionNotMature);
        assert!(!position.is_collateralized, EPositionAlreadyUsedAsCollateral);
        assert!(position.owner == tx_context::sender(ctx), ENotOwner);

        let VestingPosition { 
            id, 
            amount, 
            token_type: _, 
            start_timestamp: _, 
            lock_duration: _, 
            owner: _,
            is_collateralized: _,
            loan_id: _,
            pending_rewards,
        } = position;
        
        let position_id = object::uid_to_inner(&id);
        object::delete(id);

        let principal = balance::split(&mut vault.balance, amount);
        let coin = coin::from_balance(principal, ctx);

        event::emit(Unlocked {
            position_id,
            user: tx_context::sender(ctx),
            amount,
            reward: pending_rewards,
        });

        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    // ============== VIEW FUNCTIONS ==============

    /// Get position info
    public fun get_position_info(position: &VestingPosition): (u64, u64, u64, address, bool) {
        (
            position.amount,
            position.start_timestamp,
            position.lock_duration,
            position.owner,
            position.is_collateralized
        )
    }

    /// Get unlock timestamp
    public fun get_unlock_time(position: &VestingPosition): u64 {
        position.start_timestamp + position.lock_duration
    }

    /// Check if position is mature
    public fun is_mature(position: &VestingPosition, clock: &Clock): bool {
        clock::timestamp_ms(clock) >= position.start_timestamp + position.lock_duration
    }

    /// Get pending rewards
    public fun get_pending_rewards(position: &VestingPosition): u64 {
        position.pending_rewards
    }

    /// Get vault stats
    public fun get_vault_stats<T>(vault: &VestingVault<T>): (u64, u64, u64) {
        (
            vault.total_staked,
            vault.total_rewards_distributed,
            vault.reward_rate_bps
        )
    }

    // ============== TEST ONLY ==============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_test_position(
        amount: u64,
        duration: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): VestingPosition {
        VestingPosition {
            id: object::new(ctx),
            amount,
            token_type: b"SUI".to_ascii_string(),
            start_timestamp: clock::timestamp_ms(clock),
            lock_duration: duration,
            owner: tx_context::sender(ctx),
            is_collateralized: false,
            loan_id: option::none(),
            pending_rewards: calculate_rewards(amount, duration, BASE_SUBSIDY_BPS),
        }
    }
}
