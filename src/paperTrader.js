import {
  getPaperTradeStats,
  getPaperTradesOpenedSince,
  getRecentPaperTrades,
  savePaperTrade,
  updatePaperTrade
} from "./database.js";

export class PaperTrader {
  constructor() {
    this.openTrades = new Map();
    this.enabled = process.env.PAPER_TRADING_ENABLED === "true";
    this.allowSimulation = process.env.PAPER_ALLOW_SIMULATION === "true";
    this.accountSize = Number(process.env.PAPER_ACCOUNT_SIZE ?? 10000);
    this.riskPerTradePct = Number(process.env.PAPER_RISK_PER_TRADE_PCT ?? 0.005);
    this.maxPositionNotional = Number(process.env.PAPER_MAX_POSITION_NOTIONAL ?? process.env.PAPER_TRADE_NOTIONAL ?? 1000);
    this.maxTicksHeld = Number(process.env.PAPER_TRADE_MAX_TICKS ?? 90);
    this.maxOpenTrades = Number(process.env.PAPER_TRADE_MAX_OPEN ?? 5);
    this.maxTradesPerDay = Number(process.env.PAPER_TRADE_MAX_DAILY ?? 5);
    this.minSimulationScore = Number(process.env.PAPER_SIM_MIN_SCORE ?? 60);
    this.minSimulationSetupQuality = Number(process.env.PAPER_SIM_MIN_SETUP_QUALITY ?? 72);
    this.minSimulationRewardRisk = Number(process.env.PAPER_SIM_MIN_REWARD_RISK ?? 1.8);
    this.minSimulationProbability = Number(process.env.PAPER_SIM_MIN_PROBABILITY ?? 0.64);
    this.maxSimulationRiskScore = Number(process.env.PAPER_SIM_MAX_RISK_SCORE ?? 48);
    this.maxSimulationMovePct = Number(process.env.PAPER_SIM_MAX_MOVE_PCT ?? 0.12);
  }

  syncFromDatabase() {
    if (this.openTrades.size > 0) return;
    for (const trade of getRecentPaperTrades(100).filter((item) => item.status === "open")) {
      this.openTrades.set(trade.symbol, trade);
    }
  }

  run(opportunities, tick) {
    this.syncFromDatabase();
    const bySymbol = new Map(opportunities.map((opportunity) => [opportunity.symbol, opportunity]));

    for (const trade of [...this.openTrades.values()]) {
      const opportunity = bySymbol.get(trade.symbol);
      if (!opportunity) continue;
      this.updateOpenTrade(trade, opportunity, tick);
    }

    if (!this.enabled) {
      return this.summary("Paper trading is off in controls.");
    }

    for (const opportunity of opportunities) {
      if (this.openTrades.size >= this.maxOpenTrades) break;
      if (this.tradesOpenedToday() >= this.maxTradesPerDay) break;
      const mode = this.tradeModeFor(opportunity);
      if (!mode) continue;
      if (this.openTrades.has(opportunity.symbol)) continue;
      this.openTrade(opportunity, mode);
    }

    return this.summary();
  }

  tradeModeFor(opportunity) {
    const strict =
      opportunity.signalDecision?.label === "Signal" &&
      opportunity.dataQuality?.isRealTimeTrusted &&
      opportunity.researchSummary?.hasRealCatalyst;
    if (strict) return "strict";

    const setupQuality = opportunity.dayTradeSetup?.quality ?? 0;
    const rewardRisk = opportunity.dayTradeSetup?.rewardRisk ?? opportunity.signalDecision?.rewardRisk ?? 0;
    const probabilityUp = opportunity.prediction?.probabilityUp ?? 0;
    const expectedReturn = opportunity.prediction?.expectedReturn ?? 0;
    const riskScore = opportunity.prediction?.riskScore ?? 100;
    const hasCatalyst = opportunity.researchSummary?.hasRealCatalyst || (opportunity.researchSummary?.events?.length ?? 0) > 0;
    const setupDirection = opportunity.dayTradeSetup?.direction ?? "Wait";
    const allowedSetup =
      setupDirection === "Long" &&
      !["No Clean Day-Trade Setup", "VWAP Rejection", "Failed Breakout"].includes(opportunity.dayTradeSetup?.type);
    const simulation =
      this.allowSimulation &&
      opportunity.score >= this.minSimulationScore &&
      setupQuality >= this.minSimulationSetupQuality &&
      rewardRisk >= this.minSimulationRewardRisk &&
      probabilityUp >= this.minSimulationProbability &&
      expectedReturn > 0 &&
      riskScore <= this.maxSimulationRiskScore &&
      opportunity.technical?.aboveVwap === true &&
      (opportunity.technical?.relativeVolume ?? 0) >= 1.5 &&
      hasCatalyst &&
      allowedSetup;

    return simulation ? "simulation" : null;
  }

  openTrade(opportunity, mode) {
    const perShareRisk = Math.max(0.01, Math.abs(opportunity.price - opportunity.stop));
    const riskDollars = this.accountSize * this.riskPerTradePct;
    const riskSizedQuantity = riskDollars / perShareRisk;
    const notionalCappedQuantity = this.maxPositionNotional / opportunity.price;
    const quantity = Math.max(0, Math.min(riskSizedQuantity, notionalCappedQuantity));
    const notional = quantity * opportunity.price;
    const trade = {
      symbol: opportunity.symbol,
      signalId: opportunity.signalId ?? null,
      openedAt: opportunity.updatedAt,
      status: "open",
      entryPrice: opportunity.price,
      quantity,
      notional,
      stop: opportunity.stop,
      target: opportunity.target,
      pnlPct: 0,
      pnlDollars: 0,
      maxGainPct: 0,
      maxDrawdownPct: 0,
      ticksHeld: 0,
      decision: opportunity.signalDecision,
      prediction: opportunity.prediction,
      setup: opportunity.dayTradeSetup,
      research: opportunity.researchSummary,
      dataQuality: opportunity.dataQuality,
      review: {
        mode,
        simulationOnly: mode === "simulation",
        entryReason:
          mode === "strict"
            ? "Strict paper trade passed real-time data, catalyst, setup, ML, and risk gates."
            : "Simulation paper trade opened to test workflow on delayed/fallback data.",
        confirmations: opportunity.signalDecision?.confirmations ?? [],
        blockersAtEntry: opportunity.signalDecision?.blockers ?? [],
        setupType: opportunity.dayTradeSetup?.type ?? "Unknown Setup",
        catalystTitle: opportunity.researchSummary?.topCatalyst?.title ?? "No top catalyst",
        dataLabel: opportunity.dataQuality?.label ?? "Unknown",
        openedPriceType: opportunity.dataQuality?.isRealTimeTrusted ? "trusted-real-time" : "simulation-or-delayed",
        invalidated: false
      }
    };
    trade.id = savePaperTrade(trade);
    this.openTrades.set(trade.symbol, trade);
  }

  updateOpenTrade(trade, opportunity, tick) {
    const currentPrice = opportunity.price;
    const pnlPct = (currentPrice - trade.entryPrice) / trade.entryPrice;
    trade.pnlPct = pnlPct;
    trade.pnlDollars = trade.notional * pnlPct;
    trade.maxGainPct = Math.max(trade.maxGainPct ?? 0, pnlPct);
    trade.maxDrawdownPct = Math.min(trade.maxDrawdownPct ?? 0, pnlPct);
    trade.ticksHeld = (trade.ticksHeld ?? 0) + 1;

    let exitReason = null;
    if (currentPrice >= trade.target) exitReason = "target";
    if (currentPrice <= trade.stop) exitReason = "stop";
    if (trade.ticksHeld >= this.maxTicksHeld) exitReason = "time";
    if (trade.review?.simulationOnly && Math.abs(pnlPct) > this.maxSimulationMovePct) {
      exitReason = "simulation-anomaly";
      trade.review.invalidated = true;
      trade.review.invalidationReason = `Simulation move exceeded ${(this.maxSimulationMovePct * 100).toFixed(1)}% guardrail.`;
    }

    if (exitReason) {
      trade.status = "closed";
      trade.closedAt = opportunity.updatedAt;
      trade.exitPrice = currentPrice;
      trade.exitReason = exitReason;
      updatePaperTrade(trade);
      this.openTrades.delete(trade.symbol);
    } else if (tick % 5 === 0) {
      updatePaperTrade(trade);
    }
  }

  tradesOpenedToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return getPaperTradesOpenedSince(start.toISOString());
  }

  summary(note = null) {
    return {
      generatedAt: new Date().toISOString(),
      controls: {
        enabled: this.enabled,
        allowSimulation: this.allowSimulation,
        accountSize: this.accountSize,
        riskPerTradePct: this.riskPerTradePct,
        maxPositionNotional: this.maxPositionNotional,
        maxOpenTrades: this.maxOpenTrades,
        maxTradesPerDay: this.maxTradesPerDay,
        maxTicksHeld: this.maxTicksHeld,
        minSimulationScore: this.minSimulationScore,
        minSimulationSetupQuality: this.minSimulationSetupQuality,
        minSimulationRewardRisk: this.minSimulationRewardRisk,
        minSimulationProbability: this.minSimulationProbability,
        maxSimulationRiskScore: this.maxSimulationRiskScore,
        maxSimulationMovePct: this.maxSimulationMovePct,
        tradesOpenedToday: this.tradesOpenedToday()
      },
      note,
      stats: getPaperTradeStats(),
      openTrades: [...this.openTrades.values()].sort((a, b) => b.pnlPct - a.pnlPct),
      recentTrades: getRecentPaperTrades(20)
    };
  }
}
