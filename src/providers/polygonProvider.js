import { configuredSymbols } from "../config.js";
import { companyProfiles as mockProfiles, MockMarketProvider } from "./mockProvider.js";

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function toCandle(bar) {
  return {
    time: bar.t,
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

export class PolygonMarketProvider {
  constructor() {
    this.name = "polygon";
    this.symbols = configuredSymbols();
    this.state = new Map();
    this.mockProvider = new MockMarketProvider();
    this.mockSymbols = new Set();
    this.realSymbols = new Set();
    this.rateLimitSkips = 0;
    this.requestFailures = 0;
    this.lastRefreshStatus = "Starting";
    this.tick = 0;
    this.lastFetchAt = 0;
    this.baseUrl = process.env.POLYGON_BASE_URL ?? "https://api.massive.com";
    this.apiKey = process.env.POLYGON_API_KEY ?? "";
    this.fetchIntervalMs = Number(process.env.POLYGON_FETCH_INTERVAL_MS ?? 60000);
    this.initSymbolLimit = Number(process.env.POLYGON_INIT_SYMBOL_LIMIT ?? 5);
    this.rangeDays = Number(process.env.POLYGON_RANGE_DAYS ?? 10);
    this.realTimeData = process.env.POLYGON_REALTIME_DATA === "true";

    if (!this.apiKey) {
      throw new Error("Missing POLYGON_API_KEY in .env.");
    }
  }

  async init() {
    const mockHistory = this.mockProvider.history();
    const symbolsToFetch = this.symbols.slice(0, this.initSymbolLimit);

    for (const symbol of this.symbols) {
      const mockCandles = [...(mockHistory.get(symbol) ?? [])];
      this.state.set(symbol, mockCandles);
      this.mockSymbols.add(symbol);
    }

    for (const symbol of symbolsToFetch) {
      try {
        const candles = await this.fetchMinuteCandles(symbol);
        if (candles.length < 2) {
          console.warn(`Using mock fallback for ${symbol}: Polygon returned ${candles.length} usable bars.`);
          continue;
        }
        this.state.set(symbol, candles);
        this.realSymbols.add(symbol);
        this.mockSymbols.delete(symbol);
        this.lastRefreshStatus = `Loaded ${symbol} from Polygon`;
      } catch (error) {
        console.warn(`Using mock fallback for ${symbol}: Polygon request failed: ${error.message}`);
      }
    }

    if (this.realSymbols.size === 0) {
      console.warn("Polygon did not return usable bars yet. Dashboard will run on mock fallback data.");
      this.lastRefreshStatus = "Using fallback data";
    }
  }

  profiles() {
    return this.symbols.map(fallbackProfile);
  }

  history() {
    return this.state;
  }

  dataQuality(symbol) {
    const isReal = this.realSymbols.has(symbol);
    if (!isReal) {
      return {
        symbol,
        source: "mock",
        tier: "fallback",
        label: "Fallback",
        isRealData: false,
        isRealTimeTrusted: false,
        note: "Polygon did not supply usable bars for this symbol; using simulation fallback."
      };
    }

    return {
      symbol,
      source: "polygon",
      tier: this.realTimeData ? "real-time" : "delayed",
      label: this.realTimeData ? "Polygon Real-Time" : "Polygon Delayed",
      isRealData: true,
      isRealTimeTrusted: this.realTimeData,
      note: this.realTimeData
        ? "Real-time Polygon data enabled."
        : "Real Polygon bars, but not marked as real-time day-trading data on this plan."
    };
  }

  health() {
    return {
      provider: this.name,
      trackedSymbols: this.symbols.length,
      realSymbols: this.realSymbols.size,
      fallbackSymbols: this.mockSymbols.size,
      delayedSymbols: this.realTimeData ? 0 : this.realSymbols.size,
      rateLimitSkips: this.rateLimitSkips,
      requestFailures: this.requestFailures,
      refreshIntervalMs: this.fetchIntervalMs,
      initSymbolLimit: this.initSymbolLimit,
      lastRefreshStatus: this.lastRefreshStatus,
      note: this.realTimeData
        ? "Polygon real-time mode is enabled by configuration."
        : "Free/test mode: real Polygon bars are treated as delayed and not trusted for true day-trading signals."
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
    if (shouldFetch && this.realSymbols.size > 0) {
      await this.refreshRealSymbols();
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

  async refreshRealSymbols() {
    for (const symbol of this.realSymbols) {
      try {
        const candles = await this.fetchMinuteCandles(symbol);
        if (candles.length >= 2) {
          this.state.set(symbol, candles);
        }
      } catch (error) {
        console.warn(`Polygon refresh skipped for ${symbol}: ${error.message}`);
      }
    }
  }

  async fetchMinuteCandles(symbol) {
    const end = new Date();
    const start = new Date(end.getTime() - this.rangeDays * 24 * 60 * 60 * 1000);
    const pathname = `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/minute/${dateOnly(start)}/${dateOnly(end)}`;
    const payload = await this.request(pathname, {
      adjusted: "true",
      sort: "asc",
      limit: "5000"
    });

    return (payload.results ?? []).map(toCandle).slice(-180);
  }

  researchEvents(symbol, technical) {
    const events = [];
    const ts = new Date().toISOString();
    const providerLabel = this.realSymbols.has(symbol) ? "Polygon" : "Polygon fallback";

    if (technical.relativeVolume > 1.35) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "volume",
        title: `${symbol} elevated relative volume on ${providerLabel}`,
        strength: 16,
        raw: { relativeVolume: technical.relativeVolume, realData: this.realSymbols.has(symbol) }
      });
    }

    if (technical.breakoutPressure > 0.997) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "technical",
        title: `${symbol} pressing recent high on ${providerLabel}`,
        strength: 15,
        raw: { breakoutPressure: technical.breakoutPressure, realData: this.realSymbols.has(symbol) }
      });
    }

    if (technical.priceChange > 0.004) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "momentum",
        title: `${symbol} positive latest-bar momentum on ${providerLabel}`,
        strength: 12,
        raw: { priceChange: technical.priceChange, realData: this.realSymbols.has(symbol) }
      });
    }

    return events;
  }

  async request(pathname, params = {}) {
    const url = new URL(pathname, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("apiKey", this.apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      this.requestFailures += 1;
      if (response.status === 429) {
        this.rateLimitSkips += 1;
        this.lastRefreshStatus = "Rate limited";
      } else {
        this.lastRefreshStatus = `Request failed ${response.status}`;
      }
      throw new Error(`Polygon request failed ${response.status}: ${body}`);
    }

    this.lastRefreshStatus = "Connected";
    return response.json();
  }
}
