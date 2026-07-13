# Market Predictor

A personal real-time market research dashboard prototype.

This first version runs without paid data feeds or external dependencies. It simulates a streaming market feed, calculates technical indicators, creates research/catalyst scores, stores signal history, and updates the dashboard continuously.

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
- Stores generated signal events in `data/signals.jsonl`.
- Shows a live dashboard with ranked opportunities, signal rationale, filters, and research details.

## Next Data Provider Layer

The current feed lives in `src/marketData.js`. Replace or extend that adapter with a real provider such as Polygon, Alpaca, IEX Cloud, Finnhub, Nasdaq Data Link, or a broker feed.

The scoring logic lives in `src/researchEngine.js` and `src/technicalIndicators.js`.
