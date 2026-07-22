import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const controlsPath = path.join(dataDir, "paper-controls.json");

const defaults = {
  enabled: false,
  allowSimulation: false,
  accountSize: 10000,
  riskPerTradePct: 0.005,
  maxPositionNotional: 1000,
  maxOpenTrades: 3,
  maxTradesPerDay: 5,
  maxTicksHeld: 90,
  minSimulationScore: 75,
  minSimulationSetupQuality: 72,
  minSimulationRewardRisk: 1.8,
  minSimulationProbability: 0.64,
  maxSimulationRiskScore: 48,
  maxSimulationMovePct: 0.12,
  maxDailyLosses: 3,
  maxDailyDrawdownPct: 0.08,
  morningTestEnabled: false,
  morningTestStart: "09:35",
  morningTestEnd: "11:30",
  morningTestIntervalMinutes: 5,
  morningTestMaxTrades: 5,
  morningTestMaxLosses: 2,
  morningTestMaxDrawdownPct: 0.03
};

function toNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeControls(input = {}) {
  const morningTestMaxTrades = Math.round(toNumber(input.morningTestMaxTrades, defaults.morningTestMaxTrades, 1, 20));
  const morningTestMaxLosses = Math.round(toNumber(input.morningTestMaxLosses, defaults.morningTestMaxLosses, 1, 10));
  const morningTestMaxDrawdownPct = toNumber(
    input.morningTestMaxDrawdownPct,
    defaults.morningTestMaxDrawdownPct,
    0.005,
    0.2
  );
  return {
    enabled: input.enabled === true,
    allowSimulation: input.allowSimulation === true,
    accountSize: toNumber(input.accountSize, defaults.accountSize, 100, 10000000),
    riskPerTradePct: toNumber(input.riskPerTradePct, defaults.riskPerTradePct, 0.0001, 0.05),
    maxPositionNotional: toNumber(input.maxPositionNotional, defaults.maxPositionNotional, 10, 10000000),
    maxOpenTrades: Math.round(toNumber(input.maxOpenTrades, defaults.maxOpenTrades, 1, 50)),
    maxTradesPerDay: Math.round(toNumber(input.maxTradesPerDay, defaults.maxTradesPerDay, 1, 500)),
    maxTicksHeld: Math.round(toNumber(input.maxTicksHeld, defaults.maxTicksHeld, 1, 10000)),
    minSimulationScore: toNumber(input.minSimulationScore, defaults.minSimulationScore, defaults.minSimulationScore, 100),
    minSimulationSetupQuality: toNumber(
      input.minSimulationSetupQuality,
      defaults.minSimulationSetupQuality,
      defaults.minSimulationSetupQuality,
      100
    ),
    minSimulationRewardRisk: toNumber(
      input.minSimulationRewardRisk,
      defaults.minSimulationRewardRisk,
      defaults.minSimulationRewardRisk,
      10
    ),
    minSimulationProbability: toNumber(
      input.minSimulationProbability,
      defaults.minSimulationProbability,
      defaults.minSimulationProbability,
      1
    ),
    maxSimulationRiskScore: toNumber(input.maxSimulationRiskScore, defaults.maxSimulationRiskScore, 0, defaults.maxSimulationRiskScore),
    maxSimulationMovePct: toNumber(input.maxSimulationMovePct, defaults.maxSimulationMovePct, 0.01, defaults.maxSimulationMovePct),
    maxDailyLosses: Math.min(Math.round(toNumber(input.maxDailyLosses, defaults.maxDailyLosses, 1, 50)), morningTestMaxLosses),
    maxDailyDrawdownPct: Math.min(
      toNumber(input.maxDailyDrawdownPct, defaults.maxDailyDrawdownPct, 0.005, 0.5),
      morningTestMaxDrawdownPct
    ),
    morningTestEnabled: input.morningTestEnabled === true,
    morningTestStart: /^\d{2}:\d{2}$/.test(input.morningTestStart ?? "") ? input.morningTestStart : defaults.morningTestStart,
    morningTestEnd: /^\d{2}:\d{2}$/.test(input.morningTestEnd ?? "") ? input.morningTestEnd : defaults.morningTestEnd,
    morningTestIntervalMinutes: Math.round(toNumber(input.morningTestIntervalMinutes, defaults.morningTestIntervalMinutes, 1, 60)),
    morningTestMaxTrades,
    morningTestMaxLosses,
    morningTestMaxDrawdownPct
  };
}

export function getPaperControls() {
  if (!existsSync(controlsPath)) {
    return { ...defaults };
  }

  try {
    const parsed = JSON.parse(readFileSync(controlsPath, "utf8"));
    return normalizeControls({ ...defaults, ...parsed });
  } catch {
    return { ...defaults };
  }
}

export function savePaperControls(nextControls) {
  mkdirSync(dataDir, { recursive: true });
  const controls = normalizeControls({ ...getPaperControls(), ...nextControls });
  writeFileSync(controlsPath, `${JSON.stringify(controls, null, 2)}\n`);
  return controls;
}

export function paperControlsEnv(controls = getPaperControls()) {
  const morningTest = controls.morningTestEnabled === true;
  const maxTradesPerDay = morningTest ? Math.min(controls.maxTradesPerDay, controls.morningTestMaxTrades) : controls.maxTradesPerDay;
  const maxDailyLosses = morningTest ? Math.min(controls.maxDailyLosses, controls.morningTestMaxLosses) : controls.maxDailyLosses;
  const maxDailyDrawdownPct = morningTest
    ? Math.min(controls.maxDailyDrawdownPct, controls.morningTestMaxDrawdownPct)
    : controls.maxDailyDrawdownPct;
  return {
    PAPER_TRADING_ENABLED: controls.enabled ? "true" : "false",
    PAPER_ALLOW_SIMULATION: controls.allowSimulation ? "true" : "false",
    PAPER_ACCOUNT_SIZE: String(controls.accountSize),
    PAPER_RISK_PER_TRADE_PCT: String(controls.riskPerTradePct),
    PAPER_MAX_POSITION_NOTIONAL: String(controls.maxPositionNotional),
    PAPER_TRADE_MAX_OPEN: String(controls.maxOpenTrades),
    PAPER_TRADE_MAX_DAILY: String(maxTradesPerDay),
    PAPER_TRADE_MAX_TICKS: String(controls.maxTicksHeld),
    PAPER_SIM_MIN_SCORE: String(controls.minSimulationScore),
    PAPER_SIM_MIN_SETUP_QUALITY: String(controls.minSimulationSetupQuality),
    PAPER_SIM_MIN_REWARD_RISK: String(controls.minSimulationRewardRisk),
    PAPER_SIM_MIN_PROBABILITY: String(controls.minSimulationProbability),
    PAPER_SIM_MAX_RISK_SCORE: String(controls.maxSimulationRiskScore),
    PAPER_SIM_MAX_MOVE_PCT: String(controls.maxSimulationMovePct),
    PAPER_MAX_DAILY_LOSSES: String(maxDailyLosses),
    PAPER_MAX_DAILY_DRAWDOWN_PCT: String(maxDailyDrawdownPct),
    PAPER_MORNING_TEST_ENABLED: controls.morningTestEnabled ? "true" : "false",
    PAPER_MORNING_TEST_MAX_TRADES: String(controls.morningTestMaxTrades),
    PAPER_MORNING_TEST_MAX_LOSSES: String(controls.morningTestMaxLosses),
    PAPER_MORNING_TEST_MAX_DRAWDOWN_PCT: String(controls.morningTestMaxDrawdownPct)
  };
}
