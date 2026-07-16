function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function pushBlocker(blockers, condition, message) {
  if (condition) blockers.push(message);
}

export function evaluateSignal(opportunity) {
  const prediction = opportunity.prediction ?? {};
  const technical = opportunity.technical ?? {};
  const probabilityUp = prediction.probabilityUp ?? 0.5;
  const expectedReturn = prediction.expectedReturn ?? 0;
  const riskScore = prediction.riskScore ?? 55;
  const catalystCount = opportunity.catalysts?.length ?? 0;
  const dataQuality = opportunity.dataQuality ?? {};
  const isRealTimeTrusted = dataQuality.isRealTimeTrusted === true;
  const reward = opportunity.target - opportunity.price;
  const risk = opportunity.price - opportunity.stop;
  const rewardRisk = risk > 0 ? reward / risk : 0;
  const blockers = [];

  pushBlocker(blockers, opportunity.score < 72, "score below action threshold");
  pushBlocker(blockers, probabilityUp < 0.58, `ML probability only ${pct(probabilityUp)}`);
  pushBlocker(blockers, expectedReturn <= 0, "ML expected return is not positive");
  pushBlocker(blockers, riskScore > 58, `risk score too high at ${riskScore.toFixed(0)}`);
  pushBlocker(blockers, !technical.aboveVwap, "price is not holding above VWAP");
  pushBlocker(blockers, technical.relativeVolume < 1.1 && catalystCount === 0, "needs volume expansion or a catalyst");
  pushBlocker(blockers, rewardRisk < 1.15, `reward/risk only ${rewardRisk.toFixed(2)}x`);
  pushBlocker(blockers, !isRealTimeTrusted, "not backed by trusted real-time day-trading data");

  const confirmations = [];
  if (opportunity.score >= 72) confirmations.push("opportunity score clears action level");
  if (probabilityUp >= 0.58) confirmations.push(`ML probability is ${pct(probabilityUp)}`);
  if (expectedReturn > 0) confirmations.push(`ML expected return is ${pct(expectedReturn)}`);
  if (riskScore <= 58) confirmations.push("risk score is acceptable");
  if (technical.aboveVwap) confirmations.push("price is above VWAP");
  if (technical.relativeVolume >= 1.1) confirmations.push(`${technical.relativeVolume.toFixed(1)}x relative volume`);
  if (catalystCount > 0) confirmations.push(`${catalystCount} catalyst signal${catalystCount === 1 ? "" : "s"}`);
  if (rewardRisk >= 1.15) confirmations.push(`${rewardRisk.toFixed(2)}x reward/risk`);
  if (isRealTimeTrusted) confirmations.push(`${dataQuality.label ?? "real-time"} data trusted`);

  let label = "Reject";
  if (
    isRealTimeTrusted &&
    blockers.length <= 1 &&
    opportunity.score >= 78 &&
    probabilityUp >= 0.62 &&
    riskScore <= 52
  ) {
    label = "Signal";
  } else if (blockers.length <= 3 && opportunity.score >= 60) {
    label = "Watch";
  }

  return {
    label,
    score: Math.max(0, Math.min(100, opportunity.score * 0.55 + probabilityUp * 100 * 0.3 + (100 - riskScore) * 0.15)),
    confirmations: confirmations.slice(0, 5),
    blockers: blockers.slice(0, 5),
    rewardRisk,
    action:
      label === "Signal"
        ? "Paper Trade"
        : label === "Watch"
          ? "Wait For Confirmation"
          : "Skip",
    updatedAt: opportunity.updatedAt
  };
}
