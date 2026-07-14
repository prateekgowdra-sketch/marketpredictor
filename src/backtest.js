import {
  getLatestModelRun,
  getOutcomeStats,
  getPaperTradeStats,
  getRecentPredictions,
  getRecentPaperTrades,
  getRecentResearchEvents,
  getRecentSignals
} from "./database.js";

export function getBacktestSummary() {
  const stats = getOutcomeStats();
  const recentSignals = getRecentSignals(100);
  const highPriority = recentSignals.filter((signal) => signal.priority === "High");

  return {
    generatedAt: new Date().toISOString(),
    sampleSize: recentSignals.length,
    highPrioritySignals: highPriority.length,
    outcomeStats: stats,
    paperStats: getPaperTradeStats(),
    recentPaperTrades: getRecentPaperTrades(10),
    model: getLatestModelRun(),
    recentPredictions: getRecentPredictions(10),
    recentResearch: getRecentResearchEvents(12),
    note:
      stats.length === 0
        ? "Outcome windows are still collecting. Keep the stream running to build the first backtest sample."
        : "Early live-simulation outcome summary. This is not a validated production strategy."
  };
}
