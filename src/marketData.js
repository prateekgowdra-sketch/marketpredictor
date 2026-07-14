import { buildTechnicalSnapshot } from "./technicalIndicators.js";
import { scoreOpportunity, summarizeMarket } from "./researchEngine.js";
import { createMarketProvider } from "./providers/providerFactory.js";
import {
  saveCandle,
  saveOutcome,
  savePrediction,
  saveResearchEvents,
  saveSignal,
  saveTicker
} from "./database.js";
import { OutcomeTracker } from "./outcomes.js";
import { ResearchIngestion } from "./researchIngestion.js";
import { buildFeatureVector } from "./features.js";
import { PredictionEngine } from "./mlModel.js";

export class MarketEngine {
  static async create() {
    const provider = await createMarketProvider();
    return new MarketEngine(provider);
  }

  constructor(provider) {
    this.provider = provider;
    this.outcomes = new OutcomeTracker();
    this.research = new ResearchIngestion();
    this.predictions = new PredictionEngine();
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
      const profile = this.profiles.get(update.symbol);
      const providerEvents = this.provider.researchEvents(update.symbol, technical);
      const researchEventsForSymbol = await this.research.eventsFor({
        symbol: update.symbol,
        profile,
        technical,
        tick
      });
      const events = [...providerEvents, ...researchEventsForSymbol];
      researchEvents.push(...events);
      const opportunity = scoreOpportunity(update.symbol, technical, tick, events, profile);
      const features = buildFeatureVector(opportunity, events);
      const prediction = this.predictions.predict(features);
      opportunity.features = features;
      opportunity.prediction = {
        modelName: prediction.modelName,
        probabilityUp: prediction.probabilityUp,
        expectedReturn: prediction.expectedReturn,
        riskScore: prediction.riskScore,
        metrics: prediction.metrics
      };
      opportunity.confidence = Math.max(
        0,
        Math.min(96, opportunity.confidence * 0.65 + prediction.probabilityUp * 100 * 0.35)
      );
      opportunities.push(opportunity);
    }

    opportunities.sort((a, b) => b.score - a.score);

    if (researchEvents.length) {
      saveResearchEvents(researchEvents);
    }

    for (const opportunity of opportunities) {
      savePrediction({
        symbol: opportunity.symbol,
        ts: opportunity.updatedAt,
        modelName: opportunity.prediction.modelName,
        probabilityUp: opportunity.prediction.probabilityUp,
        expectedReturn: opportunity.prediction.expectedReturn,
        riskScore: opportunity.prediction.riskScore,
        features: opportunity.features,
        explanation: {
          reasons: opportunity.reasons,
          modelMode: opportunity.prediction.metrics.mode,
          catalystCount: opportunity.catalysts.length
        }
      });

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
