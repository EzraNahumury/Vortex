#!/usr/bin/env bash
# Make the deployed DeepBook Predict package linkable as a *published* dependency.
#
# The `predict-testnet-4-16` branch ships a Move.lock without testnet published ids, so
# `sui client publish` reports `deepbook_predict` as an unpublished dependency. This patches
# the cached git dependency's Move.toml with the on-chain published-at + address so publish
# links against the live package instead of trying to republish it.
#
# Usage:  bash setup-dep.sh   (run from contracts/vortex_predict)
# Then:   sui client publish --gas-budget 300000000 --allow-dirty
set -euo pipefail

PREDICT_ID="0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138"

# Ensure the dependency is fetched into the local cache.
sui move build >/dev/null 2>&1 || true

DEP="$(find "$HOME/.move" -path '*packages/predict/Move.toml' 2>/dev/null | head -1)"
if [ -z "$DEP" ]; then
  echo "ERROR: predict dependency not found in ~/.move cache. Run 'sui move build' once, then re-run." >&2
  exit 1
fi

cat > "$DEP" <<EOF
[package]
name = "deepbook_predict"
edition = "2024.beta"
version = "0.0.1"
published-at = "$PREDICT_ID"

[dependencies]
deepbook = { local = "../deepbook" }

[addresses]
deepbook_predict = "$PREDICT_ID"

[environments]
local = "b485d3e3"
EOF

echo "Patched: $DEP"
echo "published-at = $PREDICT_ID"
echo
echo "Now publish:  sui client publish --gas-budget 300000000 --allow-dirty"
