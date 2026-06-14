#[allow(lint(public_entry), unused_const, deprecated_usage)]
/// Aggregator Vault — Nautilus-driven yield router.
///
/// Users deposit a single asset; the vault holds the principal and asks an off-chain
/// Nautilus enclave for an allocation plan that splits the principal across one or more
/// markets as lend orders. The plan is signed by the enclave; this module verifies the
/// signature and executes the splits atomically.
module vortex::vault {
    use sui::balance::{Self, Balance};
    use sui::bcs;
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::ed25519;
    use sui::event;
    use sui::table::{Self, Table};
    use std::type_name;

    use vortex::market::{Self, Market, RegisteredEnclave};

    // ============== ERROR CODES ==============
    const EInvalidPlan: u64 = 0;
    const EBadSignature: u64 = 1;
    const EInsufficientBalance: u64 = 2;
    const EEmptyPlan: u64 = 3;
    const ENotShareHolder: u64 = 4;
    const EAllocationOverflow: u64 = 5;
    /// A leg signature is being replayed (nonce not strictly greater than the last consumed).
    const ENonceReplay: u64 = 6;

    // ============== STRUCTS ==============

    /// Single-asset aggregator vault.
    public struct AggregatorVault<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        total_shares: u64,
        // Per-depositor share accounting.
        shares: Table<address, u64>,
        // Sum of all amounts that have been routed out as lend orders.
        deployed: u64,
        // Highest allocation-leg nonce consumed so far; each new leg must exceed it.
        last_nonce: u64,
    }

    /// Receipt emitted after an allocation has been executed. Helps off-chain indexers
    /// reconstruct the historical strategy of the vault.
    public struct AllocationExecuted has copy, drop {
        vault_id: ID,
        nonce: u64,
        leg_count: u64,
        total_routed: u64,
    }

    public struct VaultDeposit has copy, drop {
        vault_id: ID,
        depositor: address,
        amount: u64,
        shares_minted: u64,
    }

    public struct VaultWithdraw has copy, drop {
        vault_id: ID,
        depositor: address,
        amount: u64,
        shares_burned: u64,
    }

    public struct VaultCreated has copy, drop {
        vault_id: ID,
        asset_type: std::ascii::String,
    }

    // ============== INIT ==============

    public entry fun create_vault<T>(ctx: &mut TxContext) {
        let vault = AggregatorVault<T> {
            id: object::new(ctx),
            balance: balance::zero<T>(),
            total_shares: 0,
            shares: table::new(ctx),
            deployed: 0,
            last_nonce: 0,
        };

        event::emit(VaultCreated {
            vault_id: object::id(&vault),
            asset_type: type_name::get<T>().into_string(),
        });

        transfer::share_object(vault);
    }

    // ============== DEPOSIT / WITHDRAW ==============

    /// Deposit principal into the vault. Mints shares 1:1 with the underlying asset for
    /// simplicity — fee/yield tracking lives off-chain in the indexer.
    public entry fun deposit<T>(
        vault: &mut AggregatorVault<T>,
        payment: Coin<T>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&payment);
        assert!(amount > 0, EInsufficientBalance);
        balance::join(&mut vault.balance, coin::into_balance(payment));

        let sender = tx_context::sender(ctx);
        if (table::contains(&vault.shares, sender)) {
            let cur = table::borrow_mut(&mut vault.shares, sender);
            *cur = *cur + amount;
        } else {
            table::add(&mut vault.shares, sender, amount);
        };
        vault.total_shares = vault.total_shares + amount;

        event::emit(VaultDeposit {
            vault_id: object::id(vault),
            depositor: sender,
            amount,
            shares_minted: amount,
        });
    }

    /// Withdraw principal proportionally — caller must hold enough idle shares (i.e. not
    /// currently deployed via an allocation plan).
    public entry fun withdraw<T>(
        vault: &mut AggregatorVault<T>,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&vault.shares, sender), ENotShareHolder);
        let share = table::borrow_mut(&mut vault.shares, sender);
        assert!(*share >= amount, EInsufficientBalance);

        let idle = balance::value(&vault.balance);
        assert!(idle >= amount, EInsufficientBalance);

        *share = *share - amount;
        vault.total_shares = vault.total_shares - amount;
        let coin = coin::take(&mut vault.balance, amount, ctx);
        transfer::public_transfer(coin, sender);

        event::emit(VaultWithdraw {
            vault_id: object::id(vault),
            depositor: sender,
            amount,
            shares_burned: amount,
        });
    }

    // ============== ALLOCATION ==============

    /// Verify the Nautilus signature over a single allocation leg before routing it.
    /// Message layout: vault_id (32) || nonce (u64 LE) || market_id (32) || amount (u64 LE)
    ///                 || rate_bps (u64 LE) || duration_ms (u64 LE).
    fun verify_leg(
        vault_id: &ID,
        nonce: u64,
        enclave: &RegisteredEnclave,
        market_id: ID,
        amount: u64,
        rate_bps: u64,
        duration_ms: u64,
        signature: &vector<u8>,
    ) {
        let mut msg = vector::empty<u8>();
        vector::append(&mut msg, object::id_to_bytes(vault_id));
        vector::append(&mut msg, bcs::to_bytes(&nonce));
        vector::append(&mut msg, object::id_to_bytes(&market_id));
        vector::append(&mut msg, bcs::to_bytes(&amount));
        vector::append(&mut msg, bcs::to_bytes(&rate_bps));
        vector::append(&mut msg, bcs::to_bytes(&duration_ms));

        let public_key = market::enclave_public_key(enclave);
        assert!(
            ed25519::ed25519_verify(signature, &public_key, &msg),
            EBadSignature,
        );
    }

    /// Execute a single allocation leg — places one lend order on the target market.
    /// Each leg is signed individually so the caller can submit a partial plan if some
    /// legs would otherwise revert.
    public entry fun execute_allocation_leg<Asset, Collateral>(
        vault: &mut AggregatorVault<Asset>,
        enclave: &RegisteredEnclave,
        market: &mut Market<Asset, Collateral>,
        nonce: u64,
        amount: u64,
        rate_bps: u64,
        duration_ms: u64,
        signature: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(amount > 0, EInvalidPlan);
        let idle = balance::value(&vault.balance);
        assert!(idle >= amount, EAllocationOverflow);

        let market_id = object::id(market);
        let vault_id = object::id(vault);
        verify_leg(&vault_id, nonce, enclave, market_id, amount, rate_bps, duration_ms, &signature);

        // Replay protection: each signed leg must carry a strictly increasing nonce, so a
        // captured signature cannot be resubmitted to over-deploy the vault's idle balance.
        assert!(nonce > vault.last_nonce, ENonceReplay);
        vault.last_nonce = nonce;

        let payment_balance = balance::split(&mut vault.balance, amount);
        let payment = coin::from_balance(payment_balance, ctx);

        // Place the lend order on behalf of the vault. The lender field on the resulting
        // order will be tx_context::sender(ctx), so allocations should be executed by the
        // vault keeper — typically a service account.
        let _order_id = market::place_lend_order<Asset, Collateral>(
            market,
            payment,
            rate_bps,
            duration_ms,
            clock,
            ctx,
        );

        vault.deployed = vault.deployed + amount;

        event::emit(AllocationExecuted {
            vault_id,
            nonce,
            leg_count: 1,
            total_routed: amount,
        });
    }

    // ============== VIEWS ==============

    public fun idle_balance<T>(vault: &AggregatorVault<T>): u64 {
        balance::value(&vault.balance)
    }

    public fun total_deployed<T>(vault: &AggregatorVault<T>): u64 {
        vault.deployed
    }

    public fun shares_of<T>(vault: &AggregatorVault<T>, who: address): u64 {
        if (table::contains(&vault.shares, who)) {
            *table::borrow(&vault.shares, who)
        } else {
            0
        }
    }

    public fun total_shares<T>(vault: &AggregatorVault<T>): u64 {
        vault.total_shares
    }
}
