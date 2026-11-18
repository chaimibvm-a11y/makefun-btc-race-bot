// Dip-buying BTC bot for make.fun's "Race a BTC trading bot live for 24 hours".
//
// The bot trades one symbol, CBBTC (Coinbase Wrapped BTC), on 1-minute bars,
// with 1,000 USDC of paper money, long only. The harness speaks
// agent-fun/bars-replay/v1: it sends hello once, then one batch per minute
// (each batch carries the bar that just closed, the fills of the orders sent
// on the previous batch, and the account), and the bot answers every batch
// with exactly one reply carrying its orders. Orders decided on a batch fill
// at the next bar's open, paying a 4 bps fee, 2 bps of slippage and the
// pool's price impact, so a trade has to catch a move bigger than that.
//
// Strategy, found by grading candidates on the published dev window (where
// BTC fell 2.8% and every house baseline lost money): buy the dip and let
// the bounce pay. A bar's close 100 bps below its 30-bar average is a dip
// worth buying with all the cash. Once in, sell half the position when its
// value is 100 bps above its cost, then let the rest ride behind a 60 bps
// trailing stop off the highest close since entry. A 200 bps hard stop
// against cost caps any one trade. The bot never reads the clock, the
// environment or any file: every decision is a pure function of the bars
// it has been sent, so two runs on the same data send the same orders.
//
// Verified by grading locally on the published dev window
// (node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process):
// net PnL +8.06 USDC, 4 trades, max drawdown 1.5%, deterministic (the
// regrade reproduced the action log byte for byte). The dev gate needs a
// net PnL above 0, so this bot races.

import { BPS, runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const SMA_BARS = 30; // bars in the average a dip is measured against
const DIP_BPS = 100n; // buy when the close is this far below the average
const TAKE_BPS = 100n; // sell half when the position is this far above cost
const TRAIL_BPS = 60n; // sell the rest when the close trails the peak by this
const STOP_BPS = 200n; // sell everything when the position is this far below cost
const MAX_SLIP_BPS = 150; // never accept a fill further than this from the last close
const MIN_NOTIONAL = 1_000_000n; // a buy must spend at least 1 USDC

const closes: bigint[] = []; // closes of CBBTC, in the order the batches sent them
let peak = 0n; // highest close since the current position opened
let entryQty: bigint | null = null; // quantity held just after the buy filled, or null

function onBatch(state: BarsState, batch: Batch): OrderInput[] {
  const bar = batch.bars.find((b) => b.symbol === SYMBOL);
  if (!bar) return [];
  const close = BigInt(bar.c);
  closes.push(close);

  if (state.warmingUp) {
    // Warm-up bars build history only; orders on them are rejected.
    return [];
  }

  const holding = state.positions.get(SYMBOL);
  const qty = holding ? holding.qty : 0n;

  if (qty === 0n) {
    entryQty = null;
    peak = close;
    if (closes.length >= SMA_BARS) {
      let sum = 0n;
      for (let i = closes.length - SMA_BARS; i < closes.length; i++) sum += closes[i];
      // The close is DIP_BPS below the 30-bar mean, compared exactly:
      // close * n * 10000 < sum * (10000 - DIP_BPS).
      if (close * BigInt(SMA_BARS) * BPS < sum * (BPS - DIP_BPS)) {
        const room = state.weightRoom(SYMBOL);
        const amount = state.cash < room ? state.cash : room;
        if (amount >= MIN_NOTIONAL) {
          return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: amount, max_slippage_bps: MAX_SLIP_BPS }];
        }
      }
    }
    return [];
  }

  if (entryQty === null) {
    entryQty = qty;
    peak = close;
  }
  if (close > peak) peak = close;

  const cost = holding!.cost;
  const value = state.value(SYMBOL, qty);

  // Hard stop: the position has fallen too far below what it cost.
  if (value * BPS <= cost * (BPS - STOP_BPS)) {
    return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIP_BPS }];
  }

  // First exit: bank half once the position is TAKE_BPS above its cost.
  // A position of one unit cannot be halved, so sell it whole instead of
  // sending a zero-quantity order the harness would refuse.
  if (qty === entryQty && value * BPS >= cost * (BPS + TAKE_BPS)) {
    return [{ side: 'sell', symbol: SYMBOL, qty: qty > 1n ? qty / 2n : qty, max_slippage_bps: MAX_SLIP_BPS }];
  }

  // Second exit: the rest rides behind a trailing stop off the peak close.
  if (qty < entryQty && close * BPS <= peak * (BPS - TRAIL_BPS)) {
    return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIP_BPS }];
  }

  return [];
}

await runBars({ onBatch });
