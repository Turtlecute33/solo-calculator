# Solo Mining Calculator

Calculate your probability of solo mining a block for Bitcoin, Monero, and Bitcoin Cash.

**Live:** [solo.turtlecute.org](https://solo.turtlecute.org)

## Features

- **Block Odds Calculator** — enter your hashrate and see your chance of finding a block in 1 day, 1 week, 1 month, and 1 year
- **Best Share Checker** — paste your best share difficulty to see if it was enough to solo mine a block
- Supports **BTC** (SHA-256), **BCH** (SHA-256), and **XMR** (RandomX)
- Live network stats: hashrate, difficulty, block height, block reward, price
- Offline-capable with localStorage caching
- Responsive dark theme, no external dependencies

## How It Works

### Block Odds

Uses a linear estimate based on your hashrate share of the network:

```
per_block_odds = your_hashrate / network_hashrate
daily_odds = (86400 / block_time) * per_block_odds
```

### Best Share

Compares your share difficulty against the current network difficulty:

```
percentage = (share_difficulty / network_difficulty) * 100%
block_found = percentage >= 100%
```

## Coin Defaults

| Coin | Algorithm | Block Time | Block Reward | Hashrate Unit |
|------|-----------|------------|--------------|---------------|
| BTC  | SHA-256   | 10 min     | 3.125 BTC (halving) | TH/s |
| BCH  | SHA-256   | 10 min     | 3.125 BCH (halving) | TH/s |
| XMR  | RandomX   | 2 min      | 0.6 XMR (tail emission) | KH/s |

## Data Sources

- [Mempool.space](https://mempool.space) — BTC network hashrate, difficulty, block height (primary for BTC)
- [Blockchair](https://blockchair.com) — Network stats for all coins (primary for BCH/XMR, fallback for BTC)
- [CoinGecko](https://www.coingecko.com) — USD price data

## Tech Stack

Static site: vanilla HTML, CSS, and JavaScript. No build step. Hosted on GitHub Pages with custom domain.

## License

MIT
