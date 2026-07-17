const SETUP_QUALITY_MIN = 65;
const REWARD_RISK_MIN = 1.15;
const ML_PROBABILITY_MIN = 0.58;
const RISK_SCORE_MAX = 58;

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function pass(label, passed, detail) {
  return { label, passed, detail };
}

function readinessForOpportunity(opportunity) {
  const dataQuality = opportunity.dataQuality ?? {};
  const research = opportunity.researchSummary ?? {};
  const setup = opportunity.dayTradeSetup ?? {};
  const prediction = opportunity.prediction ?? {};
  const decision = opportunity.signalDecision ?? {};
  const rewardRisk = setup.rewardRisk ?? decision.rewardRisk ?? 0;
  const probabilityUp = prediction.probabilityUp ?? 0;
  const riskScore = prediction.riskScore ?? 100;
  const setupQuality = setup.quality ?? 0;

  const checks = [
    pass(
      "Trusted real-time data",
      dataQuality.isRealTimeTrusted === true,
      dataQuality.label ?? "No trusted market data yet"
    ),
    pass(
      "Real catalyst source",
      research.hasRealCatalyst === true,
      research.topCatalyst?.title ?? "No company catalyst found yet"
    ),
    pass(
      "Clean intraday setup",
      setupQuality >= SETUP_QUALITY_MIN,
      `${setup.type ?? "No setup"} at ${setupQuality.toFixed(0)} quality`
    ),
    pass(
      "Reward/risk",
      rewardRisk >= REWARD_RISK_MIN,
      `${rewardRisk.toFixed(2)}x reward/risk`
    ),
    pass(
      "ML probability",
      probabilityUp >= ML_PROBABILITY_MIN,
      `${pct(probabilityUp)} up probability`
    ),
    pass(
      "Risk score",
      riskScore <= RISK_SCORE_MAX,
      `${riskScore.toFixed(0)} risk score`
    ),
    pass(
      "Signal gate",
      decision.label === "Signal",
      decision.label ?? "Reject"
    )
  ];

  const blockers = [
    ...checks.filter((check) => !check.passed).map((check) => check.label),
    ...(decision.blockers ?? [])
  ];

  return {
    symbol: opportunity.symbol,
    company: opportunity.company,
    score: opportunity.score,
    signal: decision.label ?? "Reject",
    setupType: setup.type ?? "No Clean Day-Trade Setup",
    setupQuality,
    rewardRisk,
    catalystImpact: research.impact ?? "Unknown",
    catalystTitle: research.topCatalyst?.title ?? "No real catalyst found yet",
    dataLabel: dataQuality.label ?? "Unknown",
    checks,
    passedChecks: checks.filter((check) => check.passed).length,
    totalChecks: checks.length,
    ready: checks.every((check) => check.passed),
    blockers: [...new Set(blockers)].slice(0, 6)
  };
}

export function buildPaperReadiness(opportunities) {
  const candidates = opportunities.slice(0, 12).map(readinessForOpportunity);
  const readyCandidates = candidates.filter((candidate) => candidate.ready);
  const closest =
    readyCandidates[0] ??
    [...candidates].sort((a, b) => b.passedChecks - a.passedChecks || b.score - a.score)[0] ??
    null;

  return {
    ready: readyCandidates.length > 0,
    readyCount: readyCandidates.length,
    checkedCount: candidates.length,
    closest,
    candidates: candidates.slice(0, 6),
    note:
      readyCandidates.length > 0
        ? "Paper trading is allowed only for candidates with trusted real-time data, real catalysts, a clean setup, and passing risk checks."
        : "Paper trading is still blocked until at least one ticker clears every readiness check."
  };
}
