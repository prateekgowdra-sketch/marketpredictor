const sectorCatalysts = {
  Semiconductors: ["AI infrastructure demand", "datacenter capex rotation", "chip supply-chain momentum"],
  "EV / Energy": ["delivery trend watch", "battery supply update", "energy-storage catalyst"],
  "Software / AI": ["enterprise AI demand", "government contract watch", "platform adoption signal"],
  Fintech: ["deposit growth watch", "credit quality signal", "consumer finance momentum"],
  "Crypto Infrastructure": ["bitcoin beta tailwind", "crypto volume expansion", "regulatory headline watch"],
  "AI Infrastructure": ["server demand cycle", "margin recovery watch", "datacenter buildout catalyst"],
  EV: ["production trend watch", "cash runway watch", "delivery update"],
  "Brokerage / Fintech": ["retail trading volume", "crypto activity tailwind", "asset growth watch"],
  "Bitcoin Treasury": ["bitcoin correlation", "treasury premium watch", "convertible debt catalyst"]
};

const cikBySymbol = {
  NVDA: "0001045810",
  AMD: "0000002488",
  TSLA: "0001318605",
  PLTR: "0001321655",
  SOFI: "0001818874",
  COIN: "0001679788",
  SMCI: "0001375365",
  RIVN: "0001874178",
  HOOD: "0001783879",
  MSTR: "0001050446"
};

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function seedFor(symbol, tick) {
  return [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), tick * 17);
}

function event(symbol, provider, type, title, strength, raw = {}) {
  return {
    symbol,
    ts: new Date().toISOString(),
    provider,
    type,
    title,
    strength,
    sentiment: raw.sentimentScore ?? 0,
    url: raw.url ?? null,
    raw
  };
}

export class ResearchIngestion {
  constructor() {
    this.name = "research-engine";
    this.lastTickBySymbol = new Map();
    this.secCache = new Map();
    this.newsCache = new Map();
    this.earningsCache = new Map();
    this.secTtlMs = Number(process.env.SEC_CACHE_MS ?? 1000 * 60 * 30);
    this.newsTtlMs = Number(process.env.POLYGON_NEWS_CACHE_MS ?? 1000 * 60 * 20);
    this.earningsTtlMs = Number(process.env.FINNHUB_EARNINGS_CACHE_MS ?? 1000 * 60 * 60 * 6);
    this.newsSymbolLimit = Number(process.env.POLYGON_NEWS_SYMBOL_LIMIT ?? 5);
    this.earningsSymbolLimit = Number(process.env.FINNHUB_EARNINGS_SYMBOL_LIMIT ?? 10);
    this.newsRequests = 0;
    this.earningsRequests = 0;
  }

  async eventsFor({ symbol, profile, technical, tick }) {
    const events = [];
    const seed = seedFor(symbol, tick);
    const sector = profile?.sector ?? "Unknown";
    const sectorItems = sectorCatalysts[sector] ?? ["company-specific catalyst watch"];

    if ((technical.rsi ?? 50) > 62 && technical.relativeVolume > 1.15) {
      events.push(
        event(symbol, this.name, "news", `${symbol} momentum plus volume catalyst watch`, 13, {
          rsi: technical.rsi,
          relativeVolume: technical.relativeVolume
        })
      );
    }

    if (technical.volatilityPct > 0.018 && technical.aboveVwap) {
      events.push(
        event(symbol, this.name, "volatility", `${symbol} volatility expansion above VWAP`, 10, {
          volatilityPct: technical.volatilityPct
        })
      );
    }

    if (seed % 31 === 0) {
      const title = sectorItems[seed % sectorItems.length];
      events.push(event(symbol, this.name, "sector", `${symbol} ${title}`, 11, { sector }));
    }

    if (seed % 47 === 0) {
      events.push(
        event(symbol, this.name, "sec", `${symbol} SEC filing watchlist check`, 9, {
          formTypes: ["8-K", "10-Q", "Form 4"],
          note: "Placeholder event until live SEC ingestion is enabled."
        })
      );
    }

    const secEvent = await this.latestSecFilingEvent(symbol);
    if (secEvent) events.push(secEvent);
    events.push(...(await this.latestPolygonNewsEvents(symbol)));
    events.push(...(await this.latestFinnhubEarningsEvents(symbol)));

    return events;
  }

  async latestSecFilingEvent(symbol) {
    if (process.env.ENABLE_SEC_INGESTION === "false") return null;
    const cik = cikBySymbol[symbol];
    if (!cik) return null;

    const cached = this.secCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < this.secTtlMs) {
      return cached.event;
    }

    try {
      const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: {
          "User-Agent": process.env.SEC_USER_AGENT ?? "Market Predictor personal research contact@example.com",
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        this.secCache.set(symbol, { fetchedAt: Date.now(), event: null });
        return null;
      }

      const payload = await response.json();
      const recent = payload.filings?.recent;
      const form = recent?.form?.[0];
      const filingDate = recent?.filingDate?.[0];
      const accession = recent?.accessionNumber?.[0];
      if (!form || !filingDate) {
        this.secCache.set(symbol, { fetchedAt: Date.now(), event: null });
        return null;
      }

      const ageMs = Date.now() - new Date(`${filingDate}T00:00:00Z`).getTime();
      if (ageMs > 1000 * 60 * 60 * 24 * 10) {
        this.secCache.set(symbol, { fetchedAt: Date.now(), event: null });
        return null;
      }

      const strength = form === "8-K" ? 13 : form === "10-Q" || form === "10-K" ? 11 : 8;
      const secEvent = event(symbol, "sec", "sec", `${symbol} recent ${form} filed ${filingDate}`, strength, {
        form,
        filingDate,
        accession,
        realCatalyst: true,
        url: accession
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${accession}-index.html`
          : null
      });
      this.secCache.set(symbol, { fetchedAt: Date.now(), event: secEvent });
      return secEvent;
    } catch {
      this.secCache.set(symbol, { fetchedAt: Date.now(), event: null });
      return null;
    }
  }

  async latestPolygonNewsEvents(symbol) {
    if (process.env.ENABLE_POLYGON_NEWS === "false") return [];
    if (!process.env.POLYGON_API_KEY) return [];

    const cached = this.newsCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < this.newsTtlMs) {
      return cached.events;
    }

    if (!cached && this.newsRequests >= this.newsSymbolLimit) {
      this.newsCache.set(symbol, { fetchedAt: Date.now(), events: [] });
      return [];
    }

    try {
      this.newsRequests += 1;
      const url = new URL("/v2/reference/news", process.env.POLYGON_BASE_URL ?? "https://api.massive.com");
      url.searchParams.set("ticker", symbol);
      url.searchParams.set("limit", process.env.POLYGON_NEWS_LIMIT ?? "3");
      url.searchParams.set("order", "desc");
      url.searchParams.set("sort", "published_utc");
      url.searchParams.set("apiKey", process.env.POLYGON_API_KEY);

      const response = await fetch(url);
      if (!response.ok) {
        this.newsCache.set(symbol, { fetchedAt: Date.now(), events: [] });
        return [];
      }

      const payload = await response.json();
      const events = (payload.results ?? []).slice(0, 3).map((article) => {
        const insight = (article.insights ?? []).find((item) => item.ticker === symbol) ?? article.insights?.[0] ?? {};
        const sentiment = insight.sentiment;
        const strength = sentiment === "positive" || sentiment === "negative" ? 18 : 12;
        return event(symbol, "polygon-news", "news", article.title, strength, {
          description: article.description,
          publisher: article.publisher?.name,
          publishedAt: article.published_utc,
          sentiment,
          sentimentScore: sentiment === "positive" ? 0.7 : sentiment === "negative" ? -0.7 : 0,
          tickers: article.tickers,
          realCatalyst: true,
          url: article.article_url
        });
      });
      this.newsCache.set(symbol, { fetchedAt: Date.now(), events });
      return events;
    } catch {
      this.newsCache.set(symbol, { fetchedAt: Date.now(), events: [] });
      return [];
    }
  }

  async latestFinnhubEarningsEvents(symbol) {
    if (process.env.ENABLE_FINNHUB_EARNINGS === "false") return [];
    if (!process.env.FINNHUB_API_KEY) return [];

    const cached = this.earningsCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < this.earningsTtlMs) {
      return cached.events;
    }

    if (!cached && this.earningsRequests >= this.earningsSymbolLimit) {
      this.earningsCache.set(symbol, { fetchedAt: Date.now(), events: [] });
      return [];
    }

    try {
      this.earningsRequests += 1;
      const from = new Date();
      const to = new Date(from.getTime() + 1000 * 60 * 60 * 24 * 21);
      const url = new URL("/api/v1/calendar/earnings", "https://finnhub.io");
      url.searchParams.set("from", dateOnly(from));
      url.searchParams.set("to", dateOnly(to));
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("token", process.env.FINNHUB_API_KEY);

      const response = await fetch(url);
      if (!response.ok) {
        this.earningsCache.set(symbol, { fetchedAt: Date.now(), events: [] });
        return [];
      }

      const payload = await response.json();
      const events = (payload.earningsCalendar ?? []).slice(0, 2).map((item) => {
        const earningsDate = new Date(`${item.date}T12:00:00Z`);
        const daysUntil = Math.ceil((earningsDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return event(symbol, "finnhub", "earnings", `${symbol} earnings ${item.date} ${item.hour ?? ""}`.trim(), 16, {
          date: item.date,
          daysUntil,
          hour: item.hour,
          quarter: item.quarter,
          year: item.year,
          epsEstimate: item.epsEstimate,
          revenueEstimate: item.revenueEstimate,
          realCatalyst: true,
          url: "https://finnhub.io/calendar/earnings"
        });
      });
      this.earningsCache.set(symbol, { fetchedAt: Date.now(), events });
      return events;
    } catch {
      this.earningsCache.set(symbol, { fetchedAt: Date.now(), events: [] });
      return [];
    }
  }
}
