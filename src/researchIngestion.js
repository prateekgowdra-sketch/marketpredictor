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
    raw
  };
}

export class ResearchIngestion {
  constructor() {
    this.name = "research-engine";
    this.lastTickBySymbol = new Map();
    this.secCache = new Map();
    this.secTtlMs = 1000 * 60 * 10;
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

    return events;
  }

  async latestSecFilingEvent(symbol) {
    if (process.env.ENABLE_SEC_INGESTION !== "true") return null;
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
        accession
      });
      this.secCache.set(symbol, { fetchedAt: Date.now(), event: secEvent });
      return secEvent;
    } catch {
      this.secCache.set(symbol, { fetchedAt: Date.now(), event: null });
      return null;
    }
  }
}
