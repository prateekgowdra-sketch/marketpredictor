import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "market-predictor.sqlite"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS tickers (
    symbol TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    sector TEXT NOT NULL,
    market_cap TEXT,
    beta REAL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    ts INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL,
    provider TEXT NOT NULL,
    UNIQUE(symbol, ts, provider)
  );

  CREATE TABLE IF NOT EXISTS research_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    ts TEXT NOT NULL,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    strength REAL NOT NULL,
    url TEXT,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    ts TEXT NOT NULL,
    action TEXT NOT NULL,
    priority TEXT NOT NULL,
    score REAL NOT NULL,
    confidence REAL NOT NULL,
    price REAL NOT NULL,
    entry_low REAL NOT NULL,
    entry_high REAL NOT NULL,
    stop REAL NOT NULL,
    target REAL NOT NULL,
    reasons_json TEXT NOT NULL,
    technical_json TEXT NOT NULL,
    provider TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER NOT NULL,
    horizon TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    price REAL NOT NULL,
    return_pct REAL NOT NULL,
    hit_target INTEGER NOT NULL,
    hit_stop INTEGER NOT NULL,
    FOREIGN KEY(signal_id) REFERENCES signals(id) ON DELETE CASCADE,
    UNIQUE(signal_id, horizon)
  );

  CREATE TABLE IF NOT EXISTS model_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    model_name TEXT NOT NULL,
    training_rows INTEGER NOT NULL,
    metrics_json TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    ts TEXT NOT NULL,
    model_name TEXT NOT NULL,
    probability_up REAL NOT NULL,
    expected_return REAL NOT NULL,
    risk_score REAL NOT NULL,
    feature_json TEXT NOT NULL,
    explanation_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS paper_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    signal_id INTEGER,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    status TEXT NOT NULL,
    entry_price REAL NOT NULL,
    quantity REAL NOT NULL,
    notional REAL NOT NULL,
    stop REAL NOT NULL,
    target REAL NOT NULL,
    exit_price REAL,
    exit_reason TEXT,
    pnl_pct REAL DEFAULT 0,
    pnl_dollars REAL DEFAULT 0,
    max_gain_pct REAL DEFAULT 0,
    max_drawdown_pct REAL DEFAULT 0,
    ticks_held INTEGER DEFAULT 0,
    decision_json TEXT NOT NULL,
    prediction_json TEXT NOT NULL,
    FOREIGN KEY(signal_id) REFERENCES signals(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_candles_symbol_ts ON candles(symbol, ts);
  CREATE INDEX IF NOT EXISTS idx_signals_symbol_ts ON signals(symbol, ts);
  CREATE INDEX IF NOT EXISTS idx_outcomes_signal ON outcomes(signal_id);
  CREATE INDEX IF NOT EXISTS idx_predictions_symbol_ts ON predictions(symbol, ts);
  CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(status, opened_at);
`);

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

function addColumnIfMissing(table, column, definition) {
  if (!tableColumns(table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("outcomes", "max_price", "REAL");
addColumnIfMissing("outcomes", "min_price", "REAL");
addColumnIfMissing("outcomes", "max_gain_pct", "REAL");
addColumnIfMissing("outcomes", "max_drawdown_pct", "REAL");
addColumnIfMissing("outcomes", "label_json", "TEXT");
addColumnIfMissing("research_events", "sentiment", "REAL DEFAULT 0");
addColumnIfMissing("signals", "feature_json", "TEXT");
addColumnIfMissing("signals", "prediction_json", "TEXT");

const statements = {
  upsertTicker: db.prepare(`
    INSERT INTO tickers (symbol, company, sector, market_cap, beta, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      company = excluded.company,
      sector = excluded.sector,
      market_cap = excluded.market_cap,
      beta = excluded.beta,
      updated_at = excluded.updated_at
  `),
  insertCandle: db.prepare(`
    INSERT OR IGNORE INTO candles (symbol, ts, open, high, low, close, volume, provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertResearchEvent: db.prepare(`
    INSERT INTO research_events (symbol, ts, provider, event_type, title, strength, url, raw_json, sentiment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertSignal: db.prepare(`
    INSERT INTO signals (
      symbol, ts, action, priority, score, confidence, price,
      entry_low, entry_high, stop, target, reasons_json, technical_json, provider,
      feature_json, prediction_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertOutcome: db.prepare(`
    INSERT INTO outcomes (
      signal_id, horizon, checked_at, price, return_pct, hit_target, hit_stop,
      max_price, min_price, max_gain_pct, max_drawdown_pct, label_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(signal_id, horizon) DO UPDATE SET
      checked_at = excluded.checked_at,
      price = excluded.price,
      return_pct = excluded.return_pct,
      hit_target = excluded.hit_target,
      hit_stop = excluded.hit_stop,
      max_price = excluded.max_price,
      min_price = excluded.min_price,
      max_gain_pct = excluded.max_gain_pct,
      max_drawdown_pct = excluded.max_drawdown_pct,
      label_json = excluded.label_json
  `),
  insertPrediction: db.prepare(`
    INSERT INTO predictions (
      symbol, ts, model_name, probability_up, expected_return, risk_score, feature_json, explanation_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertModelRun: db.prepare(`
    INSERT INTO model_runs (ts, model_name, training_rows, metrics_json, notes)
    VALUES (?, ?, ?, ?, ?)
  `),
  insertPaperTrade: db.prepare(`
    INSERT INTO paper_trades (
      symbol, signal_id, opened_at, status, entry_price, quantity, notional,
      stop, target, decision_json, prediction_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updatePaperTrade: db.prepare(`
    UPDATE paper_trades SET
      closed_at = ?,
      status = ?,
      exit_price = ?,
      exit_reason = ?,
      pnl_pct = ?,
      pnl_dollars = ?,
      max_gain_pct = ?,
      max_drawdown_pct = ?,
      ticks_held = ?
    WHERE id = ?
  `),
  recentPaperTrades: db.prepare(`
    SELECT * FROM paper_trades
    ORDER BY opened_at DESC, id DESC
    LIMIT ?
  `),
  paperTradeStats: db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
      AVG(CASE WHEN status = 'closed' AND pnl_pct > 0 THEN 1.0 WHEN status = 'closed' THEN 0.0 ELSE NULL END) AS win_rate,
      AVG(CASE WHEN status = 'closed' THEN pnl_pct ELSE NULL END) AS average_pnl_pct,
      SUM(CASE WHEN status = 'closed' THEN pnl_dollars ELSE 0 END) AS realized_pnl
    FROM paper_trades
  `),
  recentSignals: db.prepare(`
    SELECT * FROM signals
    ORDER BY ts DESC, id DESC
    LIMIT ?
  `),
  signalById: db.prepare("SELECT * FROM signals WHERE id = ?"),
  outcomeStats: db.prepare(`
    SELECT
      horizon,
      COUNT(*) AS count,
      AVG(return_pct) AS average_return,
      AVG(CASE WHEN return_pct > 0 THEN 1.0 ELSE 0.0 END) AS win_rate,
      AVG(hit_target) AS target_rate,
      AVG(hit_stop) AS stop_rate,
      AVG(max_gain_pct) AS average_max_gain,
      AVG(max_drawdown_pct) AS average_max_drawdown
    FROM outcomes
    GROUP BY horizon
    ORDER BY horizon
  `),
  recentResearchEvents: db.prepare(`
    SELECT * FROM research_events
    ORDER BY ts DESC, id DESC
    LIMIT ?
  `),
  trainingRows: db.prepare(`
    SELECT
      s.id,
      s.symbol,
      s.ts,
      s.score,
      s.confidence,
      s.price,
      s.technical_json,
      s.feature_json,
      o.horizon,
      o.return_pct,
      o.hit_target,
      o.hit_stop,
      o.max_gain_pct,
      o.max_drawdown_pct
    FROM signals s
    JOIN outcomes o ON o.signal_id = s.id
    WHERE o.horizon = ?
    ORDER BY s.id DESC
    LIMIT ?
  `),
  recentPredictions: db.prepare(`
    SELECT * FROM predictions
    ORDER BY ts DESC, id DESC
    LIMIT ?
  `),
  latestModelRun: db.prepare(`
    SELECT * FROM model_runs
    ORDER BY ts DESC, id DESC
    LIMIT 1
  `)
};

export function saveTicker(profile) {
  statements.upsertTicker.run(
    profile.symbol,
    profile.company,
    profile.sector,
    profile.marketCap ?? null,
    profile.beta ?? null,
    new Date().toISOString()
  );
}

export function saveCandle(symbol, candle, provider) {
  statements.insertCandle.run(
    symbol,
    candle.time,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
    provider
  );
}

export function saveResearchEvents(events) {
  db.exec("BEGIN");
  try {
    for (const event of events) {
      statements.insertResearchEvent.run(
        event.symbol,
        event.ts,
        event.provider,
      event.type,
      event.title,
        event.strength,
        event.url ?? null,
        JSON.stringify(event.raw ?? {}),
        event.sentiment ?? event.raw?.sentimentScore ?? 0
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function saveSignal(signal, provider) {
  const result = statements.insertSignal.run(
    signal.symbol,
    signal.updatedAt,
    signal.action,
    signal.priority,
    signal.score,
    signal.confidence,
    signal.price,
    signal.entryZone[0],
    signal.entryZone[1],
    signal.stop,
    signal.target,
    JSON.stringify(signal.reasons),
    JSON.stringify(signal.technical),
    provider,
    JSON.stringify(signal.features ?? {}),
    JSON.stringify(signal.prediction ?? null)
  );
  return result.lastInsertRowid;
}

export function saveOutcome(outcome) {
  statements.insertOutcome.run(
    outcome.signalId,
    outcome.horizon,
    outcome.checkedAt,
    outcome.price,
    outcome.returnPct,
    outcome.hitTarget ? 1 : 0,
    outcome.hitStop ? 1 : 0,
    outcome.maxPrice ?? outcome.price,
    outcome.minPrice ?? outcome.price,
    outcome.maxGainPct ?? outcome.returnPct,
    outcome.maxDrawdownPct ?? outcome.returnPct,
    JSON.stringify(outcome.labels ?? {})
  );
}

export function savePrediction(prediction) {
  statements.insertPrediction.run(
    prediction.symbol,
    prediction.ts,
    prediction.modelName,
    prediction.probabilityUp,
    prediction.expectedReturn,
    prediction.riskScore,
    JSON.stringify(prediction.features),
    JSON.stringify(prediction.explanation)
  );
}

export function saveModelRun(run) {
  statements.insertModelRun.run(
    run.ts,
    run.modelName,
    run.trainingRows,
    JSON.stringify(run.metrics),
    run.notes ?? null
  );
}

function parsePaperTrade(row) {
  const { decision_json, prediction_json, ...trade } = row;
  return {
    id: trade.id,
    symbol: trade.symbol,
    signalId: trade.signal_id,
    openedAt: trade.opened_at,
    closedAt: trade.closed_at,
    status: trade.status,
    entryPrice: trade.entry_price,
    quantity: trade.quantity,
    notional: trade.notional,
    stop: trade.stop,
    target: trade.target,
    exitPrice: trade.exit_price,
    exitReason: trade.exit_reason,
    pnlPct: trade.pnl_pct,
    pnlDollars: trade.pnl_dollars,
    maxGainPct: trade.max_gain_pct,
    maxDrawdownPct: trade.max_drawdown_pct,
    ticksHeld: trade.ticks_held,
    decision: JSON.parse(decision_json),
    prediction: JSON.parse(prediction_json)
  };
}

export function savePaperTrade(trade) {
  const result = statements.insertPaperTrade.run(
    trade.symbol,
    trade.signalId ?? null,
    trade.openedAt,
    trade.status,
    trade.entryPrice,
    trade.quantity,
    trade.notional,
    trade.stop,
    trade.target,
    JSON.stringify(trade.decision),
    JSON.stringify(trade.prediction ?? null)
  );
  return Number(result.lastInsertRowid);
}

export function updatePaperTrade(trade) {
  statements.updatePaperTrade.run(
    trade.closedAt ?? null,
    trade.status,
    trade.exitPrice ?? null,
    trade.exitReason ?? null,
    trade.pnlPct ?? 0,
    trade.pnlDollars ?? 0,
    trade.maxGainPct ?? 0,
    trade.maxDrawdownPct ?? 0,
    trade.ticksHeld ?? 0,
    trade.id
  );
}

export function getRecentPaperTrades(limit = 30) {
  return statements.recentPaperTrades.all(limit).map(parsePaperTrade);
}

export function getPaperTradeStats() {
  const row = statements.paperTradeStats.get();
  return {
    total: row.total ?? 0,
    openCount: row.open_count ?? 0,
    closedCount: row.closed_count ?? 0,
    winRate: row.win_rate ?? 0,
    averagePnlPct: row.average_pnl_pct ?? 0,
    realizedPnl: row.realized_pnl ?? 0
  };
}

export function getRecentSignals(limit = 50) {
  return statements.recentSignals.all(limit).map((row) => {
    const { reasons_json, technical_json, feature_json, prediction_json, ...signal } = row;
    return {
      ...signal,
      reasons: JSON.parse(reasons_json),
      technical: JSON.parse(technical_json),
      features: feature_json ? JSON.parse(feature_json) : {},
      prediction: prediction_json ? JSON.parse(prediction_json) : null
    };
  });
}

export function getSignalById(id) {
  const row = statements.signalById.get(id);
  if (!row) return null;
  const { reasons_json, technical_json, feature_json, prediction_json, ...signal } = row;
  return {
    ...signal,
    reasons: JSON.parse(reasons_json),
    technical: JSON.parse(technical_json),
    features: feature_json ? JSON.parse(feature_json) : {},
    prediction: prediction_json ? JSON.parse(prediction_json) : null
  };
}

export function getOutcomeStats() {
  return statements.outcomeStats.all().map((row) => ({
    horizon: row.horizon,
    count: row.count,
    averageReturn: row.average_return ?? 0,
    winRate: row.win_rate ?? 0,
    targetRate: row.target_rate ?? 0,
    stopRate: row.stop_rate ?? 0,
    averageMaxGain: row.average_max_gain ?? 0,
    averageMaxDrawdown: row.average_max_drawdown ?? 0
  }));
}

export function getRecentResearchEvents(limit = 30) {
  return statements.recentResearchEvents.all(limit).map((row) => ({
    id: row.id,
    symbol: row.symbol,
    ts: row.ts,
    provider: row.provider,
    type: row.event_type,
    title: row.title,
    strength: row.strength,
    sentiment: row.sentiment ?? 0,
    url: row.url,
    raw: row.raw_json ? JSON.parse(row.raw_json) : {}
  }));
}

export function getTrainingRows(horizon = "15m", limit = 2000) {
  return statements.trainingRows.all(horizon, limit).map((row) => ({
    ...row,
    technical: JSON.parse(row.technical_json),
    features: row.feature_json ? JSON.parse(row.feature_json) : {}
  }));
}

export function getRecentPredictions(limit = 30) {
  return statements.recentPredictions.all(limit).map((row) => {
    const { feature_json, explanation_json, ...prediction } = row;
    return {
      ...prediction,
      features: JSON.parse(feature_json),
      explanation: JSON.parse(explanation_json)
    };
  });
}

export function getLatestModelRun() {
  const row = statements.latestModelRun.get();
  if (!row) return null;
  const { metrics_json, ...run } = row;
  return {
    ...run,
    metrics: JSON.parse(metrics_json)
  };
}
