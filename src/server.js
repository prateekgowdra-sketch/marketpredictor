import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "./config.js";
import { MarketEngine } from "./marketData.js";
import { getBacktestSummary } from "./backtest.js";
import {
  getPaperTradeStats,
  getRecentPaperTrades,
  getRecentPredictions,
  getRecentResearchEvents,
  getRecentSignals
} from "./database.js";

loadEnv();

const port = Number(process.env.PORT ?? 3001);
const publicDir = path.join(process.cwd(), "public");
const engine = await MarketEngine.create();
const clients = new Set();
let latestSnapshot = await engine.next();

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

  if (url.pathname.startsWith("/api/research/")) {
    const symbol = url.pathname.split("/").at(-1)?.toUpperCase();
    const opportunity = latestSnapshot.opportunities.find((item) => item.symbol === symbol);
    sendJson(response, opportunity ?? { error: "Symbol not found" });
    return;
  }

  await serveStatic(request, response);
});

setInterval(async () => {
  latestSnapshot = await engine.next();
  const payload = `data: ${JSON.stringify(latestSnapshot)}\n\n`;
  for (const client of clients) client.write(payload);
}, 1000);

server.listen(port, () => {
  console.log(`Market Predictor running at http://localhost:${port}`);
});
