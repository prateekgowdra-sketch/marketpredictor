import { loadEnv } from "./config.js";
import { MarketEngine } from "./marketData.js";

loadEnv();

try {
  const engine = await MarketEngine.create();
  const snapshot = await engine.next();
  if (process.send) {
    process.send({ type: "snapshot", snapshot });
  }
} catch (error) {
  if (process.send) {
    process.send({ type: "error", error: error.message });
  }
  process.exitCode = 1;
}
