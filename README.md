# Solo Mining Calculator

Calculate your probability of solo mining a Bitcoin block based on your hashrate.

**Live:** [solo.turtlecute.org](https://solo.turtlecute.org)

## Features

- Real-time odds calculation based on your hashrate vs network hashrate
- Probability of finding a block in 1 day, 1 week, 1 month, and 1 year
- Live Bitcoin network stats (difficulty, block height, hashrate, block reward)
- BTC price integration with offline cache fallback
- Responsive dark theme

## How It Works

Uses the Poisson probability distribution to calculate the likelihood of mining at least one block in a given timeframe:

```
P(at least 1 block) = 1 - e^(-lambda)
lambda = (time_seconds / 600) * (your_hashrate / network_hashrate)
```

## Data Sources

- [Mempool.space](https://mempool.space) - Network hashrate, difficulty, block height
- [CoinGecko](https://www.coingecko.com) - BTC/USD price

## Tech Stack

Static site: vanilla HTML, CSS, and JavaScript. Hosted on GitHub Pages.

## License

MIT
