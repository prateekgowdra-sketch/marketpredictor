import { getPaperTradesForReport } from "./database.js";

function pct(value) {
  return Number.isFinite(value) ? value : 0;
}

function tradeMode(trade) {
  if (trade.review?.mode) return trade.review.mode;
  return trade.dataQuality?.isRealTimeTrusted ? "strict" : "simulation";
}

function summarizeTrades(trades) {
  const closed = trades.filter((trade) => trade.status === "closed");
  const wins = closed.filter((trade) => (trade.pnlPct ?? 0) > 0);
  const losses = closed.filter((trade) => (trade.pnlPct ?? 0) <= 0);
  const grossWins = wins.reduce((sum, trade) => sum + Math.max(0, trade.pnlDollars ?? 0), 0);
  const grossLosses = Math.abs(losses.reduce((sum, trade) => sum + Math.min(0, trade.pnlDollars ?? 0), 0));
  const averageWin = wins.length ? wins.reduce((sum, trade) => sum + (trade.pnlPct ?? 0), 0) / wins.length : 0;
  const averageLoss = losses.length ? losses.reduce((sum, trade) => sum + (trade.pnlPct ?? 0), 0) / losses.length : 0;
  const maxDrawdown = closed.reduce((worst, trade) => Math.min(worst, trade.maxDrawdownPct ?? trade.pnlPct ?? 0), 0);

  return {
    total: trades.length,
    closed: closed.length,
    open: trades.filter((trade) => trade.status === "open").length,
    winRate: closed.length ? wins.length / closed.length : 0,
    averageWin: pct(averageWin),
    averageLoss: pct(averageLoss),
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    maxDrawdown: pct(maxDrawdown),
    realizedPnl: closed.reduce((sum, trade) => sum + (trade.pnlDollars ?? 0), 0)
  };
}

function groupBySetup(trades) {
  const groups = new Map();
  for (const trade of trades) {
    const key = trade.setup?.type ?? "Unknown Setup";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  }

  return [...groups.entries()]
    .map(([setup, setupTrades]) => ({
      setup,
      ...summarizeTrades(setupTrades)
    }))
    .sort((a, b) => b.closed - a.closed || b.winRate - a.winRate);
}

export function buildStrategyReport(limit = 1000) {
  const trades = getPaperTradesForReport(limit);
  const currentFormatTrades = trades.filter((trade) => trade.setup && trade.research && trade.dataQuality);
  const strictTrades = currentFormatTrades.filter((trade) => tradeMode(trade) === "strict");
  const simulationTrades = currentFormatTrades.filter((trade) => tradeMode(trade) === "simulation");
  const invalidatedTrades = currentFormatTrades.filter((trade) => trade.review?.invalidated === true);

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: currentFormatTrades.length,
    legacyIgnored: trades.length - currentFormatTrades.length,
    strict: summarizeTrades(strictTrades),
    simulation: summarizeTrades(simulationTrades),
    invalidatedCount: invalidatedTrades.length,
    bySetup: groupBySetup(currentFormatTrades),
    recentReviews: currentFormatTrades.slice(0, 12).map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      status: trade.status,
      mode: tradeMode(trade),
      setup: trade.setup?.type ?? "Unknown Setup",
      catalyst: trade.research?.impact ?? "Unknown",
      data: trade.dataQuality?.label ?? "Unknown",
      pnlPct: trade.pnlPct,
      pnlDollars: trade.pnlDollars,
      exitReason: trade.exitReason,
      review: trade.review
    })),
    note:
      simulationTrades.length === 0
        ? "No current-format simulation trades yet. Enable simulation mode, run scans, and collect at least 100 trades before judging strategy quality."
        : "Simulation results test workflow quality only. They are not real day-trading proof until strict real-time data is connected."
  };
}
