import { buildTechnicalSnapshot } from "./technicalIndicators.js";
import { scoreOpportunity, summarizeMarket } from "./researchEngine.js";
import { createMarketProvider } from "./providers/providerFactory.js";
import {
  saveCandle,
  saveOutcome,
  saveResearchEvents,
  saveSignal,
  saveTicker
} from "./database.js";
import { OutcomeTracker } from "./outcomes.js";

export class MarketEngine {
  static async create() {
    const provider = await createMarketProvider();
    return new MarketEngine(provider);
  }

  constructor(provider) {
    this.provider = provider;
    this.outcomes = new OutcomeTracker();
    this.profiles = new Map();

    for (const profile of this.provider.profiles()) {
      this.profiles.set(profile.symbol, profile);
      saveTicker(profile);
    }

    for (const [symbol, candles] of this.provider.history().entries()) {
      for (const candle of candles) {
        saveCandle(symbol, candle, this.provider.name);
      }
    }
  }

  async next() {
    const { tick, updates } = await this.provider.nextCandles();
    const opportunities = [];
    const researchEvents = [];

    for (const update of updates) {
      saveCandle(update.symbol, update.candle, this.provider.name);
      const technical = buildTechnicalSnapshot(update.candles);
      const events = this.provider.researchEvents(update.symbol, technical);
      researchEvents.push(...events);
      opportunities.push(
        scoreOpportunity(update.symbol, technical, tick, events, this.profiles.get(update.symbol))
      );
    }

    opportunities.sort((a, b) => b.score - a.score);

    if (researchEvents.length) {
      saveResearchEvents(researchEvents);
    }

    for (const opportunity of opportunities) {
      if (opportunity.score >= 70) {
        const signalId = saveSignal(opportunity, this.provider.name);
        this.outcomes.track(signalId, opportunity, tick);
      }
    }

    const dueOutcomes = this.outcomes.collectDue(tick, opportunities);
    for (const outcome of dueOutcomes) {
      saveOutcome(outcome);
    }

    return {
      tick,
      provider: this.provider.name,
      generatedAt: new Date().toISOString(),
      summary: summarizeMarket(opportunities),
      opportunities
    };
  }
}
