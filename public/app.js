const opportunitiesEl = document.querySelector("#opportunities");
const detailEl = document.querySelector("#detail");
const detailPriorityEl = document.querySelector("#detailPriority");
const scoreFilterEl = document.querySelector("#scoreFilter");
const scoreValueEl = document.querySelector("#scoreValue");
const priorityFilterEl = document.querySelector("#priorityFilter");
const resultCountEl = document.querySelector("#resultCount");
const lastUpdatedEl = document.querySelector("#lastUpdated");
const marketToneEl = document.querySelector("#marketTone");
const highCountEl = document.querySelector("#highCount");
const avgScoreEl = document.querySelector("#avgScore");
const leadersEl = document.querySelector("#leaders");
const signalUpdatedEl = document.querySelector("#signalUpdated");
const signalCountEl = document.querySelector("#signalCount");
const watchCountEl = document.querySelector("#watchCount");
const rejectCountEl = document.querySelector("#rejectCount");
const paperPnlEl = document.querySelector("#paperPnl");
const paperTradesEl = document.querySelector("#paperTrades");
const scanUpdatedEl = document.querySelector("#scanUpdated");
const universeSizeEl = document.querySelector("#universeSize");
const deepCandidateCountEl = document.querySelector("#deepCandidateCount");
const activeTrackedEl = document.querySelector("#activeTracked");
const scanCandidatesEl = document.querySelector("#scanCandidates");
const learningUpdatedEl = document.querySelector("#learningUpdated");
const sampleSizeEl = document.querySelector("#sampleSize");
const highPrioritySignalsEl = document.querySelector("#highPrioritySignals");
const modelStateEl = document.querySelector("#modelState");
const paperWinRateEl = document.querySelector("#paperWinRate");
const learningNoteEl = document.querySelector("#learningNote");
const outcomeStatsEl = document.querySelector("#outcomeStats");
const predictionCountEl = document.querySelector("#predictionCount");
const predictionListEl = document.querySelector("#predictionList");
const researchCountEl = document.querySelector("#researchCount");
const researchListEl = document.querySelector("#researchList");

let snapshot = null;
let selectedSymbol = null;
let backtest = null;

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function signedPct(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${pct(value)}`;
}

function priorityClass(priority) {
  if (priority === "High") return "priority";
  if (priority === "Medium") return "priority medium";
  return "priority watch";
}

function decisionClass(label) {
  if (label === "Signal") return "decision signal";
  if (label === "Watch") return "decision watch";
  return "decision reject";
}

function filteredOpportunities() {
  if (!snapshot) return [];
  const minScore = Number(scoreFilterEl.value);
  const priority = priorityFilterEl.value;
  return snapshot.opportunities.filter((item) => {
    const scoreMatch = item.score >= minScore;
    const priorityMatch = priority === "all" || item.priority === priority;
    return scoreMatch && priorityMatch;
  });
}

function renderSummary() {
  marketToneEl.textContent = snapshot.summary.marketTone;
  highCountEl.textContent = snapshot.summary.highPriorityCount;
  avgScoreEl.textContent = snapshot.summary.averageScore.toFixed(1);
  leadersEl.textContent = snapshot.summary.leadingSectors.join(", ") || "-";
  lastUpdatedEl.textContent = new Date(snapshot.generatedAt).toLocaleTimeString();
}

function renderScan() {
  const scan = snapshot.scan;
  if (!scan) return;
  scanUpdatedEl.textContent = new Date(scan.generatedAt).toLocaleTimeString();
  universeSizeEl.textContent = scan.universeSize;
  deepCandidateCountEl.textContent = scan.deepCandidateCount;
  activeTrackedEl.textContent = scan.activeTracked;
  scanCandidatesEl.innerHTML = scan.candidates
    .slice(0, 10)
    .map(
      (candidate) => `
        <div class="scan-candidate">
          <div>
            <strong>${candidate.symbol}</strong>
            <span>${candidate.sector}</span>
          </div>
          <div>
            <strong>${candidate.score.toFixed(0)}</strong>
            <span>RV ${candidate.relativeVolume.toFixed(1)}x - ${signedPct(candidate.momentum)}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderSignalGate() {
  const summary = snapshot.signalSummary ?? { Signal: 0, Watch: 0, Reject: 0 };
  const paper = snapshot.paper ?? { stats: {}, openTrades: [], recentTrades: [] };
  signalUpdatedEl.textContent = new Date(paper.generatedAt ?? snapshot.generatedAt).toLocaleTimeString();
  signalCountEl.textContent = summary.Signal ?? 0;
  watchCountEl.textContent = summary.Watch ?? 0;
  rejectCountEl.textContent = summary.Reject ?? 0;
  paperPnlEl.textContent = money(paper.stats?.realizedPnl ?? 0);

  const openTrades = paper.openTrades ?? [];
  const recentClosed = (paper.recentTrades ?? []).filter((trade) => trade.status === "closed").slice(0, 4);
  const trades = [...openTrades, ...recentClosed].slice(0, 6);
  paperTradesEl.innerHTML =
    trades.length === 0
      ? `<div class="empty-state">No paper trades yet. The gate only opens trades when score, ML, VWAP, risk, and reward/risk line up.</div>`
      : trades
          .map(
            (trade) => `
              <div class="paper-trade ${trade.status}">
                <div>
                  <strong>${trade.symbol}</strong>
                  <span>${trade.status}${trade.exitReason ? ` - ${trade.exitReason}` : ""}</span>
                </div>
                <div>
                  <strong>${signedPct(trade.pnlPct ?? 0)}</strong>
                  <span>${money(trade.entryPrice)} entry</span>
                </div>
              </div>
            `
          )
          .join("");
}

function renderList() {
  const items = filteredOpportunities();
  resultCountEl.textContent = `${items.length} shown`;
  opportunitiesEl.innerHTML = "";

  for (const item of items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `ticker-row ${item.symbol === selectedSymbol ? "selected" : ""}`;
    row.innerHTML = `
      <div>
        <div class="symbol">${item.symbol}</div>
        <div class="company">${item.company}</div>
      </div>
      <div class="reasons">
        ${item.reasons.slice(0, 4).map((reason) => `<span class="chip">${reason}</span>`).join("")}
      </div>
        <div class="score">
          <strong>${item.score.toFixed(0)}</strong>
        <span class="${decisionClass(item.signalDecision?.label)}">${item.signalDecision?.label ?? "Reject"}</span>
        <span class="${priorityClass(item.priority)}">${item.priority}</span>
        <span class="probability">${item.prediction ? pct(item.prediction.probabilityUp) : "-"}</span>
      </div>
    `;
    row.addEventListener("click", () => {
      selectedSymbol = item.symbol;
      render();
    });
    opportunitiesEl.append(row);
  }

  if (!selectedSymbol && items.length) selectedSymbol = items[0].symbol;
}

function renderDetail() {
  const item = snapshot.opportunities.find((candidate) => candidate.symbol === selectedSymbol);
  if (!item) {
    detailPriorityEl.textContent = "Select a ticker";
    detailEl.className = "empty-state";
    detailEl.textContent = "No ticker matches the current filter.";
    return;
  }

  detailPriorityEl.textContent = `${item.signalDecision?.label ?? item.priority} - ${item.signalDecision?.action ?? item.action}`;
  detailEl.className = "";
  detailEl.innerHTML = `
    <div class="detail-title">
      <div>
        <h4>${item.symbol}</h4>
        <p class="meta">${item.company} - ${item.sector}</p>
      </div>
      <div class="price">${money(item.price)}</div>
    </div>
    <div class="detail-grid">
      <div><span>Confidence</span><strong>${item.confidence.toFixed(0)}%</strong></div>
      <div><span>Relative Volume</span><strong>${item.technical.relativeVolume.toFixed(2)}x</strong></div>
      <div><span>Entry Zone</span><strong>${money(item.entryZone[0])} - ${money(item.entryZone[1])}</strong></div>
      <div><span>Stop / Target</span><strong>${money(item.stop)} / ${money(item.target)}</strong></div>
      <div><span>RSI</span><strong>${item.technical.rsi ? item.technical.rsi.toFixed(1) : "-"}</strong></div>
      <div><span>Volatility</span><strong>${pct(item.technical.volatilityPct)}</strong></div>
      <div><span>ML Up Probability</span><strong>${item.prediction ? pct(item.prediction.probabilityUp) : "-"}</strong></div>
      <div><span>Expected / Risk</span><strong>${item.prediction ? `${signedPct(item.prediction.expectedReturn)} / ${item.prediction.riskScore.toFixed(0)}` : "-"}</strong></div>
      <div><span>Signal Gate</span><strong>${item.signalDecision?.label ?? "-"}</strong></div>
      <div><span>Reward / Risk</span><strong>${item.signalDecision ? `${item.signalDecision.rewardRisk.toFixed(2)}x` : "-"}</strong></div>
    </div>
    <h3>Gate Check</h3>
    <div class="gate-check">
      ${(item.signalDecision?.confirmations ?? []).map((reason) => `<span class="confirm">${reason}</span>`).join("")}
      ${(item.signalDecision?.blockers ?? []).map((reason) => `<span class="blocker">${reason}</span>`).join("")}
    </div>
    <h3>Why It Is Flagged</h3>
    <ul class="reason-list">
      ${item.reasons.map((reason) => `<li>${reason}</li>`).join("")}
    </ul>
    <h3>Risk Note</h3>
    <p class="meta">${item.risk.note}</p>
  `;
}

function renderLearning() {
  if (!backtest) return;
  learningUpdatedEl.textContent = new Date(backtest.generatedAt).toLocaleTimeString();
  sampleSizeEl.textContent = backtest.sampleSize;
  highPrioritySignalsEl.textContent = backtest.highPrioritySignals;
  modelStateEl.textContent = backtest.model?.metrics?.mode ?? "heuristic";
  paperWinRateEl.textContent = pct(backtest.paperStats?.winRate ?? 0);
  learningNoteEl.textContent = backtest.note;
  outcomeStatsEl.innerHTML = backtest.outcomeStats
    .map(
      (stat) => `
        <div class="outcome-card">
          <strong>${stat.horizon}</strong>
          <span>Samples: ${stat.count}</span>
          <span>Avg return: ${pct(stat.averageReturn)}</span>
          <span>Win rate: ${pct(stat.winRate)}</span>
          <span>Max gain: ${pct(stat.averageMaxGain)}</span>
          <span>Drawdown: ${pct(stat.averageMaxDrawdown)}</span>
        </div>
      `
    )
    .join("");
  predictionCountEl.textContent = backtest.recentPredictions?.length ?? 0;
  predictionListEl.innerHTML = (backtest.recentPredictions ?? [])
    .slice(0, 8)
    .map(
      (prediction) => `
        <div class="intel-item">
          <strong>${prediction.symbol}</strong>
          <span>${pct(prediction.probability_up)} up - ${signedPct(prediction.expected_return)} expected - risk ${prediction.risk_score.toFixed(0)}</span>
        </div>
      `
    )
    .join("");
  researchCountEl.textContent = backtest.recentResearch?.length ?? 0;
  researchListEl.innerHTML = (backtest.recentResearch ?? [])
    .slice(0, 8)
    .map(
      (event) => `
        <div class="intel-item">
          <strong>${event.symbol} ${event.type}</strong>
          <span>${event.title}</span>
        </div>
      `
    )
    .join("");
}

function render() {
  if (!snapshot) return;
  renderSummary();
  renderSignalGate();
  renderScan();
  renderList();
  renderDetail();
  renderLearning();
}

scoreFilterEl.addEventListener("input", () => {
  scoreValueEl.textContent = scoreFilterEl.value;
  render();
});

priorityFilterEl.addEventListener("change", render);

const events = new EventSource("/events");
events.onmessage = (event) => {
  snapshot = JSON.parse(event.data);
  if (!selectedSymbol && snapshot.opportunities.length) {
    selectedSymbol = snapshot.opportunities[0].symbol;
  }
  render();
};

events.onerror = () => {
  lastUpdatedEl.textContent = "Reconnecting";
};

async function refreshBacktest() {
  try {
    const response = await fetch("/api/backtest");
    if (!response.ok) return;
    backtest = await response.json();
    renderLearning();
  } catch {
    learningUpdatedEl.textContent = "Reconnecting";
  }
}

refreshBacktest();
setInterval(refreshBacktest, 5000);
