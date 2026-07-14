function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safe(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function buildFeatureVector(opportunity, events = []) {
  const technical = opportunity.technical;
  const eventStrength = events.reduce((sum, event) => sum + event.strength, 0);
  const eventCount = events.length;
  const hasSecEvent = events.some((event) => event.type === "sec") ? 1 : 0;
  const hasNewsEvent = events.some((event) => event.type === "news") ? 1 : 0;
  const hasSectorEvent = events.some((event) => event.type === "sector") ? 1 : 0;

  return {
    score: safe(opportunity.score) / 100,
    confidence: safe(opportunity.confidence) / 100,
    rsi: safe(technical.rsi, 50) / 100,
    macd: clamp(safe(technical.macd) / Math.max(safe(technical.price, 1), 1), -0.08, 0.08),
    relativeVolume: clamp(safe(technical.relativeVolume, 1) / 4, 0, 2),
    breakoutPressure: clamp((safe(technical.breakoutPressure, 1) - 0.98) / 0.04, 0, 2),
    aboveVwap: technical.aboveVwap ? 1 : 0,
    trendUp: technical.trendUp ? 1 : 0,
    volatilityPct: clamp(safe(technical.volatilityPct), 0, 0.15),
    priceChange: clamp(safe(technical.priceChange), -0.08, 0.08),
    eventStrength: clamp(eventStrength / 60, 0, 2),
    eventCount: clamp(eventCount / 6, 0, 2),
    hasSecEvent,
    hasNewsEvent,
    hasSectorEvent
  };
}

export const featureNames = [
  "score",
  "confidence",
  "rsi",
  "macd",
  "relativeVolume",
  "breakoutPressure",
  "aboveVwap",
  "trendUp",
  "volatilityPct",
  "priceChange",
  "eventStrength",
  "eventCount",
  "hasSecEvent",
  "hasNewsEvent",
  "hasSectorEvent"
];

export function vectorize(features) {
  return featureNames.map((name) => safe(features[name]));
}
