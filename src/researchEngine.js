const catalystTemplates = [
  { type: "earnings", label: "earnings momentum", strength: 18 },
  { type: "news", label: "positive news velocity", strength: 14 },
  { type: "sector", label: "sector rotation tailwind", strength: 12 },
  { type: "filing", label: "fresh filing or corporate update", strength: 10 },
  { type: "volume", label: "unusual participation", strength: 16 },
  { type: "technical", label: "breakout setup", strength: 15 }
];

const companyProfiles = {
  NVDA: { name: "NVIDIA", sector: "Semiconductors", marketCap: "mega", beta: 1.8 },
  AMD: { name: "Advanced Micro Devices", sector: "Semiconductors", marketCap: "large", beta: 1.9 },
  TSLA: { name: "Tesla", sector: "EV / Energy", marketCap: "mega", beta: 2.1 },
  PLTR: { name: "Palantir", sector: "Software / AI", marketCap: "large", beta: 2.0 },
  SOFI: { name: "SoFi", sector: "Fintech", marketCap: "mid", beta: 1.7 },
  COIN: { name: "Coinbase", sector: "Crypto Infrastructure", marketCap: "large", beta: 2.4 },
  SMCI: { name: "Super Micro Computer", sector: "AI Infrastructure", marketCap: "large", beta: 2.2 },
  RIVN: { name: "Rivian", sector: "EV", marketCap: "mid", beta: 2.3 },
  HOOD: { name: "Robinhood", sector: "Brokerage / Fintech", marketCap: "mid", beta: 1.9 },
  MSTR: { name: "MicroStrategy", sector: "Bitcoin Treasury", marketCap: "large", beta: 2.6 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, min, max) {
  if (value === null || Number.isNaN(value)) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function activeCatalysts(symbol, technical, tick) {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1) + tick;
  const catalysts = [];

  if (technical.relativeVolume > 1.25) catalysts.push(catalystTemplates[4]);
  if (technical.breakoutPressure > 0.996) catalysts.push(catalystTemplates[5]);
  if (technical.priceChange > 0.006) catalysts.push(catalystTemplates[1]);
  if (seed % 29 === 0) catalysts.push(catalystTemplates[0]);
  if (seed % 37 === 0) catalysts.push(catalystTemplates[2]);
  if (seed % 43 === 0) catalysts.push(catalystTemplates[3]);

  return catalysts;
}

export function scoreOpportunity(symbol, technical, tick) {
  const catalysts = activeCatalysts(symbol, technical, tick);
  const profile = companyProfiles[symbol] ?? {
    name: symbol,
    sector: "Unknown",
    marketCap: "unknown",
    beta: 1.4
  };

  const momentumScore = normalize(technical.rsi ?? 50, 42, 72) * 18;
  const trendScore = technical.trendUp ? 14 : 4;
  const vwapScore = technical.aboveVwap ? 12 : 2;
  const volumeScore = normalize(technical.relativeVolume, 1, 2.7) * 18;
  const breakoutScore = normalize(technical.breakoutPressure, 0.985, 1.006) * 16;
  const catalystScore = clamp(
    catalysts.reduce((sum, catalyst) => sum + catalyst.strength, 0),
    0,
    24
  );
  const riskPenalty = normalize(technical.volatilityPct, 0.025, 0.09) * 12;
  const score = clamp(
    momentumScore + trendScore + vwapScore + volumeScore + breakoutScore + catalystScore - riskPenalty,
    0,
    100
  );

  const entryLow = technical.price * 0.997;
  const entryHigh = technical.price * 1.004;
  const stop = technical.price * (1 - clamp((technical.volatilityPct || 0.018) * 1.8, 0.012, 0.065));
  const target = technical.price * (1 + clamp((technical.volatilityPct || 0.018) * 2.4, 0.018, 0.11));

  const reasons = [];
  if (technical.relativeVolume > 1.25) reasons.push(`${technical.relativeVolume.toFixed(1)}x relative volume`);
  if (technical.aboveVwap) reasons.push("price holding above VWAP");
  if (technical.trendUp) reasons.push("20-period average above 50-period average");
  if ((technical.rsi ?? 0) > 55 && (technical.rsi ?? 0) < 76) reasons.push("momentum is strong without extreme RSI");
  if (technical.breakoutPressure > 0.996) reasons.push("testing recent high");
  for (const catalyst of catalysts) reasons.push(catalyst.label);

  return {
    symbol,
    company: profile.name,
    sector: profile.sector,
    price: technical.price,
    score,
    priority: score >= 75 ? "High" : score >= 55 ? "Medium" : "Watch",
    confidence: clamp(score - riskPenalty + catalystScore * 0.4, 0, 96),
    action: score >= 72 ? "Potential Entry" : score >= 55 ? "Watch Setup" : "Research",
    entryZone: [entryLow, entryHigh],
    stop,
    target,
    catalysts,
    reasons: reasons.slice(0, 6),
    technical,
    risk: {
      volatilityPct: technical.volatilityPct,
      beta: profile.beta,
      note: technical.volatilityPct > 0.05 ? "Wide intraday movement; size carefully." : "Normal simulated volatility."
    },
    updatedAt: new Date().toISOString()
  };
}

export function summarizeMarket(opportunities) {
  const high = opportunities.filter((item) => item.priority === "High").length;
  const averageScore =
    opportunities.reduce((sum, item) => sum + item.score, 0) / Math.max(opportunities.length, 1);
  const leaders = [...new Set(opportunities.slice(0, 4).map((item) => item.sector))];

  return {
    highPriorityCount: high,
    averageScore,
    leadingSectors: leaders,
    marketTone: averageScore > 62 ? "Risk-on setups forming" : averageScore > 45 ? "Selective opportunities" : "Quiet / wait for confirmation"
  };
}
