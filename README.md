# Solo Mining Calculator

Calculate your probability of solo mining a block for Bitcoin, Monero, and Bitcoin Cash.

**Live:** [solo.turtlecute.org](https://solo.turtlecute.org)

## Features

- **Block Odds Calculator** — enter your hashrate and see your chance of finding at least one block in 1 day, 1 week, 1 month, and 1 year
- **Best Share Checker** — paste your best share difficulty to see if it was enough to solo mine a block
- Supports **BTC** (SHA-256), **BCH** (SHA-256), and **XMR** (RandomX)
- Live network stats: hashrate, difficulty, block height, block reward, price
- Multi-stage fallbacks: live APIs -> fresh cache -> stale cache -> built-in defaults
- GitHub Pages friendly paths with plain static `.html` routes
- Responsive dark theme, no external dependencies

## How It Works

### Block Odds

Uses a Poisson model for the probability of finding at least one block:

```
share_of_network = your_hashrate / network_hashrate
expected_blocks = (time_seconds / block_time) * share_of_network
probability = 1 - e^(-expected_blocks)
```

This is more stable than a linear estimate because it never exceeds 100%.

### Best Share

Compares your share difficulty against the current network difficulty:

```
percentage = (share_difficulty / network_difficulty) * 100%
block_found = percentage >= 100%
```

## Coin Defaults

| Coin | Algorithm | Default Input | Block Time | Block Reward | Hashrate Unit |
|------|-----------|---------------|------------|--------------|---------------|
| BTC  | SHA-256   | 200 TH/s | 10 min | 3.125 BTC (halving) | TH/s |
| BCH  | SHA-256   | 200 TH/s | 10 min | 3.125 BCH (halving) | TH/s |
| XMR  | RandomX   | 15 KH/s | 2 min | 0.6 XMR (tail emission) | KH/s |

Best Share defaults:

| Coin | Default Share Example |
|------|-----------------------|
| BTC  | 4.2 T |
| BCH  | 200 G |
| XMR  | 1 G |

The app also ships rounded fallback network snapshots for each coin so the UI remains usable when third-party APIs are down.

## Data Sources

- [Mempool.space](https://mempool.space) — BTC network hashrate, difficulty, block height (primary for BTC)
- [Blockchair](https://blockchair.com) — Network stats for all coins (primary for BCH/XMR, fallback for BTC)
- [CoinGecko](https://www.coingecko.com) — USD price data

## Tech Stack

Static site: vanilla HTML, CSS, and JavaScript. No build step. Hosted on GitHub Pages with a custom domain.

## Routes

- `/` -> `index.html`
- `/best-share.html` -> best share checker

Internal navigation uses relative links so the site works on:

- `https://solo.turtlecute.org/`
- `https://<user>.github.io/<repo>/`

The `404.html` page redirects extensionless `/best-share` requests to `best-share.html` for both deployment styles.

## License

MIT
