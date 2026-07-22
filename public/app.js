const opportunitiesEl = document.querySelector("#opportunities");
const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const viewSections = [...document.querySelectorAll("[data-view]")];
const previousViewEl = document.querySelector("#previousView");
const nextViewEl = document.querySelector("#nextView");
const viewCounterEl = document.querySelector("#viewCounter");
const currentViewTitleEl = document.querySelector("#currentViewTitle");
const currentViewDescriptionEl = document.querySelector("#currentViewDescription");
const viewDotsEl = document.querySelector("#viewDots");
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
const paperControlStateEl = document.querySelector("#paperControlState");
const paperEnabledEl = document.querySelector("#paperEnabled");
const paperAllowSimulationEl = document.querySelector("#paperAllowSimulation");
const paperAccountSizeEl = document.querySelector("#paperAccountSize");
const paperRiskPctEl = document.querySelector("#paperRiskPct");
const paperMaxPositionEl = document.querySelector("#paperMaxPosition");
const paperMaxOpenEl = document.querySelector("#paperMaxOpen");
const paperMaxDailyEl = document.querySelector("#paperMaxDaily");
const savePaperControlsEl = document.querySelector("#savePaperControls");
const paperControlNoteEl = document.querySelector("#paperControlNote");
const morningTestStateEl = document.querySelector("#morningTestState");
const morningTestEnabledEl = document.querySelector("#morningTestEnabled");
const morningTestStartEl = document.querySelector("#morningTestStart");
const morningTestEndEl = document.querySelector("#morningTestEnd");
const morningTestIntervalEl = document.querySelector("#morningTestInterval");
const morningTestMaxTradesEl = document.querySelector("#morningTestMaxTrades");
const morningTestMaxLossesEl = document.querySelector("#morningTestMaxLosses");
const morningTestMaxDrawdownEl = document.querySelector("#morningTestMaxDrawdown");
const morningTestNoteEl = document.querySelector("#morningTestNote");
const strategySampleSizeEl = document.querySelector("#strategySampleSize");
const labArtifactsSavedEl = document.querySelector("#labArtifactsSaved");
const labClosedTradesEl = document.querySelector("#labClosedTrades");
const labModeSplitEl = document.querySelector("#labModeSplit");
const labStorageStateEl = document.querySelector("#labStorageState");
const labChartStatusEl = document.querySelector("#labChartStatus");
const strategyCurveChartEl = document.querySelector("#strategyCurveChart");
const simTotalReturnEl = document.querySelector("#simTotalReturn");
const simOpenTradesEl = document.querySelector("#simOpenTrades");
const simClosedTradesEl = document.querySelector("#simClosedTrades");
const labExportRowsEl = document.querySelector("#labExportRows");
const simWinRateEl = document.querySelector("#simWinRate");
const simProfitFactorEl = document.querySelector("#simProfitFactor");
const simDrawdownEl = document.querySelector("#simDrawdown");
const invalidatedTradesEl = document.querySelector("#invalidatedTrades");
const strategyNoteEl = document.querySelector("#strategyNote");
const setupReportCountEl = document.querySelector("#setupReportCount");
const setupReportListEl = document.querySelector("#setupReportList");
const tradeReviewCountEl = document.querySelector("#tradeReviewCount");
const tradeReviewListEl = document.querySelector("#tradeReviewList");
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
const journalCurrentCountEl = document.querySelector("#journalCurrentCount");
const journalLegacyCountEl = document.querySelector("#journalLegacyCount");
const journalQuestionableCountEl = document.querySelector("#journalQuestionableCount");
const journalWorstFailureEl = document.querySelector("#journalWorstFailure");

let snapshot = null;
let rankedOpportunities = [];
let detailOpportunity = null;
let selectedSymbol = null;
let backtest = null;
let paperControls = null;
let strategyReport = null;
let lastRankedRefresh = 0;
let lastDetailRefresh = 0;
let renderedDetailKey = null;
let listHasNewData = false;
let detailHasNewData = false;
let scanStatus = null;
let activeView = "radar";

const RANKED_REFRESH_MS = 10000;
const DETAIL_REFRESH_MS = 10000;
const views = [
  {
    id: "radar",
    title: "Radar",
    description: "Live trade candidates, controls, and readiness checks."
  },
  {
    id: "lab",
    title: "Research Lab",
    description: "Performance curve, exported artifacts, and setup-level results."
  },
  {
    id: "review",
    title: "Review Desk",
    description: "Trade grades, failure reasons, journal review, and learning loop."
  },
  {
    id: "data",
    title: "Data Health",
    description: "Provider quality, market scan coverage, and fallback visibility."
  }
];

function setActiveView(view) {
  activeView = view;
  const index = Math.max(0, views.findIndex((item) => item.id === view));
  const meta = views[index] ?? views[0];
  for (const button of viewButtons) {
    button.classList.toggle("active", button.dataset.viewTarget === view);
  }
  for (const section of viewSections) {
    section.hidden = section.dataset.view !== view;
  }
  viewCounterEl.textContent = `${index + 1} / ${views.length}`;
  currentViewTitleEl.textContent = meta.title;
  currentViewDescriptionEl.textContent = meta.description;
  previousViewEl.disabled = index === 0;
  nextViewEl.disabled = index === views.length - 1;
  viewDotsEl.innerHTML = views
    .map((item) => `<span class="${item.id === view ? "active" : ""}"></span>`)
    .join("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function moveView(direction) {
  const index = Math.max(0, views.findIndex((item) => item.id === activeView));
  const nextIndex = Math.min(views.length - 1, Math.max(0, index + direction));
  setActiveView(views[nextIndex].id);
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function isFallbackQuote(item) {
  return item?.dataQuality?.tier === "fallback" || item?.dataQuality?.source === "mock";
}

function quoteMoney(item, value) {
  return `${isFallbackQuote(item) ? "SIM " : ""}${money(value)}`;
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function signedPct(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${pct(value)}`;
}

function ratio(value) {
  if (value === Infinity) return "∞";
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

function modeForTrade(trade) {
  if (trade.review?.mode) return trade.review.mode;
  if (trade.dataQuality?.isRealTimeTrusted) return "strict";
  return trade.setup && trade.research && trade.dataQuality ? "simulation" : "legacy";
}

function gradeTrade(trade) {
  if (!trade.setup || !trade.research || !trade.dataQuality) return "LEG";
  if (trade.review?.invalidated || trade.exitReason === "simulation-anomaly") return "F";
  if (trade.status === "open") return "OPEN";
  const pnl = trade.pnlPct ?? 0;
  const dataPenalty = trade.dataQuality?.isRealTimeTrusted ? 0 : 1;
  const blockerPenalty = trade.review?.blockersAtEntry?.length ? 1 : 0;
  const score = pnl >= 0.04 ? 5 : pnl >= 0.015 ? 4 : pnl >= 0 ? 3 : pnl > -0.03 ? 2 : 1;
  const adjusted = Math.max(1, score - dataPenalty - blockerPenalty);
  return adjusted >= 5 ? "A" : adjusted >= 4 ? "B" : adjusted >= 3 ? "C" : adjusted >= 2 ? "D" : "F";
}

function analyzeTrade(trade) {
  const mode = modeForTrade(trade);
  const problems = [];
  if (!trade.setup || !trade.research || !trade.dataQuality) problems.push("legacy row lacks setup/research review data");
  if (mode === "simulation") problems.push("simulation only");
  if (!trade.dataQuality?.isRealTimeTrusted) problems.push(`${trade.dataQuality?.label ?? "untrusted"} data`);
  if (trade.review?.blockersAtEntry?.length) problems.push(trade.review.blockersAtEntry[0]);
  if (trade.exitReason === "stop") problems.push("stopped out");
  if (trade.exitReason === "simulation-anomaly") problems.push("fake-price anomaly");
  if ((trade.pnlPct ?? 0) < 0) problems.push("negative P/L");
  if (trade.status === "open") problems.push("still open");
  if (trade.review?.invalidated) problems.push(trade.review.invalidationReason ?? "invalidated");

  const validity = !trade.setup || !trade.research || !trade.dataQuality
    ? "legacy"
    : trade.review?.invalidated || trade.exitReason === "simulation-anomaly"
    ? "invalid"
    : mode === "simulation" || !trade.dataQuality?.isRealTimeTrusted || trade.review?.blockersAtEntry?.length
    ? "questionable"
    : "valid";

  return {
    mode,
    grade: gradeTrade(trade),
    validity,
    problems: problems.length ? problems : ["clean review row"]
  };
}

function renderCurveChart(points = []) {
  const width = 760;
  const height = 280;
  const pad = { top: 22, right: 28, bottom: 42, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const usable = points.length > 1 ? points : [
    { cumulativeReturn: 0, benchmarkReturn: 0, label: "Start" },
    { cumulativeReturn: 0, benchmarkReturn: 0, label: "Waiting" }
  ];
  const values = usable.flatMap((point) => [point.cumulativeReturn ?? 0, point.benchmarkReturn ?? 0]);
  const minValue = Math.min(-0.02, ...values);
  const maxValue = Math.max(0.02, ...values);
  const range = maxValue - minValue || 1;
  const x = (index) => pad.left + (usable.length === 1 ? 0 : (index / (usable.length - 1)) * plotWidth);
  const y = (value) => pad.top + ((maxValue - value) / range) * plotHeight;
  const pathFor = (key) =>
    usable
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(point[key] ?? 0).toFixed(2)}`)
      .join(" ");
  const ticks = [maxValue, (maxValue + minValue) / 2, minValue];
  const finalReturn = usable.at(-1)?.cumulativeReturn ?? 0;
  const finalLabel = points.length > 1 ? signedPct(finalReturn) : "Need closed trades";

  strategyCurveChartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="strategyLineGlow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="var(--cyan)" />
          <stop offset="100%" stop-color="var(--green)" />
        </linearGradient>
      </defs>
      <rect class="chart-bg" x="0" y="0" width="${width}" height="${height}" rx="8"></rect>
      ${ticks
        .map(
          (tick) => `
            <g>
              <line class="chart-grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${y(tick).toFixed(2)}" y2="${y(tick).toFixed(2)}"></line>
              <text class="chart-axis-label" x="14" y="${(y(tick) + 4).toFixed(2)}">${pct(tick)}</text>
            </g>
          `
        )
        .join("")}
      <line class="chart-zero-line" x1="${pad.left}" x2="${width - pad.right}" y1="${y(0).toFixed(2)}" y2="${y(0).toFixed(2)}"></line>
      <path class="benchmark-line" d="${pathFor("benchmarkReturn")}"></path>
      <path class="strategy-line" d="${pathFor("cumulativeReturn")}"></path>
      <circle class="strategy-dot" cx="${x(usable.length - 1).toFixed(2)}" cy="${y(finalReturn).toFixed(2)}" r="4"></circle>
      <text class="chart-final-label" x="${width - pad.right - 120}" y="${pad.top + 18}">${finalLabel}</text>
      <text class="chart-axis-label" x="${pad.left}" y="${height - 14}">Start</text>
      <text class="chart-axis-label" x="${width - pad.right - 84}" y="${height - 14}">Latest close</text>
    </svg>
  `;
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
  renderMorningTestStatus(scanStatus?.morningTest);
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
  renderPaperControls(paper.controls ?? paperControls, paper.note);

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

function renderPaperControls(controls, note = null) {
  if (!controls) return;
  paperControls = controls;
  paperControlStateEl.textContent = controls.enabled ? "Enabled" : "Off";
  paperControlStateEl.className = controls.enabled ? "state-pill armed" : "state-pill blocked";
  paperEnabledEl.checked = controls.enabled;
  paperAllowSimulationEl.checked = controls.allowSimulation === true;
  paperAccountSizeEl.value = controls.accountSize ?? 10000;
  paperRiskPctEl.value = ((controls.riskPerTradePct ?? 0.005) * 100).toFixed(2);
  paperMaxPositionEl.value = controls.maxPositionNotional ?? 1000;
  paperMaxOpenEl.value = controls.maxOpenTrades ?? 3;
  paperMaxDailyEl.value = controls.maxTradesPerDay ?? 5;
  morningTestEnabledEl.checked = controls.morningTestEnabled === true;
  morningTestStartEl.value = controls.morningTestStart ?? "09:35";
  morningTestEndEl.value = controls.morningTestEnd ?? "11:30";
  morningTestIntervalEl.value = controls.morningTestIntervalMinutes ?? 5;
  morningTestMaxTradesEl.value = controls.morningTestMaxTrades ?? 5;
  morningTestMaxLossesEl.value = controls.morningTestMaxLosses ?? 2;
  morningTestMaxDrawdownEl.value = ((controls.morningTestMaxDrawdownPct ?? 0.03) * 100).toFixed(1);
  const tradesToday = controls.tradesOpenedToday ?? 0;
  const modeNote = controls.allowSimulation
    ? `Profit-first simulation now requires trusted data, a real catalyst, score ${controls.minSimulationScore ?? 75}+, setup ${controls.minSimulationSetupQuality ?? 72}+, R/R ${ratio(controls.minSimulationRewardRisk ?? 1.8)}x+, probability ${pct(controls.minSimulationProbability ?? 0.64)}+, long-only.`
    : "Only strict real-data and real-catalyst entries are allowed.";
  paperControlNoteEl.textContent =
    note ??
    `${tradesToday}/${controls.maxTradesPerDay ?? 5} trades opened today. ${modeNote}`;
}

function renderMorningTestStatus(status) {
  if (!status) {
    morningTestStateEl.textContent = morningTestEnabledEl.checked ? "Armed" : "Off";
    morningTestStateEl.className = morningTestEnabledEl.checked ? "state-pill armed" : "state-pill blocked";
    return;
  }
  morningTestStateEl.textContent = status.active ? "Active" : status.enabled ? "Armed" : "Off";
  morningTestStateEl.className = status.active || status.enabled ? "state-pill armed" : "state-pill blocked";
  const config = status.config ?? {};
  const next = status.nextScanAt ? ` Next scan: ${new Date(status.nextScanAt).toLocaleTimeString()}.` : "";
  morningTestNoteEl.textContent =
    `${status.message ?? "Waiting."} Window ${config.start ?? "09:35"}-${config.end ?? "11:30"} ET, every ${config.intervalMinutes ?? 5} min, max ${config.maxTrades ?? 5} trades, stop after ${config.maxLosses ?? 2} losses or ${pct(config.maxDrawdownPct ?? 0.03)} drawdown.${next}`;
}

function renderStrategyReport() {
  if (!strategyReport) return;
  const simulation = strategyReport.simulation ?? {};
  const lab = strategyReport.lab ?? {};
  const setups = strategyReport.bySetup ?? [];
  const reviews = strategyReport.recentReviews ?? [];
  const curve = strategyReport.equityCurve ?? [];

  strategySampleSizeEl.textContent = `${strategyReport.sampleSize ?? 0} trades`;
  labArtifactsSavedEl.textContent = lab.artifactsSaved ?? strategyReport.sampleSize ?? 0;
  labClosedTradesEl.textContent = lab.closedForMetrics ?? simulation.closed ?? 0;
  labModeSplitEl.textContent = `${lab.dataModes?.strict ?? 0} / ${lab.dataModes?.simulation ?? 0}`;
  labStorageStateEl.textContent = lab.storage ? "Saved" : "Waiting";
  labChartStatusEl.textContent =
    (simulation.closed ?? 0) > 0 ? `${simulation.closed} closed trades plotted` : "Waiting for closed trades";
  simTotalReturnEl.textContent = signedPct(curve.at(-1)?.cumulativeReturn ?? 0);
  simOpenTradesEl.textContent = simulation.open ?? 0;
  simClosedTradesEl.textContent = simulation.closed ?? 0;
  labExportRowsEl.textContent = lab.decisionsExportable ?? 0;
  simWinRateEl.textContent = pct(simulation.winRate ?? 0);
  simProfitFactorEl.textContent = ratio(simulation.profitFactor ?? 0);
  simDrawdownEl.textContent = signedPct(simulation.maxDrawdown ?? 0);
  invalidatedTradesEl.textContent = strategyReport.invalidatedCount ?? 0;
  strategyNoteEl.textContent = strategyReport.note ?? "Waiting for strategy data.";
  renderCurveChart(curve);

  setupReportCountEl.textContent = setups.length;
  setupReportListEl.innerHTML =
    setups.length === 0
      ? `<div class="empty-state">No setup history yet. Run paper trades first, then this will rank which setups are actually working.</div>`
      : setups
          .slice(0, 8)
          .map(
            (setup) => `
              <div class="intel-item strategy-item">
                <div>
                  <strong>${setup.setup}</strong>
                  <span>${setup.closed} closed / ${setup.open} open</span>
                </div>
                <div class="strategy-stats">
                  <span>Win ${pct(setup.winRate ?? 0)}</span>
                  <span>PF ${ratio(setup.profitFactor ?? 0)}</span>
                  <span>DD ${signedPct(setup.maxDrawdown ?? 0)}</span>
                </div>
              </div>
            `
          )
          .join("");

  tradeReviewCountEl.textContent = reviews.length;
  tradeReviewListEl.innerHTML =
    reviews.length === 0
      ? `<div class="empty-state">No trade reviews yet. Each new paper trade will store its entry reason, mode, setup, catalyst, and exit result.</div>`
      : reviews
          .slice(0, 8)
          .map(
            (trade) => `
              <div class="intel-item strategy-item ${trade.review?.invalidated ? "invalidated" : ""}">
                <div>
                  <strong>${trade.symbol} · ${trade.mode}</strong>
                  <span>${trade.status}${trade.exitReason ? ` - ${trade.exitReason}` : ""}</span>
                </div>
                <div class="strategy-stats">
                  <span>${trade.setup}</span>
                  <span>${trade.data}</span>
                  <span>${signedPct(trade.pnlPct ?? 0)} / ${money(trade.pnlDollars ?? 0)}</span>
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
    if (isFallbackQuote(item)) row.classList.add("simulated");
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
        <span class="quote-preview">${quoteMoney(item, item.price)}</span>
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
      <div class="price ${isFallbackQuote(item) ? "simulated-price" : ""}">${quoteMoney(item, item.price)}</div>
    </div>
    ${
      isFallbackQuote(item)
        ? `<div class="sim-warning">Simulation price only. Polygon did not return usable bars for this ticker, so this quote will not match live trading apps.</div>`
        : ""
    }
    <div class="detail-grid">
      <div><span>Confidence</span><strong>${item.confidence.toFixed(0)}%</strong></div>
      <div><span>Relative Volume</span><strong>${item.technical.relativeVolume.toFixed(2)}x</strong></div>
      <div><span>Entry Zone</span><strong>${quoteMoney(item, item.entryZone[0])} - ${quoteMoney(item, item.entryZone[1])}</strong></div>
      <div><span>Stop / Target</span><strong>${quoteMoney(item, item.stop)} / ${quoteMoney(item, item.target)}</strong></div>
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
        <div><span>Entry</span><strong>${quoteMoney(item, item.dayTradeSetup?.entry ?? item.entryZone[1])}</strong></div>
        <div><span>Stop</span><strong>${quoteMoney(item, item.dayTradeSetup?.stop ?? item.stop)}</strong></div>
        <div><span>Target</span><strong>${quoteMoney(item, item.dayTradeSetup?.target ?? item.target)}</strong></div>
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
  const analyzed = trades.map((trade) => ({ trade, analysis: analyzeTrade(trade) }));
  const current = analyzed.filter(({ analysis }) => analysis.validity !== "legacy");
  const legacy = analyzed.length - current.length;
  const questionable = current.filter(({ analysis }) => analysis.validity !== "valid").length;
  const failureCounts = new Map();
  for (const { analysis } of analyzed) {
    const key = analysis.problems[0];
    if (!key || key === "clean review row") continue;
    failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1);
  }
  const worstFailure = [...failureCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  paperJournalCountEl.textContent = trades.length;
  journalCurrentCountEl.textContent = current.length;
  journalLegacyCountEl.textContent = legacy;
  journalQuestionableCountEl.textContent = questionable;
  journalWorstFailureEl.textContent = worstFailure ? `${worstFailure[0]} (${worstFailure[1]})` : "None yet";
  paperJournalListEl.innerHTML =
    trades.length === 0
      ? `<div class="empty-state">No journal entries yet. A paper trade is only logged after a real-data, real-catalyst Signal opens.</div>`
      : analyzed
          .slice(0, 12)
          .map(
            ({ trade, analysis }) => `
              <div class="journal-entry ${trade.status} ${analysis.validity}">
                <div class="journal-symbol-cell">
                  <strong>${trade.symbol}</strong>
                  <span>${trade.status}${trade.exitReason ? ` - ${trade.exitReason}` : ""}</span>
                  <div class="journal-pills">
                    <em class="grade-pill grade-${analysis.grade.toLowerCase()}">${analysis.grade}</em>
                    <em class="validity-pill ${analysis.validity}">${analysis.validity}</em>
                    <em>${analysis.mode}</em>
                  </div>
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
                <div class="journal-diagnosis">
                  <span>Diagnosis</span>
                  <strong>${analysis.problems.slice(0, 3).join(" - ")}</strong>
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
  renderStrategyReport();
}

scoreFilterEl.addEventListener("input", () => {
  scoreValueEl.textContent = scoreFilterEl.value;
  render();
});

priorityFilterEl.addEventListener("change", render);
for (const button of viewButtons) {
  button.addEventListener("click", () => setActiveView(button.dataset.viewTarget));
}
previousViewEl.addEventListener("click", () => moveView(-1));
nextViewEl.addEventListener("click", () => moveView(1));
window.addEventListener("keydown", (event) => {
  if (event.target?.matches?.("input, select, textarea")) return;
  if (event.key === "ArrowLeft") moveView(-1);
  if (event.key === "ArrowRight") moveView(1);
});
refreshListEl.addEventListener("click", refreshRankedList);
refreshDetailEl.addEventListener("click", refreshDetail);
savePaperControlsEl.addEventListener("click", async () => {
  savePaperControlsEl.disabled = true;
  savePaperControlsEl.textContent = "Saving";
  const payload = {
    enabled: paperEnabledEl.checked,
    allowSimulation: paperAllowSimulationEl.checked,
    accountSize: Number(paperAccountSizeEl.value),
    riskPerTradePct: Number(paperRiskPctEl.value) / 100,
    maxPositionNotional: Number(paperMaxPositionEl.value),
    maxOpenTrades: Number(paperMaxOpenEl.value),
    maxTradesPerDay: Number(paperMaxDailyEl.value),
    morningTestEnabled: morningTestEnabledEl.checked,
    morningTestStart: morningTestStartEl.value,
    morningTestEnd: morningTestEndEl.value,
    morningTestIntervalMinutes: Number(morningTestIntervalEl.value),
    morningTestMaxTrades: Number(morningTestMaxTradesEl.value),
    morningTestMaxLosses: Number(morningTestMaxLossesEl.value),
    morningTestMaxDrawdownPct: Number(morningTestMaxDrawdownEl.value) / 100
  };
  try {
    const response = await fetch("/api/paper-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    paperControls = await response.json();
    renderPaperControls(paperControls, "Controls saved. The next research scan will use these limits.");
    refreshStrategyReport();
  } catch {
    paperControlNoteEl.textContent = "Could not save controls.";
  } finally {
    savePaperControlsEl.disabled = false;
    savePaperControlsEl.textContent = "Save Controls";
  }
});
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
  renderStrategyReport();
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

async function refreshPaperControls() {
  try {
    const response = await fetch("/api/paper-controls");
    if (!response.ok) return;
    renderPaperControls(await response.json());
  } catch {
    paperControlNoteEl.textContent = "Paper controls offline.";
  }
}

async function refreshStrategyReport() {
  try {
    const response = await fetch("/api/strategy-report");
    if (!response.ok) return;
    strategyReport = await response.json();
    renderStrategyReport();
  } catch {
    strategyNoteEl.textContent = "Strategy report offline.";
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

setActiveView(activeView);
refreshBacktest();
refreshScanStatus();
refreshPaperControls();
refreshStrategyReport();
setInterval(refreshBacktest, 5000);
setInterval(refreshScanStatus, 3000);
setInterval(refreshStrategyReport, 7000);
