function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, min, max) {
  if (value === null || Number.isNaN(value)) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export function scoreOpportunity(symbol, technical, tick, events = [], profile = null) {
  const catalysts = events.map((event) => ({
    type: event.type,
    label: event.title.replace(`${symbol} `, "").toLowerCase(),
    strength: event.strength
  }));
  const companyProfile = profile ?? {
    company: symbol,
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
  const uniqueReasons = [...new Set(reasons)];

  return {
    symbol,
    company: companyProfile.company,
    sector: companyProfile.sector,
    price: technical.price,
    score,
    priority: score >= 75 ? "High" : score >= 55 ? "Medium" : "Watch",
    confidence: clamp(score - riskPenalty + catalystScore * 0.4, 0, 96),
    action: score >= 72 ? "Potential Entry" : score >= 55 ? "Watch Setup" : "Research",
    entryZone: [entryLow, entryHigh],
    stop,
    target,
    catalysts,
    reasons: uniqueReasons.slice(0, 6),
    technical,
    risk: {
      volatilityPct: technical.volatilityPct,
      beta: companyProfile.beta,
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
