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

let snapshot = null;
let selectedSymbol = null;

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

function priorityClass(priority) {
  if (priority === "High") return "priority";
  if (priority === "Medium") return "priority medium";
  return "priority watch";
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
        <span class="${priorityClass(item.priority)}">${item.priority}</span>
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

  detailPriorityEl.textContent = `${item.priority} - ${item.action}`;
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
    </div>
    <h3>Why It Is Flagged</h3>
    <ul class="reason-list">
      ${item.reasons.map((reason) => `<li>${reason}</li>`).join("")}
    </ul>
    <h3>Risk Note</h3>
    <p class="meta">${item.risk.note}</p>
  `;
}

function render() {
  if (!snapshot) return;
  renderSummary();
  renderList();
  renderDetail();
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
