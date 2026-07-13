import { buildTechnicalSnapshot } from "./technicalIndicators.js";
import { scoreOpportunity, summarizeMarket } from "./researchEngine.js";

const symbols = ["NVDA", "AMD", "TSLA", "PLTR", "SOFI", "COIN", "SMCI", "RIVN", "HOOD", "MSTR"];

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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createInitialCandles(symbol) {
  const candles = [];
  let price = basePrices[symbol];
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

export class MarketSimulator {
  constructor() {
    this.tick = 0;
    this.state = new Map(symbols.map((symbol) => [symbol, createInitialCandles(symbol)]));
  }

  next() {
    this.tick += 1;
    const opportunities = [];

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

      candles.push({ time: Date.now(), open, high, low, close, volume });
      if (candles.length > 180) candles.shift();

      const technical = buildTechnicalSnapshot(candles);
      opportunities.push(scoreOpportunity(symbol, technical, this.tick));
    }

    opportunities.sort((a, b) => b.score - a.score);

    return {
      tick: this.tick,
      generatedAt: new Date().toISOString(),
      summary: summarizeMarket(opportunities),
      opportunities
    };
  }
}
