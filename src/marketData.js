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
import { buildCatalystSummary } from "./catalystScoring.js";
import { detectDayTradingSetup } from "./setupDetector.js";
import { buildFeatureVector } from "./features.js";
import { PredictionEngine } from "./mlModel.js";
import { PaperTrader } from "./paperTrader.js";
import { evaluateSignal } from "./signalGate.js";
import { buildPaperReadiness } from "./paperReadiness.js";
import { profileForSymbol, UniverseScanner } from "./universeScanner.js";

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
    this.paperTrader = new PaperTrader();
    this.profiles = new Map();
    this.scanner = new UniverseScanner(this.provider.profiles().map((profile) => profile.symbol));
    this.latestScan = null;

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
    this.latestScan = this.scanner.scan(tick, updates.map((update) => update.symbol));
    if (this.provider.ensureSymbols) {
      this.provider.ensureSymbols(this.latestScan.deepSymbols, profileForSymbol);
      for (const symbol of this.latestScan.deepSymbols) {
        if (!this.profiles.has(symbol)) {
          const profile = profileForSymbol(symbol);
          this.profiles.set(symbol, profile);
          saveTicker(profile);
        }
      }
    }
    const { updates: refreshedUpdates } = await this.provider.nextCandles();
    const opportunities = [];
    const researchEvents = [];

    for (const update of refreshedUpdates) {
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
      opportunity.researchSummary = buildCatalystSummary(update.symbol, events);
      opportunity.dayTradeSetup = detectDayTradingSetup(update.candles, technical, opportunity);
      if (opportunity.dayTradeSetup.type !== "No Clean Day-Trade Setup") {
        opportunity.entryZone = [
          opportunity.dayTradeSetup.entry * 0.998,
          opportunity.dayTradeSetup.entry * 1.002
        ];
        opportunity.stop = opportunity.dayTradeSetup.stop;
        opportunity.target = opportunity.dayTradeSetup.target;
        opportunity.action = opportunity.dayTradeSetup.direction === "Long" ? "Day Trade Setup" : "Short Watch";
        opportunity.reasons = [
          opportunity.dayTradeSetup.type,
          ...opportunity.dayTradeSetup.reasons,
          ...opportunity.reasons
        ].slice(0, 6);
      }
      opportunity.dataQuality = this.provider.dataQuality
        ? this.provider.dataQuality(update.symbol)
        : {
            symbol: update.symbol,
            source: this.provider.name,
            tier: "unknown",
            label: this.provider.name,
            isRealData: false,
            isRealTimeTrusted: false,
            note: "Provider does not expose data quality details."
          };
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
      opportunity.signalDecision = evaluateSignal(opportunity);
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
          catalystCount: opportunity.catalysts.length,
          researchSummary: opportunity.researchSummary,
          dayTradeSetup: opportunity.dayTradeSetup
        }
      });

      if (opportunity.signalDecision.label !== "Reject") {
        const signalId = saveSignal(opportunity, this.provider.name);
        opportunity.signalId = Number(signalId);
        this.outcomes.track(signalId, opportunity, tick);
      }
    }

    const dueOutcomes = this.outcomes.collectDue(tick, opportunities);
    for (const outcome of dueOutcomes) {
      saveOutcome(outcome);
    }

    const paper = this.paperTrader.run(opportunities, tick);
    const paperReadiness = buildPaperReadiness(opportunities);

    return {
      tick,
      provider: this.provider.name,
      dataHealth: this.provider.health ? this.provider.health() : null,
      dataQualitySummary: summarizeDataQuality(opportunities),
      generatedAt: new Date().toISOString(),
      summary: summarizeMarket(opportunities),
      scan: this.latestScan,
      signalSummary: summarizeSignalDecisions(opportunities),
      paperReadiness,
      paper,
      opportunities
    };
  }
}

function summarizeSignalDecisions(opportunities) {
  const counts = { Signal: 0, Watch: 0, Reject: 0 };
  for (const opportunity of opportunities) {
    counts[opportunity.signalDecision?.label ?? "Reject"] += 1;
  }
  return {
    ...counts,
    actionRate: opportunities.length ? counts.Signal / opportunities.length : 0
  };
}

export function summarizeDataQuality(opportunities) {
  return {
    realTimeTrusted: opportunities.filter((item) => item.dataQuality?.isRealTimeTrusted).length,
    delayedReal: opportunities.filter((item) => item.dataQuality?.isRealData && !item.dataQuality?.isRealTimeTrusted).length,
    fallback: opportunities.filter((item) => item.dataQuality?.tier === "fallback").length
  };
}
