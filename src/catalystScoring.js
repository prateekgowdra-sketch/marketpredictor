const bullishWords = [
  "launch",
  "approval",
  "upgrade",
  "beat",
  "partnership",
  "contract",
  "growth",
  "record",
  "expansion",
  "guidance raised",
  "buyback"
];

const bearishWords = [
  "lawsuit",
  "investigation",
  "downgrade",
  "miss",
  "recall",
  "delay",
  "cuts guidance",
  "bankruptcy",
  "probe",
  "offering",
  "sec charges"
];

const highImpactTypes = new Set(["news", "sec", "earnings", "analyst", "product", "regulatory"]);

function textIncludes(text, words) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function eventText(event) {
  return `${event.title ?? ""} ${event.raw?.description ?? ""} ${event.raw?.summary ?? ""}`;
}

function impactFor(event) {
  const explicit = event.raw?.sentiment;
  if (explicit === "positive" || explicit === "bullish") return "Bullish";
  if (explicit === "negative" || explicit === "bearish") return "Bearish";
  const text = eventText(event);
  if (textIncludes(text, bullishWords)) return "Bullish";
  if (textIncludes(text, bearishWords)) return "Bearish";
  if (event.type === "earnings") return "Volatility";
  if (event.type === "sec" && ["8-K", "10-Q", "10-K", "4"].includes(event.raw?.form)) return "Watch";
  return "Unknown";
}

function horizonFor(event) {
  if (event.type === "earnings") {
    const days = event.raw?.daysUntil;
    if (typeof days === "number" && days <= 1) return "intraday";
    if (typeof days === "number" && days <= 7) return "this week";
    return "next 2 weeks";
  }
  if (event.type === "news" || event.type === "sec") return "intraday";
  if (event.type === "sector") return "this week";
  return "unknown";
}

function sourceWeight(event) {
  if (event.provider === "polygon-news") return 1;
  if (event.provider === "sec") return 1;
  if (event.provider === "finnhub") return 0.9;
  if (event.raw?.realCatalyst) return 0.8;
  return 0.35;
}

function scoreEvent(event) {
  const base = Math.max(0, Math.min(30, event.strength ?? 0));
  const impact = impactFor(event);
  const impactBonus = impact === "Bullish" || impact === "Bearish" ? 12 : impact === "Volatility" ? 8 : 0;
  const typeBonus = highImpactTypes.has(event.type) ? 7 : 2;
  const realBonus = sourceWeight(event) >= 0.8 ? 10 : 0;
  return (base + impactBonus + typeBonus + realBonus) * sourceWeight(event);
}

export function buildCatalystSummary(symbol, events) {
  const enriched = events
    .map((event) => ({
      ...event,
      impact: impactFor(event),
      horizon: horizonFor(event),
      catalystScore: scoreEvent(event),
      realCatalyst: sourceWeight(event) >= 0.8
    }))
    .sort((a, b) => b.catalystScore - a.catalystScore);

  const top = enriched[0] ?? null;
  const realEvents = enriched.filter((event) => event.realCatalyst);
  const bullish = enriched.filter((event) => event.impact === "Bullish").length;
  const bearish = enriched.filter((event) => event.impact === "Bearish").length;
  const netImpact = bullish > bearish ? "Bullish" : bearish > bullish ? "Bearish" : top?.impact ?? "Unknown";
  const confidence = Math.max(0, Math.min(96, (top?.catalystScore ?? 0) + realEvents.length * 8));

  return {
    symbol,
    topCatalyst: top
      ? {
          title: top.title,
          type: top.type,
          provider: top.provider,
          impact: top.impact,
          horizon: top.horizon,
          url: top.url ?? null,
          score: top.catalystScore,
          strength: top.strength,
          publishedAt: top.raw?.publishedAt ?? top.raw?.filingDate ?? top.raw?.date ?? top.ts
        }
      : null,
    impact: netImpact,
    confidence,
    realCatalystCount: realEvents.length,
    totalCatalysts: enriched.length,
    hasRealCatalyst: realEvents.length > 0,
    whyItMatters: top
      ? `${top.title} is the strongest current catalyst. Impact is classified as ${top.impact.toLowerCase()} over ${top.horizon}.`
      : "No current real catalyst found yet.",
    risk:
      netImpact === "Bullish"
        ? "Catalyst may already be priced in or fail to produce intraday volume."
        : netImpact === "Bearish"
          ? "Negative catalyst may increase downside volatility or gap risk."
          : "Catalyst impact is unclear; require market confirmation.",
    events: enriched.slice(0, 6).map((event) => ({
      title: event.title,
      type: event.type,
      provider: event.provider,
      impact: event.impact,
      horizon: event.horizon,
      score: event.catalystScore,
      url: event.url ?? null
    }))
  };
}
