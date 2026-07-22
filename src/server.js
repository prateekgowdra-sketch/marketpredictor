import http from "node:http";
import { fork } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "./config.js";
import { getBacktestSummary } from "./backtest.js";
import { buildStrategyReport } from "./strategyReport.js";
import {
  getPaperTradeStats,
  getPaperTradesForReport,
  getRecentPaperTrades,
  getRecentPredictions,
  getRecentResearchEvents,
  getRecentSignals
} from "./database.js";
import { getPaperControls, paperControlsEnv, savePaperControls } from "./paperControls.js";

loadEnv();

const port = Number(process.env.PORT ?? 3001);
const updateIntervalMs = Number(process.env.MARKET_UPDATE_INTERVAL_MS ?? 60000);
const continuousResearch = process.env.ENABLE_CONTINUOUS_RESEARCH === "true";
const scanOnStartup = process.env.RUN_SCAN_ON_STARTUP === "true";
const publicDir = path.join(process.cwd(), "public");
const clients = new Set();
let latestSnapshot = createBootSnapshot();
let scanProcess = null;
let scanStatus = {
  state: scanOnStartup || continuousResearch ? "starting" : "idle",
  lastStartedAt: null,
  lastCompletedAt: null,
  lastError: null,
  reason: scanOnStartup || continuousResearch ? "startup" : "manual",
  continuous: continuousResearch
};
let morningTestStatus = {
  enabled: false,
  active: false,
  lastCheckedAt: null,
  lastScanAt: null,
  nextScanAt: null,
  message: "Morning Test Mode is off."
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, payload) {
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function minutesFromTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatLocalIso(date) {
  return new Date(date).toISOString();
}

function morningTestWindow(controls, now = new Date()) {
  const day = now.getDay();
  const weekday = day >= 1 && day <= 5;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesFromTime(controls.morningTestStart);
  const end = minutesFromTime(controls.morningTestEnd);
  return {
    weekday,
    active: controls.morningTestEnabled && weekday && current >= start && current <= end,
    start,
    end
  };
}

function refreshMorningTestStatus(message = null) {
  const controls = getPaperControls();
  const now = new Date();
  const windowState = morningTestWindow(controls, now);
  const intervalMs = controls.morningTestIntervalMinutes * 60000;
  const lastScanMs = morningTestStatus.lastScanAt ? new Date(morningTestStatus.lastScanAt).getTime() : null;
  const nextMs = lastScanMs ? lastScanMs + intervalMs : now.getTime();
  morningTestStatus = {
    ...morningTestStatus,
    enabled: controls.morningTestEnabled,
    active: windowState.active,
    lastCheckedAt: formatLocalIso(now),
    nextScanAt: controls.morningTestEnabled ? formatLocalIso(nextMs) : null,
    config: {
      start: controls.morningTestStart,
      end: controls.morningTestEnd,
      intervalMinutes: controls.morningTestIntervalMinutes,
      maxTrades: controls.morningTestMaxTrades,
      maxLosses: controls.morningTestMaxLosses,
      maxDrawdownPct: controls.morningTestMaxDrawdownPct
    },
    message:
      message ??
      (!controls.morningTestEnabled
        ? "Morning Test Mode is off."
        : !windowState.weekday
          ? "Morning Test Mode waits for a weekday market session."
          : windowState.active
            ? "Morning Test Mode is armed for scheduled scans."
            : `Morning Test Mode is outside the ${controls.morningTestStart}-${controls.morningTestEnd} ET window.`)
  };
  return { controls, intervalMs, nextMs, windowState };
}

function sendDownload(response, filename, contentType, body) {
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`
  });
  response.end(body);
}

function csvCell(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function flattenPaperTrade(trade) {
  return {
    id: trade.id,
    symbol: trade.symbol,
    status: trade.status,
    mode: trade.review?.mode ?? (trade.dataQuality?.isRealTimeTrusted ? "strict" : "simulation"),
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    notional: trade.notional,
    stop: trade.stop,
    target: trade.target,
    exitReason: trade.exitReason,
    pnlPct: trade.pnlPct,
    pnlDollars: trade.pnlDollars,
    maxGainPct: trade.maxGainPct,
    maxDrawdownPct: trade.maxDrawdownPct,
    ticksHeld: trade.ticksHeld,
    setup: trade.setup?.type,
    catalyst: trade.research?.title ?? trade.research?.impact,
    dataLabel: trade.dataQuality?.label,
    simulationOnly: trade.review?.simulationOnly,
    invalidated: trade.review?.invalidated,
    entryReason: trade.review?.entryReason,
    blockersAtEntry: trade.review?.blockersAtEntry?.join("; "),
    confirmations: trade.review?.confirmations?.join("; ")
  };
}

function paperTradeCsv(trades) {
  const rows = trades.map(flattenPaperTrade);
  const headers = [
    "id",
    "symbol",
    "status",
    "mode",
    "openedAt",
    "closedAt",
    "entryPrice",
    "exitPrice",
    "quantity",
    "notional",
    "stop",
    "target",
    "exitReason",
    "pnlPct",
    "pnlDollars",
    "maxGainPct",
    "maxDrawdownPct",
    "ticksHeld",
    "setup",
    "catalyst",
    "dataLabel",
    "simulationOnly",
    "invalidated",
    "entryReason",
    "blockersAtEntry",
    "confirmations"
  ];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}

function createBootSnapshot() {
  return {
    tick: 0,
    provider: "loading",
    dataHealth: {
      provider: "loading",
      trackedSymbols: 0,
      realSymbols: 0,
      fallbackSymbols: 0,
      delayedSymbols: 0,
      rateLimitSkips: 0,
      requestFailures: 0,
      note: "Market engine is warming up. Run a research scan if results do not appear automatically."
    },
    generatedAt: new Date().toISOString(),
    summary: {
      highPriorityCount: 0,
      averageScore: 0,
      leadingSectors: [],
      marketTone: "Research engine warming up"
    },
    scan: {
      generatedAt: new Date().toISOString(),
      universeSize: 0,
      activeTracked: 0,
      deepCandidateCount: 0,
      candidates: []
    },
    signalSummary: { Signal: 0, Watch: 0, Reject: 0, actionRate: 0 },
    paperReadiness: {
      ready: false,
      readyCount: 0,
      checkedCount: 0,
      closest: null,
      candidates: [],
      note: "Waiting for the first research scan."
    },
    paper: {
      generatedAt: new Date().toISOString(),
      stats: getPaperTradeStats(),
      openTrades: [],
      recentTrades: getRecentPaperTrades(20)
    },
    opportunities: []
  };
}

function broadcastSnapshot() {
  const payload = `data: ${JSON.stringify(latestSnapshot)}\n\n`;
  for (const client of clients) client.write(payload);
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] ?? "text/plain" });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function handleEvents(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  response.write(`data: ${JSON.stringify(latestSnapshot)}\n\n`);
  clients.add(response);
  request.on("close", () => clients.delete(response));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/events") {
    handleEvents(request, response);
    return;
  }

  if (url.pathname === "/api/opportunities") {
    sendJson(response, latestSnapshot);
    return;
  }

  if (url.pathname === "/api/scan") {
    sendJson(response, latestSnapshot.scan ?? { error: "Scan not ready" });
    return;
  }

  if (url.pathname === "/api/scan-status") {
    refreshMorningTestStatus();
    sendJson(response, { ...scanStatus, morningTest: morningTestStatus });
    return;
  }

  if (url.pathname === "/api/morning-test") {
    refreshMorningTestStatus();
    sendJson(response, morningTestStatus);
    return;
  }

  if (url.pathname === "/api/run-scan") {
    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "POST" });
      response.end("Method Not Allowed");
      return;
    }
    const accepted = !scanProcess && !["queued", "running"].includes(scanStatus.state);
    if (accepted) {
      scanStatus = {
        ...scanStatus,
        state: "queued",
        lastError: null,
        reason: "manual"
      };
      setTimeout(() => startMarketUpdate("manual"), 0);
    }
    sendJson(response, {
      accepted,
      status: scanStatus,
      message: accepted ? "Research scan queued." : "Research scan is already running."
    });
    return;
  }

  if (url.pathname === "/api/signals") {
    sendJson(response, { signals: getRecentSignals(50) });
    return;
  }

  if (url.pathname === "/api/signal-decisions") {
    sendJson(response, {
      summary: latestSnapshot.signalSummary,
      decisions: latestSnapshot.opportunities.map((opportunity) => ({
        symbol: opportunity.symbol,
        price: opportunity.price,
        score: opportunity.score,
        priority: opportunity.priority,
        decision: opportunity.signalDecision,
        prediction: opportunity.prediction
      }))
    });
    return;
  }

  if (url.pathname === "/api/paper-trades") {
    sendJson(response, {
      generatedAt: new Date().toISOString(),
      stats: getPaperTradeStats(),
      trades: getRecentPaperTrades(50)
    });
    return;
  }

  if (url.pathname === "/api/paper-trades/export.json") {
    const trades = getPaperTradesForReport(10000);
    sendDownload(
      response,
      "paper-trades.json",
      "application/json; charset=utf-8",
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          storage: "data/market-predictor.sqlite",
          stats: getPaperTradeStats(),
          strategyReport: buildStrategyReport(10000),
          trades
        },
        null,
        2
      )
    );
    return;
  }

  if (url.pathname === "/api/paper-trades/export.csv") {
    const trades = getPaperTradesForReport(10000);
    sendDownload(response, "paper-trades.csv", "text/csv; charset=utf-8", paperTradeCsv(trades));
    return;
  }

  if (url.pathname === "/api/paper-controls") {
    if (request.method === "GET") {
      sendJson(response, getPaperControls());
      return;
    }

    if (request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          sendJson(response, savePaperControls(payload));
        } catch (error) {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    response.writeHead(405, { Allow: "GET, POST" });
    response.end("Method Not Allowed");
    return;
  }

  if (url.pathname === "/api/paper-loop-audit") {
    const trades = getRecentPaperTrades(50);
    const currentFormatTrades = trades.filter((trade) => trade.setup && trade.research && trade.dataQuality);
    const closest = latestSnapshot.paperReadiness?.closest ?? null;
    const controls = getPaperControls();
    sendJson(response, {
      generatedAt: new Date().toISOString(),
      provider: latestSnapshot.provider,
      scanStatus,
      controls,
      signalSummary: latestSnapshot.signalSummary,
      readiness: latestSnapshot.paperReadiness,
      paperStats: getPaperTradeStats(),
      currentFormatTradeCount: currentFormatTrades.length,
      legacyTradeCount: trades.length - currentFormatTrades.length,
      currentFormatTrades: currentFormatTrades.slice(0, 10),
      loopState:
        !controls.enabled
          ? "disabled"
          : latestSnapshot.paperReadiness?.ready
          ? "armed"
          : "blocked",
      primaryBlockers: closest?.blockers ?? ["Waiting for a research scan."],
      rules: [
        "Only paper trade when signal gate is Signal.",
        "Require trusted real-time market data.",
        "Require at least one real catalyst source.",
        "Require clean intraday setup quality.",
        "Require acceptable ML probability, risk score, and reward/risk."
      ]
    });
    return;
  }

  if (url.pathname === "/api/research-events") {
    sendJson(response, { events: getRecentResearchEvents(50) });
    return;
  }

  if (url.pathname === "/api/predictions") {
    sendJson(response, { predictions: getRecentPredictions(50) });
    return;
  }

  if (url.pathname === "/api/backtest") {
    sendJson(response, getBacktestSummary());
    return;
  }

  if (url.pathname === "/api/strategy-report") {
    sendJson(response, buildStrategyReport());
    return;
  }

  if (url.pathname.startsWith("/api/research/")) {
    const symbol = url.pathname.split("/").at(-1)?.toUpperCase();
    const opportunity = latestSnapshot.opportunities.find((item) => item.symbol === symbol);
    sendJson(response, opportunity ?? { error: "Symbol not found" });
    return;
  }

  await serveStatic(request, response);
});

function startMarketUpdate(reason = "manual") {
  if (scanProcess) return false;
  runMarketUpdate(reason);
  return true;
}

function runMarketUpdate(reason = "manual") {
  scanStatus = {
    ...scanStatus,
    state: "running",
    lastStartedAt: new Date().toISOString(),
    lastError: null,
    reason
  };
  scanProcess = fork(path.join(process.cwd(), "src/scanWorker.js"), [], {
    env: { ...process.env, ...paperControlsEnv() },
    silent: true
  });

  scanProcess.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  scanProcess.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  scanProcess.on("message", (message) => {
    if (message.type === "snapshot") {
      latestSnapshot = message.snapshot;
      scanStatus = {
        ...scanStatus,
        state: "idle",
        lastCompletedAt: new Date().toISOString(),
        lastError: null
      };
      broadcastSnapshot();
    }

    if (message.type === "error") {
      scanStatus = {
        ...scanStatus,
        state: "error",
        lastError: message.error,
        lastCompletedAt: new Date().toISOString()
      };
      console.error(`Market update skipped: ${message.error}`);
    }
  });

  scanProcess.on("exit", (code) => {
    if (scanStatus.state === "running") {
      scanStatus = {
        ...scanStatus,
        state: code === 0 ? "idle" : "error",
        lastError: code === 0 ? null : `Scan worker exited with code ${code}`,
        lastCompletedAt: new Date().toISOString()
      };
    }
    scanProcess = null;
    if (continuousResearch) {
      setTimeout(() => runMarketUpdate("scheduled"), updateIntervalMs);
    }
  });
  return true;
}

function checkMorningTest() {
  const { controls, intervalMs, nextMs, windowState } = refreshMorningTestStatus();
  if (!controls.morningTestEnabled || !windowState.active) return;
  if (scanProcess || ["queued", "running"].includes(scanStatus.state)) {
    refreshMorningTestStatus("Morning Test Mode is waiting for the current scan to finish.");
    return;
  }
  if (morningTestStatus.lastScanAt && Date.now() < nextMs) return;

  scanStatus = {
    ...scanStatus,
    state: "queued",
    lastError: null,
    reason: "morning-test"
  };
  morningTestStatus = {
    ...morningTestStatus,
    lastScanAt: formatLocalIso(new Date()),
    nextScanAt: formatLocalIso(Date.now() + intervalMs),
    message: "Morning Test Mode queued a scheduled scan."
  };
  setTimeout(() => startMarketUpdate("morning-test"), 0);
}

server.listen(port, () => {
  console.log(`Market Predictor running at http://localhost:${port}`);
  refreshMorningTestStatus();
  setInterval(checkMorningTest, 30000);
  if (scanOnStartup || continuousResearch) {
    setTimeout(() => startMarketUpdate("startup"), 1000);
  }
});
