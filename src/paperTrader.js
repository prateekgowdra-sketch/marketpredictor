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
    this.accountSize = Number(process.env.PAPER_ACCOUNT_SIZE ?? 10000);
    this.riskPerTradePct = Number(process.env.PAPER_RISK_PER_TRADE_PCT ?? 0.005);
    this.maxPositionNotional = Number(process.env.PAPER_MAX_POSITION_NOTIONAL ?? process.env.PAPER_TRADE_NOTIONAL ?? 1000);
    this.maxTicksHeld = Number(process.env.PAPER_TRADE_MAX_TICKS ?? 90);
    this.maxOpenTrades = Number(process.env.PAPER_TRADE_MAX_OPEN ?? 5);
    this.maxTradesPerDay = Number(process.env.PAPER_TRADE_MAX_DAILY ?? 5);
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
      if (opportunity.signalDecision?.label !== "Signal") continue;
      if (!opportunity.dataQuality?.isRealTimeTrusted) continue;
      if (!opportunity.researchSummary?.hasRealCatalyst) continue;
      if (this.openTrades.has(opportunity.symbol)) continue;
      this.openTrade(opportunity);
    }

    return this.summary();
  }

  openTrade(opportunity) {
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
      dataQuality: opportunity.dataQuality
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
        accountSize: this.accountSize,
        riskPerTradePct: this.riskPerTradePct,
        maxPositionNotional: this.maxPositionNotional,
        maxOpenTrades: this.maxOpenTrades,
        maxTradesPerDay: this.maxTradesPerDay,
        maxTicksHeld: this.maxTicksHeld,
        tradesOpenedToday: this.tradesOpenedToday()
      },
      note,
      stats: getPaperTradeStats(),
      openTrades: [...this.openTrades.values()].sort((a, b) => b.pnlPct - a.pnlPct),
      recentTrades: getRecentPaperTrades(20)
    };
  }
}
