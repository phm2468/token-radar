# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/phm2468/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/phm2468/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every pre-token protocol in the sealed DefiLlama snapshot, ranked by the value its token would plausibly launch at — plus the farm plan for each one.

## The model (radar-2)

One function scores every row; no protocol name is special-cased.

```
implied = round( tvl_usd × category_multiple × growth_multiplier × maturity_multiplier )
```

- **category_multiple** — calibrated from the snapshot itself: for each category, the median market-cap/TVL ratio of the protocols in that category whose token already trades, clamped to [0.04, 2.0]. A category with fewer than three traded peers falls back to the global median. Lending markets price at ×0.13 of TVL, DEXes at ×0.34, canonical bridges at ×0.75 — the board prices each pre-token protocol the way the market already prices its traded peers, instead of one flat multiple for everything.
- **growth_multiplier** — `1 + clamp(change_7d, −60, 120) / 100 × 0.5`, from the snapshot's seven-day TVL change.
- **maturity_multiplier** — `0.6 + min(age_days, 1095) / 1095 × 0.4`; age is how long the protocol has run with no token.

The board covers the full 40-protocol watchlist (≥ $50M TVL, no token) and adds 160 early pre-token protocols below the floor — 200 rows, each with a six-step farm plan matched to its category. Live-token protocols are set aside in their own view with the market's own numbers.

## Run it

```sh
node main.ts --input <snapshot.json>
```

Writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory (`/output`, or `$MAKEFUN_OUTPUT_DIR`). The dashboard is a static page — no network, no build step — with search, category filters, sortable columns, a per-protocol detail view that recomputes its own row, and a live-token tab.

## License

MIT — see [LICENSE](LICENSE).
