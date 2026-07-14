import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export const defaultSymbols = ["NVDA", "AMD", "TSLA", "PLTR", "SOFI", "COIN", "SMCI", "RIVN", "HOOD", "MSTR"];

export const defaultUniverseSymbols = [
  "AAPL", "MSFT", "NVDA", "AMD", "AVGO", "TSLA", "META", "GOOGL", "AMZN", "NFLX",
  "PLTR", "SMCI", "ARM", "MU", "INTC", "TSM", "QCOM", "ORCL", "CRM", "NOW",
  "COIN", "MSTR", "MARA", "RIOT", "HOOD", "SOFI", "AFRM", "PYPL", "SQ", "SHOP",
  "RIVN", "LCID", "NIO", "XPEV", "LI", "F", "GM", "UBER", "ABNB", "DASH",
  "JPM", "BAC", "WFC", "GS", "MS", "C", "V", "MA", "AXP", "SCHW",
  "LLY", "NVO", "MRNA", "PFE", "BMY", "GILD", "REGN", "VRTX", "BIIB", "UNH",
  "XOM", "CVX", "OXY", "SLB", "HAL", "COP", "ENPH", "FSLR", "SEDG", "NEE",
  "WMT", "COST", "TGT", "HD", "LOW", "NKE", "SBUX", "MCD", "CMG", "DIS",
  "SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV", "XLY", "XLI"
];

export function configuredSymbols() {
  return (process.env.MARKET_SYMBOLS ?? defaultSymbols.join(","))
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

export function configuredUniverseSymbols() {
  return (process.env.MARKET_UNIVERSE_SYMBOLS ?? defaultUniverseSymbols.join(","))
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

export function scanConfig() {
  return {
    enabled: process.env.ENABLE_UNIVERSE_SCAN !== "false",
    maxUniverse: Number(process.env.SCAN_MAX_UNIVERSE ?? 100),
    deepCandidates: Number(process.env.SCAN_DEEP_CANDIDATES ?? 20),
    dashboardLimit: Number(process.env.SCAN_DASHBOARD_LIMIT ?? 12),
    refreshEveryTicks: Number(process.env.SCAN_REFRESH_TICKS ?? 5)
  };
}
