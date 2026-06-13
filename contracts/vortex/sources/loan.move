#[allow(lint(public_entry), deprecated_usage)]
module vortex::loan {
    use sui::coin::{Self, Coin};
    use sui::event;
    use std::type_name;
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};


    /// Struct representing a Loan.
    /// It captures the terms agreed upon between Lender and Borrower.
    /// Includes the Locked Collateral to ensure trustless repayment.
    public struct Loan<phantom Asset, phantom Collateral> has key, store {
        id: UID,
        borrower: address,
        lender: address,
        amount: u64,
        interest_rate_bps: u64, // Annual interest rate in Basis Points (e.g. 1000 = 10%)
        start_timestamp: u64,
        duration: u64,
        /// The collateral is locked inside the Loan object.
        /// Even if the Lender holds this object, they cannot extract this
        /// unless the Borrower defaults (liquidation) or Repays.
        collateral_balance: Balance<Collateral>, 
    }

    /// Event for Loan creation
    public struct LoanCreated has copy, drop {
        loan_id: ID,
        borrower: address,
        lender: address,
        amount: u64,
        asset_type: std::ascii::String,
        collateral_type: std::ascii::String,
        collateral_amount: u64,
    }

    public struct LoanRepaid has copy, drop {
        loan_id: ID,
        repayer: address,
        amount: u64,
        interest_paid: u64,
    }

    public struct LoanLiquidated has copy, drop {
        loan_id: ID,
        liquidator: address,
        repayment_amount: u64,
        collateral_seized: u64,
    }

    /// Create a new loan object with locked collateral.
    public fun create_loan<Asset, Collateral>(
        borrower: address,
        lender: address,
        amount: u64,
        interest_rate_bps: u64,
        start_timestamp: u64,
        duration: u64,
        collateral_balance: Balance<Collateral>,
        ctx: &mut TxContext
    ): Loan<Asset, Collateral> {
        let collateral_amount = balance::value(&collateral_balance);
        let loan = Loan {
            id: object::new(ctx),
            borrower,
            lender,
            amount,
            interest_rate_bps,
            start_timestamp,
            duration,
            collateral_balance,
        };

        event::emit(LoanCreated {
            loan_id: object::id(&loan),
            borrower,
            lender,
            amount,
            asset_type: type_name::get<Asset>().into_string(),
            collateral_type: type_name::get<Collateral>().into_string(),
            collateral_amount,
        });

        loan
    }

    /// Calculate total debt (Principal + Interest) at current time.
    /// Formula: Principal + (Principal * Rate * Time / 365 days / 10000 bps)
    public fun calculate_debt<Asset, Collateral>(
        loan: &Loan<Asset, Collateral>,
        clock: &Clock
    ): u64 {
        let current_time = clock::timestamp_ms(clock);
        
        // If before start (shouldn't happen), distinct 0 interest
        if (current_time <= loan.start_timestamp) {
            return loan.amount
        };

        let time_elapsed_ms = current_time - loan.start_timestamp;
        
        // Rate is BPS (10000 = 100%)
        // Milliseconds in a Year = 31,536,000,000 (365 * 24 * 60 * 60 * 1000)
        let year_ms = 31536000000;
        
        // Handling overflow: cast to u128 for intermediate calculation
        let principal = (loan.amount as u128);
        let rate = (loan.interest_rate_bps as u128);
        let time = (time_elapsed_ms as u128);
        
        // Interest = P * R * T / (10000 * YearMS)
        let interest = (principal * rate * time) / (10000 * year_ms);
        
        loan.amount + (interest as u64)
    }

    /// Repay a loan with Real Interest Calculation.
    /// Excess payment above the debt is refunded to the caller.
    public entry fun repay<Asset, Collateral>(
        loan: Loan<Asset, Collateral>,
        mut payment: Coin<Asset>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let amount_paid = coin::value(&payment);
        let total_debt = calculate_debt(&loan, clock);

        // Strict check: Payment must cover total debt
        assert!(amount_paid >= total_debt, 0);

        let interest_paid = total_debt - loan.amount;

        let Loan {
            id,
            borrower,
            lender,
            amount: _,
            interest_rate_bps: _,
            start_timestamp: _,
            duration: _,
            collateral_balance
        } = loan;

        let loan_id = object::uid_to_inner(&id);
        object::delete(id);

        event::emit(LoanRepaid {
            loan_id,
            repayer: tx_context::sender(ctx),
            amount: total_debt,
            interest_paid,
        });

        // 1. Refund any overpayment back to the caller
        let sender = tx_context::sender(ctx);
        if (amount_paid > total_debt) {
            let refund = coin::split(&mut payment, amount_paid - total_debt, ctx);
            transfer::public_transfer(refund, sender);
        };

        // 2. Send debt payment to Lender
        transfer::public_transfer(payment, lender);

        // 3. Return Collateral to Borrower
        let collateral = coin::from_balance(collateral_balance, ctx);
        transfer::public_transfer(collateral, borrower);
    }

    /// Liquidate a Defaulted Loan (Time-based).
    /// If the loan is overdue (current time > start + duration), 
    /// anyone can liquidate it by paying the debt.
    /// The Liquidator gets the Collateral (Arbitrage opportunity).
    /// The Lender gets their Principal + Interest.
    public entry fun liquidate_defaulted_loan<Asset, Collateral>(
        loan: Loan<Asset, Collateral>,
        mut payment: Coin<Asset>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        // 1. Check if Defaulted (Overdue)
        assert!(current_time > loan.start_timestamp + loan.duration, 1);

        // 2. Calculate Debt
        let total_debt = calculate_debt(&loan, clock);
        let amount_paid = coin::value(&payment);
        assert!(amount_paid >= total_debt, 0);

        // 3. Destructure Loan
        let Loan {
            id,
            borrower: _,
            lender,
            amount: _,
            interest_rate_bps: _,
            start_timestamp: _,
            duration: _,
            collateral_balance
        } = loan;

        let loan_id = object::uid_to_inner(&id);
        let collateral_amount = balance::value(&collateral_balance);
        object::delete(id);

        // 4. Refund any overpayment to the liquidator
        let sender = tx_context::sender(ctx);
        if (amount_paid > total_debt) {
            let refund = coin::split(&mut payment, amount_paid - total_debt, ctx);
            transfer::public_transfer(refund, sender);
        };

        // 5. Pay Lender
        transfer::public_transfer(payment, lender);

        // 6. Seize Collateral (Give to Liquidator)
        let collateral = coin::from_balance(collateral_balance, ctx);
        transfer::public_transfer(collateral, sender);

        event::emit(LoanLiquidated {
            loan_id,
            liquidator: sender,
            repayment_amount: total_debt,
            collateral_seized: collateral_amount,
        });
    }

    /// Unwraps the loan for external liquidation (e.g. via DeepBook).
    /// Returns (collateral_balance, total_debt, lender_address)
    /// Can only be called if the loan is defaulted.
    public fun unwrap_for_liquidation<Asset, Collateral>(
        loan: Loan<Asset, Collateral>,
        clock: &Clock
    ): (Balance<Collateral>, u64, address) {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time > loan.start_timestamp + loan.duration, 1); // EDefaulted

        let total_debt = calculate_debt(&loan, clock);
        
        let Loan { 
            id, 
            borrower: _, 
            lender, 
            amount: _, 
            interest_rate_bps: _, 
            start_timestamp: _, 
            duration: _, 
            collateral_balance 
        } = loan;

        object::delete(id);
        
        (collateral_balance, total_debt, lender)
    }

}
