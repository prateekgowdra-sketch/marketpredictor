import { configuredSymbols } from "../config.js";
import { companyProfiles as mockProfiles, MockMarketProvider } from "./mockProvider.js";

function toCandle(bar) {
  return {
    time: new Date(bar.t).getTime(),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v ?? 0
  };
}

function fallbackProfile(symbol) {
  return mockProfiles[symbol] ?? {
    symbol,
    company: symbol,
    sector: "Unknown",
    marketCap: "unknown",
    beta: 1.4
  };
}

export class AlpacaMarketProvider {
  constructor() {
    this.name = "alpaca";
    this.symbols = configuredSymbols();
    this.state = new Map();
    this.mockProvider = new MockMarketProvider();
    this.mockSymbols = new Set();
    this.realSymbols = new Set();
    this.requestFailures = 0;
    this.tick = 0;
    this.lastFetchAt = 0;
    this.dataBaseUrl = process.env.ALPACA_DATA_BASE_URL ?? "https://data.alpaca.markets";
    this.feed = process.env.ALPACA_DATA_FEED ?? "iex";
    this.fetchIntervalMs = Number(process.env.ALPACA_FETCH_INTERVAL_MS ?? 15000);
    this.headers = {
      "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
      "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? ""
    };

    if (!this.headers["APCA-API-KEY-ID"] || !this.headers["APCA-API-SECRET-KEY"]) {
      throw new Error("Missing ALPACA_API_KEY or ALPACA_SECRET_KEY in .env.");
    }
  }

  async init() {
    const end = new Date();
    const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 10);
    const params = new URLSearchParams({
      symbols: this.symbols.join(","),
      timeframe: "1Min",
      start: start.toISOString(),
      end: end.toISOString(),
      limit: "1000",
      adjustment: "raw",
      feed: this.feed
    });

    const payload = await this.request(`/v2/stocks/bars?${params}`);
    const activeSymbols = [];
    const mockHistory = this.mockProvider.history();
    for (const symbol of this.symbols) {
      const bars = payload.bars?.[symbol] ?? [];
      const candles = bars.map(toCandle).slice(-180);
      if (candles.length < 2) {
        console.warn(`Using mock fallback for ${symbol}: Alpaca returned ${candles.length} usable bars.`);
        this.state.set(symbol, [...(mockHistory.get(symbol) ?? [])]);
        this.mockSymbols.add(symbol);
        activeSymbols.push(symbol);
        continue;
      }
      this.state.set(symbol, candles);
      this.realSymbols.add(symbol);
      activeSymbols.push(symbol);
    }

    this.symbols = activeSymbols;

    if (this.symbols.length === 0) {
      throw new Error(
        "Alpaca did not return usable bars for any configured symbols. Check ALPACA_DATA_FEED, your plan, and whether your API key has market data access."
      );
    }
  }

  profiles() {
    return this.symbols.map(fallbackProfile);
  }

  history() {
    return this.state;
  }

  dataQuality(symbol) {
    const isFallback = this.mockSymbols.has(symbol);
    return {
      symbol,
      source: isFallback ? "mock" : "alpaca",
      tier: isFallback ? "fallback" : "intraday",
      label: isFallback ? "Fallback" : "Alpaca",
      isRealData: !isFallback,
      isRealTimeTrusted: !isFallback,
      note: isFallback ? "Alpaca returned no usable bars; using simulation fallback." : `Alpaca ${this.feed} intraday feed`
    };
  }

  health() {
    return {
      provider: this.name,
      trackedSymbols: this.symbols.length,
      realSymbols: this.realSymbols.size,
      fallbackSymbols: this.mockSymbols.size,
      delayedSymbols: 0,
      rateLimitSkips: 0,
      requestFailures: this.requestFailures,
      refreshIntervalMs: this.fetchIntervalMs,
      note: this.mockSymbols.size
        ? "Some symbols are using fallback because Alpaca did not return usable market bars."
        : "All tracked symbols are using Alpaca data."
    };
  }

  ensureSymbols(symbols, profileForSymbol) {
    const mockHistory = this.mockProvider.history();
    for (const symbol of symbols) {
      if (this.state.has(symbol)) continue;
      const profile = profileForSymbol(symbol);
      this.mockProvider.ensureSymbol(symbol, profile);
      this.state.set(symbol, [...(mockHistory.get(symbol) ?? [])]);
      this.mockSymbols.add(symbol);
      this.symbols.push(symbol);
    }
    this.symbols = [...new Set(this.symbols)];
  }

  async nextCandles() {
    this.tick += 1;
    const mockUpdates = this.mockProvider.nextCandles().updates;
    for (const update of mockUpdates) {
      if (this.mockSymbols.has(update.symbol)) {
        this.state.set(update.symbol, update.candles);
      }
    }

    const shouldFetch = Date.now() - this.lastFetchAt >= this.fetchIntervalMs;
    if (shouldFetch) {
      await this.refreshLatestBars();
      this.lastFetchAt = Date.now();
    }

    return {
      tick: this.tick,
      updates: [...this.state.entries()].map(([symbol, candles]) => ({
        symbol,
        candle: candles.at(-1),
        candles
      }))
    };
  }

  async refreshLatestBars() {
    const params = new URLSearchParams({
      symbols: this.symbols.join(","),
      feed: this.feed
    });
    const payload = await this.request(`/v2/stocks/bars/latest?${params}`);
    const bars = payload.bars ?? {};

    for (const symbol of this.symbols) {
      const latest = bars[symbol];
      if (!latest) continue;
      const candle = toCandle(latest);
      const candles = this.state.get(symbol);
      const previous = candles.at(-1);
      if (!previous || previous.time !== candle.time) {
        candles.push(candle);
        if (candles.length > 180) candles.shift();
      }
    }
  }

  researchEvents(symbol, technical) {
    const events = [];
    const ts = new Date().toISOString();

    if (technical.relativeVolume > 1.4) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "volume",
        title: `${symbol} elevated live relative volume`,
        strength: 16,
        raw: { relativeVolume: technical.relativeVolume }
      });
    }

    if (technical.breakoutPressure > 0.997) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "technical",
        title: `${symbol} pressing recent high on Alpaca data`,
        strength: 15,
        raw: { breakoutPressure: technical.breakoutPressure }
      });
    }

    if (technical.priceChange > 0.004) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "momentum",
        title: `${symbol} positive latest-bar momentum`,
        strength: 12,
        raw: { priceChange: technical.priceChange }
      });
    }

    return events;
  }

  async request(pathname) {
    const response = await fetch(`${this.dataBaseUrl}${pathname}`, {
      headers: this.headers
    });

    if (!response.ok) {
      this.requestFailures += 1;
      const body = await response.text();
      throw new Error(`Alpaca request failed ${response.status}: ${body}`);
    }

    return response.json();
  }
}
