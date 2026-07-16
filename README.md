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

- Scans a broad configurable market universe, ranks top candidates, then deeply researches a bounded set.
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
ALPACA_FALLBACK_TO_MOCK=true
MARKET_SYMBOLS=NVDA,AMD,TSLA,PLTR,SOFI,COIN,SMCI,RIVN,HOOD,MSTR
ENABLE_UNIVERSE_SCAN=true
SCAN_MAX_UNIVERSE=100
SCAN_DEEP_CANDIDATES=20
SCAN_DASHBOARD_LIMIT=12
```

This app currently uses Alpaca for market data only. It does not place orders.
If Alpaca returns no usable bars, the app falls back to mock data by default so the dashboard still runs. Set `ALPACA_FALLBACK_TO_MOCK=false` if you want startup to fail loudly instead.

For Polygon/Massive free-plan testing, use:

```bash
MARKET_DATA_PROVIDER=polygon
POLYGON_API_KEY=your_key_here
POLYGON_FALLBACK_TO_MOCK=true
POLYGON_INIT_SYMBOL_LIMIT=5
POLYGON_FETCH_INTERVAL_MS=60000
MARKET_SYMBOLS=NVDA,AMD,TSLA,PLTR,SOFI,COIN,SMCI,RIVN,HOOD,MSTR
```

The free stock plan has tight call limits, so the provider only tries a small real-data seed by default and uses mock fallback for the rest. Increase `POLYGON_INIT_SYMBOL_LIMIT` only if your plan can handle the extra requests.

Optional SEC research requests use `SEC_USER_AGENT`. Set it to a real contact string if you enable SEC ingestion heavily:

```bash
ENABLE_SEC_INGESTION=true
SEC_USER_AGENT="Market Predictor personal research your-email@example.com"
```

Provider creation lives in `src/providers/providerFactory.js`. The mock provider lives in `src/providers/mockProvider.js`. Add a real provider such as Polygon, Alpaca, IEX Cloud, Finnhub, Nasdaq Data Link, or a broker feed behind the same provider methods:

- `profiles()`
- `history()`
- `nextCandles()`
- `researchEvents(symbol, technical)`

The scoring logic lives in `src/researchEngine.js` and `src/technicalIndicators.js`.

## Data Privacy

Generated market-memory data is ignored by git through `.gitignore`. Keep API keys in `.env` or your shell environment, never in source files.
