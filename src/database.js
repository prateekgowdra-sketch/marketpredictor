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

  CREATE INDEX IF NOT EXISTS idx_candles_symbol_ts ON candles(symbol, ts);
  CREATE INDEX IF NOT EXISTS idx_signals_symbol_ts ON signals(symbol, ts);
  CREATE INDEX IF NOT EXISTS idx_outcomes_signal ON outcomes(signal_id);
`);

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
    INSERT INTO research_events (symbol, ts, provider, event_type, title, strength, url, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertSignal: db.prepare(`
    INSERT INTO signals (
      symbol, ts, action, priority, score, confidence, price,
      entry_low, entry_high, stop, target, reasons_json, technical_json, provider
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertOutcome: db.prepare(`
    INSERT INTO outcomes (signal_id, horizon, checked_at, price, return_pct, hit_target, hit_stop)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(signal_id, horizon) DO UPDATE SET
      checked_at = excluded.checked_at,
      price = excluded.price,
      return_pct = excluded.return_pct,
      hit_target = excluded.hit_target,
      hit_stop = excluded.hit_stop
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
      AVG(hit_stop) AS stop_rate
    FROM outcomes
    GROUP BY horizon
    ORDER BY horizon
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
        JSON.stringify(event.raw ?? {})
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
    provider
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
    outcome.hitStop ? 1 : 0
  );
}

export function getRecentSignals(limit = 50) {
  return statements.recentSignals.all(limit).map((row) => {
    const { reasons_json, technical_json, ...signal } = row;
    return {
      ...signal,
      reasons: JSON.parse(reasons_json),
      technical: JSON.parse(technical_json)
    };
  });
}

export function getSignalById(id) {
  const row = statements.signalById.get(id);
  if (!row) return null;
  const { reasons_json, technical_json, ...signal } = row;
  return {
    ...signal,
    reasons: JSON.parse(reasons_json),
    technical: JSON.parse(technical_json)
  };
}

export function getOutcomeStats() {
  return statements.outcomeStats.all().map((row) => ({
    horizon: row.horizon,
    count: row.count,
    averageReturn: row.average_return ?? 0,
    winRate: row.win_rate ?? 0,
    targetRate: row.target_rate ?? 0,
    stopRate: row.stop_rate ?? 0
  }));
}
