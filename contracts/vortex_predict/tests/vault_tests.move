#[test_only]
module vortex_predict::vault_tests {
    use sui::test_scenario as ts;
    use sui::test_utils;
    use sui::coin::{Self, TreasuryCap};
    use sui::sui::SUI;

    use vortex_predict::vault::{Self, PredictVault};
    use vortex_predict::vault_share::{Self, VAULT_SHARE};

    const KEEPER: address = @0xCAFE;
    const USER: address = @0xBEEF;

    // RFC 8032 Ed25519 test vector (TEST 2): a known (pubkey, message, signature) triple
    // used to exercise on-chain signature verification deterministically.
    fun rfc_pubkey(): vector<u8> {
        x"3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c"
    }
    fun rfc_message(): vector<u8> { x"72" }
    fun rfc_signature(): vector<u8> {
        x"92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00"
    }

    fun setup_vault(scenario: &mut ts::Scenario, pubkey: vector<u8>) {
        vault_share::init_for_testing(ts::ctx(scenario));
        ts::next_tx(scenario, KEEPER);
        let treasury = ts::take_from_sender<TreasuryCap<VAULT_SHARE>>(scenario);
        vault::create_vault<SUI>(treasury, KEEPER, pubkey, ts::ctx(scenario));
    }

    #[test]
    fun test_deposit_mints_shares_one_to_one() {
        let mut scenario = ts::begin(KEEPER);
        setup_vault(&mut scenario, rfc_pubkey());

        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<PredictVault<SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000, ts::ctx(&mut scenario));
            let shares = vault::deposit(&mut vault, payment, ts::ctx(&mut scenario));

            assert!(coin::value(&shares) == 1_000_000, 0);
            assert!(vault::total_shares(&vault) == 1_000_000, 1);
            assert!(vault::idle_balance(&vault) == 1_000_000, 2);

            test_utils::destroy(shares);
            ts::return_shared(vault);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_withdraw_proportional_on_idle() {
        let mut scenario = ts::begin(KEEPER);
        setup_vault(&mut scenario, rfc_pubkey());

        ts::next_tx(&mut scenario, USER);
        {
            let mut vault = ts::take_shared<PredictVault<SUI>>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000, ts::ctx(&mut scenario));
            let mut shares = vault::deposit(&mut vault, payment, ts::ctx(&mut scenario));

            // Withdraw half the shares -> half the idle balance.
            let half = coin::split(&mut shares, 400_000, ts::ctx(&mut scenario));
            let out = vault::withdraw(&mut vault, half, ts::ctx(&mut scenario));
            assert!(coin::value(&out) == 400_000, 0);
            assert!(vault::total_shares(&vault) == 600_000, 1);
            assert!(vault::idle_balance(&vault) == 600_000, 2);

            test_utils::destroy(out);
            test_utils::destroy(shares);
            ts::return_shared(vault);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_signature_verifies_with_valid_vector() {
        let mut scenario = ts::begin(KEEPER);
        setup_vault(&mut scenario, rfc_pubkey());

        ts::next_tx(&mut scenario, KEEPER);
        {
            let vault = ts::take_shared<PredictVault<SUI>>(&scenario);
            // Should NOT abort: valid RFC 8032 signature for the registered key.
            vault::verify_for_testing(&vault, rfc_message(), rfc_signature());
            ts::return_shared(vault);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 3, location = vortex_predict::vault)]
    fun test_signature_rejects_tampered() {
        let mut scenario = ts::begin(KEEPER);
        setup_vault(&mut scenario, rfc_pubkey());

        ts::next_tx(&mut scenario, KEEPER);
        {
            let vault = ts::take_shared<PredictVault<SUI>>(&scenario);
            // Flip the message: the RFC signature must no longer verify (EBadSignature = 3).
            vault::verify_for_testing(&vault, x"73", rfc_signature());
            ts::return_shared(vault);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_strategist_message_layout_stable() {
        let mut scenario = ts::begin(KEEPER);
        setup_vault(&mut scenario, rfc_pubkey());

        ts::next_tx(&mut scenario, KEEPER);
        {
            let vault = ts::take_shared<PredictVault<SUI>>(&scenario);
            // 1 (tag) + 32 (vault id) + 8 (nonce) + 8 (amount) = 49 bytes.
            let msg = vault::supply_message_for_testing(&vault, 1, 1_000_000);
            assert!(vector::length(&msg) == 49, 0);
            assert!(*vector::borrow(&msg, 0) == 1, 1); // TAG_SUPPLY
            ts::return_shared(vault);
        };
        ts::end(scenario);
    }
}
