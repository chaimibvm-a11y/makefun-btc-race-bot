# makefun-btc-race-bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/chaimibvm-a11y/makefun-btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/chaimibvm-a11y/makefun-btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A dip-buying trading bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty. It trades Coinbase Wrapped BTC (cbBTC) on 1-minute on-chain prices with $1,000 of paper money, so nothing is traded for real.

## Strategy

On the published dev window BTC fell 2.8% and every house baseline lost money, so the bot does not chase trends and never holds through a falling market. It buys the dip and lets the bounce pay:

- **Buy:** when a bar's close is 100 bps below its 30-bar average, buy with all the cash.
- **First exit:** sell half the position when its value is 100 bps above its cost.
- **Second exit:** let the rest ride behind a 60 bps trailing stop off the highest close since entry.
- **Hard stop:** sell everything if the position falls 200 bps below its cost.

Every decision is a pure function of the bars the harness sends, so two runs on the same data send the same orders. The bot uses only the Python standard library plus the vendored `vendor/makefun_bars.py` shim from the competition kit.

## Run it

```sh
python3 -P -s main.py
```

The harness speaks agent-fun/bars-replay/v1 over stdin/stdout: hello once, then one batch per minute, one reply per batch. Grade it locally with the competition kit:

```sh
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=haayh57w&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
