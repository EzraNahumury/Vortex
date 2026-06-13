#[allow(lint(self_transfer, public_entry))]
/// Vortex PLP + Hedge Vault — a structured product on top of DeepBook Predict.
///
/// Depositors put in dUSDC and receive a portable `VAULT_SHARE` coin. An off-chain
/// strategist (the "Nautilus" signer) decides how to split that capital between:
///   1. PLP supply  — most of the capital is supplied to the Predict LP pool to earn the
///      maker spread / PLP yield (`predict::supply`).
///   2. Crash hedge — a small budget mints out-of-the-money binary positions
///      (`predict::mint`) that pay out on a large adverse BTC move, capping the vault's
///      left-tail drawdown.
///
/// The strategist cannot move funds arbitrarily: every supply / hedge / unwind leg must
/// carry an ed25519 signature over the exact (amount, market, nonce) tuple, verified
/// on-chain against the vault's registered strategist key, with a strictly increasing
/// nonce for replay protection. This makes the strategy *verifiable*: anyone can audit
/// which legs were authorized.
///
/// Net product sold to outside LPs: "PLP yield minus crash insurance" — an easier sell
/// than raw PLP because the worst-case drawdown is bounded.
module vortex_predict::vault {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::bcs;
    use sui::clock::Clock;
    use sui::ed25519;
    use sui::event;

    use deepbook_predict::predict::{Self, Predict};
    use deepbook_predict::predict_manager::{Self, PredictManager};
    use deepbook_predict::oracle::{Self, OracleSVI};
    use deepbook_predict::market_key;
    use deepbook_predict::plp::PLP;

    use vortex_predict::vault_share::VAULT_SHARE;

    // ============== ERROR CODES ==============
    const EZeroAmount: u64 = 0;
    const EInsufficientIdle: u64 = 1;
    const EInsufficientPlp: u64 = 2;
    const EBadSignature: u64 = 3;
    const EStaleNonce: u64 = 4;
    const ENotKeeper: u64 = 5;
    const EWrongManager: u64 = 6;
    const ENoShares: u64 = 7;

    // ============== DOMAIN TAGS ==============
    // First byte of each signed message so a signature for one leg type can never be
    // replayed as another.
    const TAG_SUPPLY: u8 = 1;
    const TAG_HEDGE: u8 = 2;
    const TAG_WITHDRAW_PLP: u8 = 3;

    // ============== STRUCTS ==============

    /// The vault shared object. Generic over the quote/collateral coin (`Quote` = dUSDC on
    /// testnet).
    public struct PredictVault<phantom Quote> has key {
        id: UID,
        /// Deposited capital not yet deployed into Predict.
        idle: Balance<Quote>,
        /// PLP LP shares held from supply legs.
        plp: Balance<PLP>,
        /// Mint/burn authority for the tokenized vault share.
        share_treasury: TreasuryCap<VAULT_SHARE>,
        /// Cached share supply (== VAULT_SHARE total supply).
        total_shares: u64,
        /// The keeper-owned PredictManager used to hold hedge positions (mint is
        /// owner-gated, so the keeper signs hedge txs).
        manager_id: Option<ID>,
        /// Address authorized to run owner-gated keeper actions (hedge mint / redeem).
        keeper: address,
        /// ed25519 public key (32 bytes) of the off-chain strategist authorizing legs.
        strategist_pubkey: vector<u8>,
        /// Monotonic nonce — every authorized leg must use a strictly greater value.
        last_nonce: u64,
        /// Cumulative dUSDC supplied to PLP (accounting / APY attribution).
        supplied: u64,
        /// Cumulative dUSDC routed to the manager as hedge budget.
        hedge_budget_spent: u64,
    }

    // ============== EVENTS ==============

    public struct VaultCreated has copy, drop {
        vault_id: ID,
        keeper: address,
    }

    public struct Deposited has copy, drop {
        vault_id: ID,
        depositor: address,
        amount: u64,
        shares_minted: u64,
    }

    public struct Withdrawn has copy, drop {
        vault_id: ID,
        withdrawer: address,
        shares_burned: u64,
        amount: u64,
    }

    public struct SupplyLegExecuted has copy, drop {
        vault_id: ID,
        nonce: u64,
        amount: u64,
        plp_received: u64,
    }

    public struct HedgeLegExecuted has copy, drop {
        vault_id: ID,
        nonce: u64,
        oracle_id: ID,
        strike: u64,
        is_up: bool,
        quantity: u64,
        budget: u64,
    }

    public struct WithdrawPlpLegExecuted has copy, drop {
        vault_id: ID,
        nonce: u64,
        plp_burned: u64,
        quote_received: u64,
    }

    public struct HedgeRedeemed has copy, drop {
        vault_id: ID,
        oracle_id: ID,
        strike: u64,
        is_up: bool,
        quantity: u64,
        returned_to_vault: u64,
    }

    // ============== CREATION ==============

    /// Create and share a vault. `treasury` is the `VAULT_SHARE` cap minted at publish.
    public fun create_vault<Quote>(
        treasury: TreasuryCap<VAULT_SHARE>,
        keeper: address,
        strategist_pubkey: vector<u8>,
        ctx: &mut TxContext,
    ): ID {
        let vault = PredictVault<Quote> {
            id: object::new(ctx),
            idle: balance::zero<Quote>(),
            plp: balance::zero<PLP>(),
            share_treasury: treasury,
            total_shares: 0,
            manager_id: option::none(),
            keeper,
            strategist_pubkey,
            last_nonce: 0,
            supplied: 0,
            hedge_budget_spent: 0,
        };
        let vault_id = object::id(&vault);
        event::emit(VaultCreated { vault_id, keeper });
        transfer::share_object(vault);
        vault_id
    }

    /// Register the keeper-owned PredictManager used for hedge positions.
    public fun set_manager<Quote>(
        vault: &mut PredictVault<Quote>,
        manager: &PredictManager,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.keeper, ENotKeeper);
        vault.manager_id = option::some(object::id(manager));
    }

    /// Rotate the strategist key (keeper only).
    public fun set_strategist_pubkey<Quote>(
        vault: &mut PredictVault<Quote>,
        new_pubkey: vector<u8>,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.keeper, ENotKeeper);
        vault.strategist_pubkey = new_pubkey;
    }

    // ============== USER DEPOSIT / WITHDRAW ==============

    /// Deposit dUSDC and mint vault shares 1:1 (MVP par accounting; NAV/yield is tracked
    /// off-chain by the indexer). Returns the share coin.
    public fun deposit<Quote>(
        vault: &mut PredictVault<Quote>,
        payment: Coin<Quote>,
        ctx: &mut TxContext,
    ): Coin<VAULT_SHARE> {
        let amount = coin::value(&payment);
        assert!(amount > 0, EZeroAmount);

        let vault_id = object::id(vault);
        balance::join(&mut vault.idle, coin::into_balance(payment));
        let shares = coin::mint(&mut vault.share_treasury, amount, ctx);
        vault.total_shares = vault.total_shares + amount;

        event::emit(Deposited {
            vault_id,
            depositor: tx_context::sender(ctx),
            amount,
            shares_minted: amount,
        });
        shares
    }

    /// Entry wrapper: deposit and transfer the share coin back to the sender.
    public entry fun deposit_entry<Quote>(
        vault: &mut PredictVault<Quote>,
        payment: Coin<Quote>,
        ctx: &mut TxContext,
    ) {
        let shares = deposit(vault, payment, ctx);
        transfer::public_transfer(shares, tx_context::sender(ctx));
    }

    /// Burn vault shares and redeem the proportional claim on the vault's *idle* balance.
    /// Capital deployed into PLP / hedges must be unwound by the keeper first; this keeps
    /// withdrawals trustless (no forced unwind of live Predict positions).
    public fun withdraw<Quote>(
        vault: &mut PredictVault<Quote>,
        shares: Coin<VAULT_SHARE>,
        ctx: &mut TxContext,
    ): Coin<Quote> {
        let share_amt = coin::value(&shares);
        assert!(share_amt > 0, EZeroAmount);
        assert!(vault.total_shares > 0, ENoShares);

        let vault_id = object::id(vault);
        let idle_val = balance::value(&vault.idle);
        // Proportional claim on idle capital.
        let payout = (((share_amt as u128) * (idle_val as u128)) / (vault.total_shares as u128)) as u64;
        assert!(payout > 0 && payout <= idle_val, EInsufficientIdle);

        coin::burn(&mut vault.share_treasury, shares);
        vault.total_shares = vault.total_shares - share_amt;
        let out = coin::from_balance(balance::split(&mut vault.idle, payout), ctx);

        event::emit(Withdrawn {
            vault_id,
            withdrawer: tx_context::sender(ctx),
            shares_burned: share_amt,
            amount: payout,
        });
        out
    }

    public entry fun withdraw_entry<Quote>(
        vault: &mut PredictVault<Quote>,
        shares: Coin<VAULT_SHARE>,
        ctx: &mut TxContext,
    ) {
        let out = withdraw(vault, shares, ctx);
        transfer::public_transfer(out, tx_context::sender(ctx));
    }

    // ============== SIGNED STRATEGY LEGS ==============

    /// Supply `amount` idle dUSDC into the Predict PLP pool, storing the returned PLP.
    /// Permissionless to *submit* — the ed25519 signature is the authorization, so a
    /// keeper bot or anyone can land the strategist's signed plan.
    public entry fun execute_supply_leg<Quote>(
        vault: &mut PredictVault<Quote>,
        predict: &mut Predict,
        amount: u64,
        nonce: u64,
        signature: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(amount > 0, EZeroAmount);
        assert!(balance::value(&vault.idle) >= amount, EInsufficientIdle);

        let vault_id = object::id(vault);
        let mut msg = vector::empty<u8>();
        vector::push_back(&mut msg, TAG_SUPPLY);
        vector::append(&mut msg, object::id_to_bytes(&vault_id));
        vector::append(&mut msg, bcs::to_bytes(&nonce));
        vector::append(&mut msg, bcs::to_bytes(&amount));
        verify(vault, &msg, &signature);
        consume_nonce(vault, nonce);

        let pay = coin::from_balance(balance::split(&mut vault.idle, amount), ctx);
        let plp_coin = predict::supply<Quote>(predict, pay, clock, ctx);
        let plp_received = coin::value(&plp_coin);
        balance::join(&mut vault.plp, coin::into_balance(plp_coin));
        vault.supplied = vault.supplied + amount;

        event::emit(SupplyLegExecuted { vault_id, nonce, amount, plp_received });
    }

    /// Mint an out-of-the-money binary hedge. Funds the keeper-owned manager with `budget`
    /// dUSDC, then mints `quantity` contracts at (`strike`, `is_up`). Keeper-gated because
    /// `predict::mint` requires `sender == manager.owner`.
    public entry fun execute_hedge_leg<Quote>(
        vault: &mut PredictVault<Quote>,
        predict: &mut Predict,
        manager: &mut PredictManager,
        oracle: &OracleSVI,
        expiry: u64,
        strike: u64,
        is_up: bool,
        quantity: u64,
        budget: u64,
        nonce: u64,
        signature: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.keeper, ENotKeeper);
        assert!(quantity > 0, EZeroAmount);
        assert!(budget > 0 && balance::value(&vault.idle) >= budget, EInsufficientIdle);
        if (option::is_some(&vault.manager_id)) {
            assert!(option::borrow(&vault.manager_id) == &object::id(manager), EWrongManager);
        };

        let vault_id = object::id(vault);
        let oracle_id = oracle::id(oracle);

        let mut msg = vector::empty<u8>();
        vector::push_back(&mut msg, TAG_HEDGE);
        vector::append(&mut msg, object::id_to_bytes(&vault_id));
        vector::append(&mut msg, bcs::to_bytes(&nonce));
        vector::append(&mut msg, object::id_to_bytes(&oracle_id));
        vector::append(&mut msg, bcs::to_bytes(&expiry));
        vector::append(&mut msg, bcs::to_bytes(&strike));
        vector::push_back(&mut msg, if (is_up) 1u8 else 0u8);
        vector::append(&mut msg, bcs::to_bytes(&quantity));
        vector::append(&mut msg, bcs::to_bytes(&budget));
        verify(vault, &msg, &signature);
        consume_nonce(vault, nonce);

        // Fund the manager, then mint. Mint cost is auto-debited from the manager balance;
        // any unspent budget remains in the manager for the next hedge or redemption sweep.
        let pay = coin::from_balance(balance::split(&mut vault.idle, budget), ctx);
        predict_manager::deposit<Quote>(manager, pay, ctx);
        let key = market_key::new(oracle_id, expiry, strike, is_up);
        predict::mint<Quote>(predict, manager, oracle, key, quantity, clock, ctx);
        vault.hedge_budget_spent = vault.hedge_budget_spent + budget;

        event::emit(HedgeLegExecuted {
            vault_id, nonce, oracle_id, strike, is_up, quantity, budget,
        });
    }

    /// Unwind PLP back into idle dUSDC (subject to the Predict withdrawal rate limiter).
    public entry fun execute_withdraw_plp_leg<Quote>(
        vault: &mut PredictVault<Quote>,
        predict: &mut Predict,
        plp_amount: u64,
        nonce: u64,
        signature: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(plp_amount > 0 && balance::value(&vault.plp) >= plp_amount, EInsufficientPlp);

        let vault_id = object::id(vault);
        let mut msg = vector::empty<u8>();
        vector::push_back(&mut msg, TAG_WITHDRAW_PLP);
        vector::append(&mut msg, object::id_to_bytes(&vault_id));
        vector::append(&mut msg, bcs::to_bytes(&nonce));
        vector::append(&mut msg, bcs::to_bytes(&plp_amount));
        verify(vault, &msg, &signature);
        consume_nonce(vault, nonce);

        let lp = coin::from_balance(balance::split(&mut vault.plp, plp_amount), ctx);
        let quote = predict::withdraw<Quote>(predict, lp, clock, ctx);
        let quote_received = coin::value(&quote);
        balance::join(&mut vault.idle, coin::into_balance(quote));

        event::emit(WithdrawPlpLegExecuted { vault_id, nonce, plp_burned: plp_amount, quote_received });
    }

    /// After an oracle settles, permissionlessly redeem a hedge position into the manager
    /// and sweep the entire manager quote balance back into the vault. Keeper-gated (the
    /// manager withdraw is owner-gated). No strategist signature needed — settlement is
    /// deterministic.
    public entry fun execute_redeem_hedge<Quote>(
        vault: &mut PredictVault<Quote>,
        predict: &mut Predict,
        manager: &mut PredictManager,
        oracle: &OracleSVI,
        expiry: u64,
        strike: u64,
        is_up: bool,
        quantity: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.keeper, ENotKeeper);
        if (option::is_some(&vault.manager_id)) {
            assert!(option::borrow(&vault.manager_id) == &object::id(manager), EWrongManager);
        };

        let vault_id = object::id(vault);
        let oracle_id = oracle::id(oracle);
        let key = market_key::new(oracle_id, expiry, strike, is_up);
        predict::redeem_permissionless<Quote>(predict, manager, oracle, key, quantity, clock, ctx);

        // Sweep manager quote balance (payout + any unspent budget) back to the vault.
        let bal = predict_manager::balance<Quote>(manager);
        let mut returned = 0;
        if (bal > 0) {
            let c = predict_manager::withdraw<Quote>(manager, bal, ctx);
            returned = coin::value(&c);
            balance::join(&mut vault.idle, coin::into_balance(c));
        };

        event::emit(HedgeRedeemed {
            vault_id, oracle_id, strike, is_up, quantity, returned_to_vault: returned,
        });
    }

    /// Credit an external dUSDC coin into the vault idle balance (keeper only). Lets the
    /// keeper return manually-redeemed payouts or top up the vault.
    public fun absorb<Quote>(
        vault: &mut PredictVault<Quote>,
        coin: Coin<Quote>,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.keeper, ENotKeeper);
        balance::join(&mut vault.idle, coin::into_balance(coin));
    }

    // ============== INTERNAL ==============

    fun verify<Quote>(vault: &PredictVault<Quote>, msg: &vector<u8>, signature: &vector<u8>) {
        assert!(ed25519::ed25519_verify(signature, &vault.strategist_pubkey, msg), EBadSignature);
    }

    fun consume_nonce<Quote>(vault: &mut PredictVault<Quote>, nonce: u64) {
        assert!(nonce > vault.last_nonce, EStaleNonce);
        vault.last_nonce = nonce;
    }

    // ============== VIEWS ==============

    public fun idle_balance<Quote>(vault: &PredictVault<Quote>): u64 {
        balance::value(&vault.idle)
    }

    public fun plp_balance<Quote>(vault: &PredictVault<Quote>): u64 {
        balance::value(&vault.plp)
    }

    public fun total_shares<Quote>(vault: &PredictVault<Quote>): u64 {
        vault.total_shares
    }

    public fun keeper<Quote>(vault: &PredictVault<Quote>): address {
        vault.keeper
    }

    public fun last_nonce<Quote>(vault: &PredictVault<Quote>): u64 {
        vault.last_nonce
    }

    public fun supplied<Quote>(vault: &PredictVault<Quote>): u64 {
        vault.supplied
    }

    public fun hedge_budget_spent<Quote>(vault: &PredictVault<Quote>): u64 {
        vault.hedge_budget_spent
    }

    public fun strategist_pubkey<Quote>(vault: &PredictVault<Quote>): vector<u8> {
        vault.strategist_pubkey
    }

    // ============== TEST HELPERS ==============

    #[test_only]
    public fun verify_for_testing<Quote>(
        vault: &PredictVault<Quote>,
        msg: vector<u8>,
        signature: vector<u8>,
    ) {
        verify(vault, &msg, &signature);
    }

    #[test_only]
    public fun supply_message_for_testing<Quote>(
        vault: &PredictVault<Quote>,
        nonce: u64,
        amount: u64,
    ): vector<u8> {
        let mut msg = vector::empty<u8>();
        vector::push_back(&mut msg, TAG_SUPPLY);
        vector::append(&mut msg, object::id_to_bytes(&object::id(vault)));
        vector::append(&mut msg, bcs::to_bytes(&nonce));
        vector::append(&mut msg, bcs::to_bytes(&amount));
        msg
    }
}
