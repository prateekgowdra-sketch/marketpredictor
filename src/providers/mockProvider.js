export const symbols = ["NVDA", "AMD", "TSLA", "PLTR", "SOFI", "COIN", "SMCI", "RIVN", "HOOD", "MSTR"];

export const companyProfiles = {
  NVDA: { symbol: "NVDA", company: "NVIDIA", sector: "Semiconductors", marketCap: "mega", beta: 1.8 },
  AMD: { symbol: "AMD", company: "Advanced Micro Devices", sector: "Semiconductors", marketCap: "large", beta: 1.9 },
  TSLA: { symbol: "TSLA", company: "Tesla", sector: "EV / Energy", marketCap: "mega", beta: 2.1 },
  PLTR: { symbol: "PLTR", company: "Palantir", sector: "Software / AI", marketCap: "large", beta: 2.0 },
  SOFI: { symbol: "SOFI", company: "SoFi", sector: "Fintech", marketCap: "mid", beta: 1.7 },
  COIN: { symbol: "COIN", company: "Coinbase", sector: "Crypto Infrastructure", marketCap: "large", beta: 2.4 },
  SMCI: { symbol: "SMCI", company: "Super Micro Computer", sector: "AI Infrastructure", marketCap: "large", beta: 2.2 },
  RIVN: { symbol: "RIVN", company: "Rivian", sector: "EV", marketCap: "mid", beta: 2.3 },
  HOOD: { symbol: "HOOD", company: "Robinhood", sector: "Brokerage / Fintech", marketCap: "mid", beta: 1.9 },
  MSTR: { symbol: "MSTR", company: "MicroStrategy", sector: "Bitcoin Treasury", marketCap: "large", beta: 2.6 }
};

const basePrices = {
  NVDA: 162,
  AMD: 148,
  TSLA: 318,
  PLTR: 91,
  SOFI: 17,
  COIN: 287,
  SMCI: 52,
  RIVN: 14,
  HOOD: 82,
  MSTR: 414
};

function basePriceFor(symbol) {
  if (basePrices[symbol]) return basePrices[symbol];
  const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 12 + (seed % 420);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createInitialCandles(symbol) {
  const candles = [];
  let price = basePriceFor(symbol);
  for (let index = 0; index < 80; index += 1) {
    const drift = Math.sin(index / 9 + symbol.length) * 0.002;
    const move = randomBetween(-0.011, 0.012) + drift;
    const open = price;
    const close = Math.max(1, open * (1 + move));
    const high = Math.max(open, close) * (1 + randomBetween(0.001, 0.008));
    const low = Math.min(open, close) * (1 - randomBetween(0.001, 0.008));
    const volume = Math.round(randomBetween(250000, 4200000) * (1 + Math.abs(move) * 18));
    candles.push({ time: Date.now() - (80 - index) * 60000, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

export class MockMarketProvider {
  constructor() {
    this.name = "mock";
    this.tick = 0;
    this.state = new Map(symbols.map((symbol) => [symbol, createInitialCandles(symbol)]));
  }

  profiles() {
    return Object.values(companyProfiles);
  }

  history() {
    return this.state;
  }

  ensureSymbol(symbol, profile = null) {
    if (!this.state.has(symbol)) {
      this.state.set(symbol, createInitialCandles(symbol));
    }
    if (profile && !companyProfiles[symbol]) {
      companyProfiles[symbol] = profile;
    }
  }

  ensureSymbols(symbolsToAdd, profileForSymbol) {
    for (const symbol of symbolsToAdd) {
      this.ensureSymbol(symbol, profileForSymbol(symbol));
    }
  }

  nextCandles() {
    this.tick += 1;
    const updates = [];

    for (const [symbol, candles] of this.state.entries()) {
      const previous = candles.at(-1);
      const drift = Math.sin(this.tick / 17 + symbol.charCodeAt(0)) * 0.0018;
      const eventPulse = this.tick % (23 + symbol.length) === 0 ? randomBetween(0.009, 0.028) : 0;
      const move = randomBetween(-0.007, 0.0085) + drift + eventPulse;
      const open = previous.close;
      const close = Math.max(1, open * (1 + move));
      const high = Math.max(open, close) * (1 + randomBetween(0.001, 0.006));
      const low = Math.min(open, close) * (1 - randomBetween(0.001, 0.006));
      const volumePulse = eventPulse ? randomBetween(1.8, 3.5) : randomBetween(0.75, 1.35);
      const volume = Math.round(previous.volume * volumePulse);
      const candle = { time: Date.now(), open, high, low, close, volume };

      candles.push(candle);
      if (candles.length > 180) candles.shift();
      updates.push({ symbol, candle, candles });
    }

    return { tick: this.tick, updates };
  }

  researchEvents(symbol, technical) {
    const profile = companyProfiles[symbol];
    const events = [];
    const ts = new Date().toISOString();

    if (technical.relativeVolume > 1.25) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "volume",
        title: `${symbol} unusual participation detected`,
        strength: 16,
        raw: { relativeVolume: technical.relativeVolume }
      });
    }

    if (technical.breakoutPressure > 0.996) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "technical",
        title: `${symbol} testing recent high`,
        strength: 15,
        raw: { breakoutPressure: technical.breakoutPressure }
      });
    }

    if (technical.priceChange > 0.006) {
      events.push({
        symbol,
        ts,
        provider: this.name,
        type: "news",
        title: `${profile.company} positive simulated catalyst velocity`,
        strength: 14,
        raw: { priceChange: technical.priceChange }
      });
    }

    return events;
  }
}
