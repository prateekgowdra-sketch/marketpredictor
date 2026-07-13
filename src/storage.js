import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");

export async function recordSignals(snapshot) {
  await mkdir(dataDir, { recursive: true });
  const rows = snapshot.opportunities
    .filter((item) => item.score >= 70)
    .map((item) =>
      JSON.stringify({
        ts: snapshot.generatedAt,
        symbol: item.symbol,
        score: Number(item.score.toFixed(2)),
        action: item.action,
        price: Number(item.price.toFixed(2)),
        reasons: item.reasons
      })
    );

  if (rows.length) {
    await appendFile(path.join(dataDir, "signals.jsonl"), `${rows.join("\n")}\n`);
  }
}
