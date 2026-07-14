import { configuredUniverseSymbols, scanConfig } from "./config.js";

const sectorBySymbol = {
  AAPL: "Mega Cap Tech", MSFT: "Mega Cap Tech", GOOGL: "Mega Cap Tech", AMZN: "Mega Cap Tech", META: "Mega Cap Tech", NFLX: "Media / Streaming",
  NVDA: "Semiconductors", AMD: "Semiconductors", AVGO: "Semiconductors", ARM: "Semiconductors", MU: "Semiconductors", INTC: "Semiconductors", TSM: "Semiconductors", QCOM: "Semiconductors",
  PLTR: "Software / AI", ORCL: "Software", CRM: "Software", NOW: "Software",
  COIN: "Crypto Infrastructure", MSTR: "Bitcoin Treasury", MARA: "Bitcoin Miners", RIOT: "Bitcoin Miners", HOOD: "Brokerage / Fintech", SOFI: "Fintech", AFRM: "Fintech", PYPL: "Fintech", SQ: "Fintech", SHOP: "Ecommerce",
  TSLA: "EV / Energy", RIVN: "EV", LCID: "EV", NIO: "EV", XPEV: "EV", LI: "EV", F: "Autos", GM: "Autos", UBER: "Mobility", ABNB: "Travel", DASH: "Delivery",
  JPM: "Banks", BAC: "Banks", WFC: "Banks", GS: "Banks", MS: "Banks", C: "Banks", V: "Payments", MA: "Payments", AXP: "Payments", SCHW: "Brokerage",
  LLY: "Biotech / Pharma", NVO: "Biotech / Pharma", MRNA: "Biotech / Pharma", PFE: "Biotech / Pharma", BMY: "Biotech / Pharma", GILD: "Biotech / Pharma", REGN: "Biotech / Pharma", VRTX: "Biotech / Pharma", BIIB: "Biotech / Pharma", UNH: "Healthcare",
  XOM: "Energy", CVX: "Energy", OXY: "Energy", SLB: "Energy Services", HAL: "Energy Services", COP: "Energy", ENPH: "Solar", FSLR: "Solar", SEDG: "Solar", NEE: "Utilities",
  WMT: "Retail", COST: "Retail", TGT: "Retail", HD: "Retail", LOW: "Retail", NKE: "Consumer", SBUX: "Consumer", MCD: "Consumer", CMG: "Consumer", DIS: "Media",
  SPY: "Index ETF", QQQ: "Index ETF", IWM: "Index ETF", DIA: "Index ETF", XLK: "Sector ETF", XLF: "Sector ETF", XLE: "Sector ETF", XLV: "Sector ETF", XLY: "Sector ETF", XLI: "Sector ETF"
};

const companyBySymbol = {
  AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Alphabet", AMZN: "Amazon", META: "Meta", NFLX: "Netflix",
  AVGO: "Broadcom", ARM: "Arm Holdings", MU: "Micron", INTC: "Intel", TSM: "Taiwan Semiconductor", QCOM: "Qualcomm",
  ORCL: "Oracle", CRM: "Salesforce", NOW: "ServiceNow", MARA: "MARA Holdings", RIOT: "Riot Platforms",
  AFRM: "Affirm", PYPL: "PayPal", SQ: "Block", SHOP: "Shopify", LCID: "Lucid", NIO: "NIO", XPEV: "XPeng", LI: "Li Auto",
  F: "Ford", GM: "General Motors", UBER: "Uber", ABNB: "Airbnb", DASH: "DoorDash", JPM: "JPMorgan Chase", BAC: "Bank of America",
  WFC: "Wells Fargo", GS: "Goldman Sachs", MS: "Morgan Stanley", C: "Citigroup", V: "Visa", MA: "Mastercard", AXP: "American Express", SCHW: "Charles Schwab",
  LLY: "Eli Lilly", NVO: "Novo Nordisk", MRNA: "Moderna", PFE: "Pfizer", BMY: "Bristol Myers Squibb", GILD: "Gilead", REGN: "Regeneron", VRTX: "Vertex", BIIB: "Biogen", UNH: "UnitedHealth",
  XOM: "Exxon Mobil", CVX: "Chevron", OXY: "Occidental Petroleum", SLB: "Schlumberger", HAL: "Halliburton", COP: "ConocoPhillips", ENPH: "Enphase", FSLR: "First Solar", SEDG: "SolarEdge", NEE: "NextEra Energy",
  WMT: "Walmart", COST: "Costco", TGT: "Target", HD: "Home Depot", LOW: "Lowe's", NKE: "Nike", SBUX: "Starbucks", MCD: "McDonald's", CMG: "Chipotle", DIS: "Disney"
};

function hashSymbol(symbol, tick) {
  return [...symbol].reduce((sum, char) => sum * 31 + char.charCodeAt(0), tick + 7);
}

function pseudoMetric(symbol, tick, min, max, phase = 0) {
  const seed = hashSymbol(symbol, tick + phase);
  const wave = (Math.sin(seed * 0.00037) + 1) / 2;
  const pulse = seed % 97 === 0 ? 0.35 : 0;
  return min + Math.min(1, wave + pulse) * (max - min);
}

export function profileForSymbol(symbol) {
  return {
    symbol,
    company: companyBySymbol[symbol] ?? symbol,
    sector: sectorBySymbol[symbol] ?? "Market",
    marketCap: "unknown",
    beta: 1.4
  };
}

export class UniverseScanner {
  constructor(baseSymbols = []) {
    this.config = scanConfig();
    const universe = configuredUniverseSymbols().slice(0, this.config.maxUniverse);
    this.symbols = [...new Set([...baseSymbols, ...universe])];
    this.lastScan = null;
  }

  scan(tick, activeSymbols = []) {
    const active = new Set(activeSymbols);
    const candidates = this.symbols.map((symbol) => {
      const gapPct = pseudoMetric(symbol, tick, -0.06, 0.08, 3);
      const relativeVolume = pseudoMetric(symbol, tick, 0.2, 5.5, 9);
      const momentum = pseudoMetric(symbol, tick, -0.04, 0.06, 15);
      const catalystPulse = pseudoMetric(symbol, tick, 0, 1, 21);
      const liquidity = pseudoMetric(symbol, tick, 0.25, 1, 27);
      const score =
        Math.max(0, gapPct) * 180 +
        Math.max(0, momentum) * 220 +
        Math.min(relativeVolume, 4) * 12 +
        catalystPulse * 18 +
        liquidity * 10 +
        (active.has(symbol) ? 8 : 0);

      return {
        symbol,
        company: profileForSymbol(symbol).company,
        sector: profileForSymbol(symbol).sector,
        score,
        gapPct,
        relativeVolume,
        momentum,
        catalystPulse,
        liquidity,
        alreadyTracked: active.has(symbol)
      };
    });

    candidates.sort((a, b) => b.score - a.score);
    const deepCandidates = candidates.slice(0, this.config.deepCandidates);
    this.lastScan = {
      generatedAt: new Date().toISOString(),
      universeSize: this.symbols.length,
      activeTracked: active.size,
      deepCandidateCount: deepCandidates.length,
      dashboardLimit: this.config.dashboardLimit,
      candidates: candidates.slice(0, this.config.dashboardLimit),
      deepSymbols: deepCandidates.map((candidate) => candidate.symbol)
    };
    return this.lastScan;
  }
}
