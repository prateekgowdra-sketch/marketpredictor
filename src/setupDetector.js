function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function rewardRisk(entry, stop, target) {
  if (target < entry && stop > entry) {
    const risk = stop - entry;
    return risk > 0 ? (entry - target) / risk : 0;
  }
  const risk = entry - stop;
  if (risk <= 0) return 0;
  return (target - entry) / risk;
}

function setupPayload({ type, direction, quality, entry, stop, target, trigger, reasons, invalidation }) {
  return {
    type,
    direction,
    quality: clamp(quality, 0, 100),
    entry,
    stop,
    target,
    rewardRisk: rewardRisk(entry, stop, target),
    trigger,
    reasons,
    invalidation
  };
}

export function detectDayTradingSetup(candles, technical, opportunity) {
  const last = candles.at(-1);
  const previous = candles.at(-2);
  const atr = technical.atr || technical.price * 0.018;
  const openingRangeHigh = technical.openingRangeHigh ?? technical.recentHigh;
  const openingRangeLow = technical.openingRangeLow ?? technical.recentLow;
  const reclaimingVwap =
    Boolean(previous && technical.vwap && previous.close < technical.vwap && last.close > technical.vwap);
  const rejectingVwap =
    Boolean(previous && technical.vwap && previous.high >= technical.vwap && last.close < technical.vwap);
  const openingBreakout = technical.price > openingRangeHigh && technical.relativeVolume > 1.2;
  const highRelVolumeMomentum =
    technical.relativeVolume > 1.8 &&
    technical.aboveVwap &&
    technical.trendUp &&
    (technical.rsi ?? 50) >= 55 &&
    (technical.rsi ?? 50) <= 78;
  const gapAndGo =
    technical.sessionGapPct > 0.015 &&
    technical.aboveVwap &&
    technical.price > openingRangeHigh &&
    technical.relativeVolume > 1.25;
  const failedBreakout =
    technical.breakoutPressure > 0.995 &&
    last.close < openingRangeHigh &&
    last.close < last.open &&
    technical.relativeVolume > 1.1;

  const candidates = [];
  const baseQuality =
    opportunity.score * 0.45 +
    clamp(technical.relativeVolume, 0, 4) * 8 +
    (opportunity.researchSummary?.confidence ?? 0) * 0.18;

  if (gapAndGo) {
    const entry = Math.max(last.high, openingRangeHigh) + atr * 0.08;
    const stop = Math.max(entry - atr * 1.05, openingRangeHigh - atr * 0.6);
    candidates.push(
      setupPayload({
        type: "Gap-and-Go",
        direction: "Long",
        quality: baseQuality + 16,
        entry,
        stop,
        target: entry + (entry - stop) * 2.1,
        trigger: `Break and hold above ${openingRangeHigh.toFixed(2)} with volume`,
        reasons: [`${pct(technical.sessionGapPct)} session gap`, `${technical.relativeVolume.toFixed(1)}x relative volume`, "above VWAP"],
        invalidation: "Fails back below opening range high or VWAP"
      })
    );
  }

  if (openingBreakout) {
    const entry = openingRangeHigh + atr * 0.05;
    const stop = entry - atr * 0.95;
    candidates.push(
      setupPayload({
        type: "Opening Range Breakout",
        direction: "Long",
        quality: baseQuality + 12,
        entry,
        stop,
        target: entry + (entry - stop) * 2,
        trigger: `Break above opening range high ${openingRangeHigh.toFixed(2)}`,
        reasons: ["opening range break", `${technical.relativeVolume.toFixed(1)}x relative volume`],
        invalidation: "Breakout fails back into the opening range"
      })
    );
  }

  if (reclaimingVwap) {
    const entry = last.high + atr * 0.05;
    const stop = Math.min((technical.vwap ?? last.low) - atr * 0.25, entry - atr * 0.75);
    candidates.push(
      setupPayload({
        type: "VWAP Reclaim",
        direction: "Long",
        quality: baseQuality + 10,
        entry,
        stop,
        target: entry + (entry - stop) * 1.8,
        trigger: `Confirm above VWAP ${technical.vwap.toFixed(2)}`,
        reasons: ["price crossed back above VWAP", `${technical.relativeVolume.toFixed(1)}x relative volume`],
        invalidation: "Loses VWAP after reclaim"
      })
    );
  }

  if (highRelVolumeMomentum) {
    const entry = last.high + atr * 0.04;
    const stop = entry - atr * 0.9;
    candidates.push(
      setupPayload({
        type: "High Relative Volume Momentum",
        direction: "Long",
        quality: baseQuality + 9,
        entry,
        stop,
        target: entry + (entry - stop) * 1.9,
        trigger: "Continuation above current high with volume",
        reasons: [`${technical.relativeVolume.toFixed(1)}x relative volume`, "above VWAP", "trend aligned"],
        invalidation: "Volume dries up or price loses VWAP"
      })
    );
  }

  if (rejectingVwap) {
    const entry = last.low - atr * 0.05;
    candidates.push(
      setupPayload({
        type: "VWAP Rejection",
        direction: "Short Watch",
        quality: baseQuality + 6,
        entry,
        stop: (technical.vwap ?? last.high) + atr * 0.45,
        target: entry - atr * 1.8,
        trigger: `Rejects VWAP ${technical.vwap.toFixed(2)} and breaks low`,
        reasons: ["failed VWAP test", `${technical.relativeVolume.toFixed(1)}x relative volume`],
        invalidation: "Reclaims VWAP"
      })
    );
  }

  if (failedBreakout) {
    const entry = last.low - atr * 0.05;
    candidates.push(
      setupPayload({
        type: "Failed Breakout",
        direction: "Short Watch",
        quality: baseQuality + 5,
        entry,
        stop: Math.max(openingRangeHigh, last.high) + atr * 0.35,
        target: entry - atr * 1.7,
        trigger: "Breaks down after losing breakout level",
        reasons: ["breakout failed", "red candle near highs"],
        invalidation: "Reclaims breakout level"
      })
    );
  }

  candidates.sort((a, b) => b.quality - a.quality);
  return (
    candidates[0] ?? {
      type: "No Clean Day-Trade Setup",
      direction: "Wait",
      quality: 0,
      entry: opportunity.entryZone[1],
      stop: opportunity.stop,
      target: opportunity.target,
      rewardRisk: rewardRisk(opportunity.entryZone[1], opportunity.stop, opportunity.target),
      trigger: "Wait for VWAP, opening range, or volume confirmation",
      reasons: ["no confirmed intraday setup"],
      invalidation: "No trade until a setup appears"
    }
  );
}
