const opportunitiesEl = document.querySelector("#opportunities");
const detailEl = document.querySelector("#detail");
const detailPriorityEl = document.querySelector("#detailPriority");
const refreshDetailEl = document.querySelector("#refreshDetail");
const scoreFilterEl = document.querySelector("#scoreFilter");
const scoreValueEl = document.querySelector("#scoreValue");
const priorityFilterEl = document.querySelector("#priorityFilter");
const resultCountEl = document.querySelector("#resultCount");
const refreshListEl = document.querySelector("#refreshList");
const lastUpdatedEl = document.querySelector("#lastUpdated");
const marketToneEl = document.querySelector("#marketTone");
const highCountEl = document.querySelector("#highCount");
const avgScoreEl = document.querySelector("#avgScore");
const leadersEl = document.querySelector("#leaders");
const scanStateEl = document.querySelector("#scanState");
const runResearchScanEl = document.querySelector("#runResearchScan");
const dataProviderEl = document.querySelector("#dataProvider");
const trustedDataCountEl = document.querySelector("#trustedDataCount");
const delayedDataCountEl = document.querySelector("#delayedDataCount");
const fallbackDataCountEl = document.querySelector("#fallbackDataCount");
const rateLimitCountEl = document.querySelector("#rateLimitCount");
const dataHealthNoteEl = document.querySelector("#dataHealthNote");
const signalUpdatedEl = document.querySelector("#signalUpdated");
const signalCountEl = document.querySelector("#signalCount");
const watchCountEl = document.querySelector("#watchCount");
const rejectCountEl = document.querySelector("#rejectCount");
const paperPnlEl = document.querySelector("#paperPnl");
const paperTradesEl = document.querySelector("#paperTrades");
const readinessStatusEl = document.querySelector("#readinessStatus");
const readinessSymbolEl = document.querySelector("#readinessSymbol");
const readinessTitleEl = document.querySelector("#readinessTitle");
const readinessNoteEl = document.querySelector("#readinessNote");
const readinessChecklistEl = document.querySelector("#readinessChecklist");
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
const paperJournalCountEl = document.querySelector("#paperJournalCount");
const paperJournalListEl = document.querySelector("#paperJournalList");

let snapshot = null;
let rankedOpportunities = [];
let detailOpportunity = null;
let selectedSymbol = null;
let backtest = null;
let lastRankedRefresh = 0;
let lastDetailRefresh = 0;
let renderedDetailKey = null;
let listHasNewData = false;
let detailHasNewData = false;
let scanStatus = null;

const RANKED_REFRESH_MS = 10000;
const DETAIL_REFRESH_MS = 10000;

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

function dataQualityClass(tier) {
  if (tier === "real-time" || tier === "intraday") return "data-badge trusted";
  if (tier === "delayed") return "data-badge delayed";
  return "data-badge fallback";
}

function catalystClass(impact) {
  if (impact === "Bullish") return "catalyst-badge bullish";
  if (impact === "Bearish") return "catalyst-badge bearish";
  if (impact === "Volatility") return "catalyst-badge volatility";
  return "catalyst-badge unknown";
}

function setupClass(type) {
  if (!type || type === "No Clean Day-Trade Setup") return "setup-badge none";
  if (type.includes("VWAP")) return "setup-badge vwap";
  if (type.includes("Opening") || type.includes("Gap")) return "setup-badge breakout";
  if (type.includes("Momentum")) return "setup-badge momentum";
  return "setup-badge caution";
}

function checkClass(passed) {
  return passed ? "readiness-check pass" : "readiness-check fail";
}

function listRefreshSeconds() {
  const elapsed = Date.now() - lastRankedRefresh;
  return Math.max(0, Math.ceil((RANKED_REFRESH_MS - elapsed) / 1000));
}

function resultCountText(count) {
  if (!snapshot || rankedOpportunities.length === 0) return `${count} shown`;
  if (listHasNewData) return `${count} shown - new data, refresh in ${listRefreshSeconds()}s`;
  return `${count} shown - steady`;
}

function detailStatusText(item) {
  if (!item) return "Select a ticker";
  if (detailHasNewData) {
    const elapsed = Date.now() - lastDetailRefresh;
    const seconds = Math.max(0, Math.ceil((DETAIL_REFRESH_MS - elapsed) / 1000));
    return `${item.signalDecision?.label ?? item.priority} - hold ${seconds}s`;
  }
  return `${item.signalDecision?.label ?? item.priority} - steady`;
}

function filteredOpportunities() {
  if (!rankedOpportunities.length) return [];
  const minScore = Number(scoreFilterEl.value);
  const priority = priorityFilterEl.value;
  return rankedOpportunities.filter((item) => {
    const scoreMatch = item.score >= minScore;
    const priorityMatch = priority === "all" || item.priority === priority;
    return scoreMatch && priorityMatch;
  });
}

function refreshRankedList() {
  if (!snapshot) return;
  rankedOpportunities = snapshot.opportunities.map((item) => ({ ...item }));
  lastRankedRefresh = Date.now();
  listHasNewData = false;
  if (!selectedSymbol && rankedOpportunities.length) {
    selectedSymbol = rankedOpportunities[0].symbol;
  }
  renderList();
}

function latestSelectedOpportunity() {
  if (!snapshot || !selectedSymbol) return null;
  return snapshot.opportunities.find((candidate) => candidate.symbol === selectedSymbol) ?? null;
}

function refreshDetail() {
  const latest = latestSelectedOpportunity();
  if (!latest) return;
  detailOpportunity = { ...latest };
  lastDetailRefresh = Date.now();
  detailHasNewData = false;
  renderDetail(true);
}

function renderSummary() {
  marketToneEl.textContent = snapshot.summary.marketTone;
  highCountEl.textContent = snapshot.summary.highPriorityCount;
  avgScoreEl.textContent = snapshot.summary.averageScore.toFixed(1);
  leadersEl.textContent = snapshot.summary.leadingSectors.join(", ") || "-";
  lastUpdatedEl.textContent = new Date(snapshot.generatedAt).toLocaleTimeString();
}

function renderScanStatus() {
  const state = scanStatus?.state ?? (snapshot?.provider === "loading" ? "starting" : "idle");
  const isBusy = state === "running" || state === "starting" || state === "queued";
  const label =
    state === "running" ? "Running" : state === "starting" ? "Starting" : state === "queued" ? "Queued" : state === "error" ? "Error" : "Idle";
  scanStateEl.textContent = label;
  runResearchScanEl.disabled = isBusy;
  runResearchScanEl.textContent = isBusy ? "Scan Running" : "Run Research Scan";
  runResearchScanEl.classList.toggle("is-running", isBusy);
}

function renderDataHealth() {
  const health = snapshot.dataHealth ?? {};
  const opportunities = snapshot.opportunities ?? [];
  const trusted = opportunities.filter((item) => item.dataQuality?.isRealTimeTrusted).length;
  const delayed = opportunities.filter((item) => item.dataQuality?.tier === "delayed").length;
  const fallback = opportunities.filter((item) => item.dataQuality?.tier === "fallback").length;

  dataProviderEl.textContent = health.provider ? `${health.provider} provider` : "Provider unknown";
  trustedDataCountEl.textContent = trusted;
  delayedDataCountEl.textContent = delayed || health.delayedSymbols || 0;
  fallbackDataCountEl.textContent = fallback || health.fallbackSymbols || 0;
  rateLimitCountEl.textContent = health.rateLimitSkips ?? 0;
  dataHealthNoteEl.textContent =
    health.note ??
    "Signals are only trusted when backed by real-time day-trading data. Fallback data is for testing.";
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

function renderPaperReadiness() {
  const readiness = snapshot.paperReadiness;
  if (!readiness) return;
  const closest = readiness.closest;
  readinessStatusEl.textContent = readiness.ready
    ? `${readiness.readyCount} ready`
    : `${readiness.readyCount} ready - ${readiness.checkedCount} checked`;

  if (!closest) {
    readinessSymbolEl.textContent = "No candidate yet";
    readinessTitleEl.textContent = "Waiting for checks";
    readinessNoteEl.textContent = readiness.note;
    readinessChecklistEl.innerHTML = "";
    return;
  }

  readinessSymbolEl.textContent = `${closest.symbol} - ${closest.company ?? "Tracked ticker"}`;
  readinessTitleEl.textContent = closest.ready
    ? `${closest.setupType} is paper-trade ready`
    : `${closest.passedChecks}/${closest.totalChecks} checks passed`;
  readinessNoteEl.textContent = closest.ready
    ? `${closest.catalystImpact} catalyst: ${closest.catalystTitle}`
    : `Blocked by: ${closest.blockers.join(", ") || "waiting for a clean signal"}`;
  readinessChecklistEl.innerHTML = closest.checks
    .map(
      (check) => `
        <div class="${checkClass(check.passed)}">
          <strong>${check.passed ? "Pass" : "Wait"}</strong>
          <div>
            <span>${check.label}</span>
            <p>${check.detail}</p>
          </div>
        </div>
      `
    )
    .join("");
}

function renderList() {
  const items = filteredOpportunities();
  resultCountEl.textContent = resultCountText(items.length);
  opportunitiesEl.innerHTML = "";

  for (const item of items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `ticker-row ${item.symbol === selectedSymbol ? "selected" : ""}`;
    row.innerHTML = `
      <div>
        <div class="symbol">${item.symbol}</div>
        <div class="company">${item.company}</div>
        <span class="${dataQualityClass(item.dataQuality?.tier)}">${item.dataQuality?.label ?? "Unknown"}</span>
        <span class="${catalystClass(item.researchSummary?.impact)}">${item.researchSummary?.impact ?? "No Catalyst"}</span>
        <span class="${setupClass(item.dayTradeSetup?.type)}">${item.dayTradeSetup?.type ?? "No Setup"}</span>
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
      refreshDetail();
      render();
    });
    opportunitiesEl.append(row);
  }

  if (!selectedSymbol && items.length) selectedSymbol = items[0].symbol;
}

function renderDetail(force = false) {
  const item =
    detailOpportunity ??
    snapshot.opportunities.find((candidate) => candidate.symbol === selectedSymbol) ??
    rankedOpportunities.find((candidate) => candidate.symbol === selectedSymbol);
  if (!item) {
    detailPriorityEl.textContent = "Select a ticker";
    detailEl.className = "empty-state";
    detailEl.textContent = "No ticker matches the current filter.";
    return;
  }

  detailPriorityEl.textContent = detailStatusText(item);
  const detailKey = `${item.symbol}:${item.updatedAt}:${item.signalDecision?.label ?? ""}`;
  if (!force && renderedDetailKey === detailKey) return;
  renderedDetailKey = detailKey;
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
      <div><span>Data Source</span><strong>${item.dataQuality?.label ?? "-"}</strong></div>
      <div><span>Trust Level</span><strong>${item.dataQuality?.isRealTimeTrusted ? "Day-trade trusted" : "Testing only"}</strong></div>
      <div><span>Catalyst Impact</span><strong>${item.researchSummary?.impact ?? "-"}</strong></div>
      <div><span>Real Sources</span><strong>${item.researchSummary?.realCatalystCount ?? 0}</strong></div>
      <div><span>Day Setup</span><strong>${item.dayTradeSetup?.type ?? "-"}</strong></div>
      <div><span>Setup Quality</span><strong>${(item.dayTradeSetup?.quality ?? 0).toFixed(0)}</strong></div>
    </div>
    <p class="data-note">${item.dataQuality?.note ?? "No data-quality note available."}</p>
    <h3>Day-Trade Setup</h3>
    <div class="setup-card">
      <div>
        <span>Pattern</span>
        <strong>${item.dayTradeSetup?.type ?? "No Clean Day-Trade Setup"} - ${item.dayTradeSetup?.direction ?? "Wait"}</strong>
      </div>
      <div>
        <span>Trigger</span>
        <strong>${item.dayTradeSetup?.trigger ?? "Wait for confirmation"}</strong>
      </div>
      <div class="setup-levels">
        <div><span>Entry</span><strong>${money(item.dayTradeSetup?.entry ?? item.entryZone[1])}</strong></div>
        <div><span>Stop</span><strong>${money(item.dayTradeSetup?.stop ?? item.stop)}</strong></div>
        <div><span>Target</span><strong>${money(item.dayTradeSetup?.target ?? item.target)}</strong></div>
        <div><span>R/R</span><strong>${(item.dayTradeSetup?.rewardRisk ?? 0).toFixed(2)}x</strong></div>
      </div>
      <p>${(item.dayTradeSetup?.reasons ?? []).join(" - ")}</p>
      <p class="meta">Invalidation: ${item.dayTradeSetup?.invalidation ?? "No trade until a clean setup appears."}</p>
    </div>
    <h3>Catalyst Research</h3>
    <div class="catalyst-card">
      <div>
        <span>Top Catalyst</span>
        <strong>${item.researchSummary?.topCatalyst?.title ?? "No real catalyst found yet"}</strong>
      </div>
      <div>
        <span>Likely Impact</span>
        <strong>${item.researchSummary?.impact ?? "Unknown"} - ${item.researchSummary?.topCatalyst?.horizon ?? "unknown"}</strong>
      </div>
      <div>
        <span>Confidence</span>
        <strong>${(item.researchSummary?.confidence ?? 0).toFixed(0)}%</strong>
      </div>
      <p>${item.researchSummary?.whyItMatters ?? "No current real catalyst found yet."}</p>
      <p class="meta">${item.researchSummary?.risk ?? "Catalyst risk unavailable."}</p>
    </div>
    <div class="catalyst-list">
      ${(item.researchSummary?.events ?? [])
        .map(
          (event) => `
            <div class="catalyst-item">
              <div>
                <strong>${event.impact} ${event.type}</strong>
                <span>${event.title}</span>
              </div>
              ${
                event.url
                  ? `<a href="${event.url}" target="_blank" rel="noreferrer">Source</a>`
                  : `<span class="meta">No link</span>`
              }
            </div>
          `
        )
        .join("")}
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
  renderPaperJournal(backtest.recentPaperTrades ?? []);
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

function renderPaperJournal(trades) {
  paperJournalCountEl.textContent = trades.length;
  paperJournalListEl.innerHTML =
    trades.length === 0
      ? `<div class="empty-state">No journal entries yet. A paper trade is only logged after a real-data, real-catalyst Signal opens.</div>`
      : trades
          .slice(0, 8)
          .map(
            (trade) => `
              <div class="journal-entry ${trade.status}">
                <div>
                  <strong>${trade.symbol}</strong>
                  <span>${trade.status}${trade.exitReason ? ` - ${trade.exitReason}` : ""}</span>
                </div>
                <div>
                  <span>Setup</span>
                  <strong>${trade.setup?.type ?? "Legacy trade"}</strong>
                </div>
                <div>
                  <span>Catalyst</span>
                  <strong>${trade.research?.impact ?? "Unknown"}</strong>
                </div>
                <div>
                  <span>Data</span>
                  <strong>${trade.dataQuality?.label ?? "Unknown"}</strong>
                </div>
                <div>
                  <span>P/L</span>
                  <strong>${signedPct(trade.pnlPct ?? 0)} / ${money(trade.pnlDollars ?? 0)}</strong>
                </div>
              </div>
            `
          )
          .join("");
}

function render() {
  if (!snapshot) return;
  renderSummary();
  renderScanStatus();
  renderDataHealth();
  renderSignalGate();
  renderPaperReadiness();
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
refreshListEl.addEventListener("click", refreshRankedList);
refreshDetailEl.addEventListener("click", refreshDetail);
runResearchScanEl.addEventListener("click", async () => {
  runResearchScanEl.disabled = true;
  runResearchScanEl.textContent = "Starting Scan";
  try {
    const response = await fetch("/api/run-scan", { method: "POST" });
    const payload = await response.json();
    scanStatus = payload.status;
    renderScanStatus();
  } catch {
    scanStateEl.textContent = "Error";
    runResearchScanEl.disabled = false;
    runResearchScanEl.textContent = "Run Research Scan";
  }
});

const events = new EventSource("/events");
events.onmessage = (event) => {
  snapshot = JSON.parse(event.data);
  if (!selectedSymbol && snapshot.opportunities.length) {
    selectedSymbol = snapshot.opportunities[0].symbol;
  }
  const shouldRefreshList =
    rankedOpportunities.length === 0 || Date.now() - lastRankedRefresh >= RANKED_REFRESH_MS;
  if (shouldRefreshList) {
    refreshRankedList();
  } else {
    listHasNewData = true;
    resultCountEl.textContent = resultCountText(filteredOpportunities().length);
  }
  const shouldRefreshDetail =
    !detailOpportunity ||
    detailOpportunity.symbol !== selectedSymbol ||
    Date.now() - lastDetailRefresh >= DETAIL_REFRESH_MS;
  if (shouldRefreshDetail) {
    refreshDetail();
  } else if (latestSelectedOpportunity()) {
    detailHasNewData = true;
    detailPriorityEl.textContent = detailStatusText(detailOpportunity);
  }
  renderSummary();
  renderScanStatus();
  renderDataHealth();
  renderSignalGate();
  renderPaperReadiness();
  renderScan();
  renderDetail();
  renderLearning();
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

async function refreshScanStatus() {
  try {
    const response = await fetch("/api/scan-status");
    if (!response.ok) return;
    scanStatus = await response.json();
    renderScanStatus();
  } catch {
    scanStateEl.textContent = "Offline";
  }
}

refreshBacktest();
refreshScanStatus();
setInterval(refreshBacktest, 5000);
setInterval(refreshScanStatus, 3000);
