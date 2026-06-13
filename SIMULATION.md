# Equinox PLP+Hedge Vault — Strategy Simulation

Back-test over **2000 real settled BTC expiries** (most recent window) from the
DeepBook Predict indexer. Avg expiry 24.4 min. Capital 100.000 dUSDC.

## Calibration (data-driven)
- Realized per-epoch σ: 0.266%
- PLP net carry: 0.0011%/epoch (calibrated to ~20% base APY)
- Short-gamma coeff γ: 0.4 (99th-pct move costs ~3× carry)
- Hedge strike: 0.67% OTM down (≈2.5σ); premium 3.9c; budget ≈9.5%/yr

## Results

### Base case (real sub-hour moves)

| Strategy | Total return | APY | Max drawdown | Worst epoch |
| --- | --- | --- | --- | --- |
| Raw PLP | +1.71% | +20.00% | 0.05% | -0.03% |
| PLP + Hedge | +1.12% | +12.75% | 0.03% | -0.02% |

Hedge triggered on 27 / 2000 epochs.

### Stress test (3× volatility regime)

| Strategy | Total return | APY | Max drawdown | Worst epoch |
| --- | --- | --- | --- | --- |
| Raw PLP | -2.47% | -23.59% | 2.61% | -0.24% |
| PLP + Hedge | -0.65% | -6.76% | 1.00% | -0.23% |

Hedge triggered on 240 / 2000 epochs.

## Takeaway
The hedge trades a slice of steady carry for a smaller left tail. On the **real** move
series it cuts max drawdown from 0.05% (raw PLP) to 0.03%
(PLP+Hedge) — a 53% reduction — at a carry cost
(+20.00% → +12.75% APY).
Under the **3× vol-regime stress** the gap widens: raw PLP drawdown balloons to
2.61% while PLP+Hedge holds at 1.00% and the worst epoch
improves from -0.24% to -0.23%. That asymmetry — give up a
little carry, cap the crash — is the product: "PLP yield minus crash insurance", a
bounded-drawdown wrapper that is easier to sell to outside LPs than raw short-vol PLP.

_The BTC move series is real settlement data. PLP per-epoch PnL is modeled as a maker_
_carry minus a short-gamma loss; γ and carry are calibrated from the realized move_
_distribution. Calibrate against live `/predicts/:id/vault/performance` before trusting_
_absolute APY. The 3× stress amplifies the real move series; it is labeled as such._
