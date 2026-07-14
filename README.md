# Market Predictor

A personal real-time market research dashboard prototype.

This first version runs without paid data feeds or external dependencies. It simulates a streaming market feed, calculates technical indicators, creates research/catalyst scores, stores signal and outcome history in SQLite, and updates the dashboard continuously.

## Run

```bash
npm run dev
```

Open:

```text
http://localhost:3001
```

## What It Does Now

- Streams continuously updating ticker data through Server-Sent Events.
- Calculates early technical features: RSI, MACD, VWAP, ATR, moving-average trend, relative volume, breakout pressure.
- Scores opportunities using technical setup, catalyst strength, momentum, volume, volatility, and risk.
- Stores generated candles, research events, signals, outcomes, and model-run metadata in `data/market-predictor.sqlite`.
- Tracks simulated post-signal outcomes for 5 minute, 15 minute, and 1 hour horizons.
- Exposes early backtest/learning-loop summaries through `/api/backtest`.
- Shows a live dashboard with ranked opportunities, signal rationale, filters, and research details.

## Next Data Provider Layer

The active provider is selected by `MARKET_DATA_PROVIDER`. The current default is:

```bash
MARKET_DATA_PROVIDER=mock
```

For Alpaca paper/data mode, create `.env`:

```bash
MARKET_DATA_PROVIDER=alpaca
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here
ALPACA_PAPER=true
ALPACA_DATA_FEED=iex
MARKET_SYMBOLS=NVDA,AMD,TSLA,PLTR,SOFI,COIN,SMCI,RIVN,HOOD,MSTR
```

This app currently uses Alpaca for market data only. It does not place orders.

Provider creation lives in `src/providers/providerFactory.js`. The mock provider lives in `src/providers/mockProvider.js`. Add a real provider such as Polygon, Alpaca, IEX Cloud, Finnhub, Nasdaq Data Link, or a broker feed behind the same provider methods:

- `profiles()`
- `history()`
- `nextCandles()`
- `researchEvents(symbol, technical)`

The scoring logic lives in `src/researchEngine.js` and `src/technicalIndicators.js`.

## Data Privacy

Generated market-memory data is ignored by git through `.gitignore`. Keep API keys in `.env` or your shell environment, never in source files.
