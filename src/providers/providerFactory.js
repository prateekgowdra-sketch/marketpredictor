import { MockMarketProvider } from "./mockProvider.js";
import { AlpacaMarketProvider } from "./alpacaProvider.js";

export async function createMarketProvider() {
  const provider = process.env.MARKET_DATA_PROVIDER ?? "mock";

  if (provider === "mock") {
    return new MockMarketProvider();
  }

  if (provider === "polygon") {
    throw new Error("Polygon provider is not configured yet. Set MARKET_DATA_PROVIDER=mock or add POLYGON_API_KEY and implement src/providers/polygonProvider.js.");
  }

  if (provider === "alpaca") {
    try {
      const alpaca = new AlpacaMarketProvider();
      await alpaca.init();
      return alpaca;
    } catch (error) {
      if (process.env.ALPACA_FALLBACK_TO_MOCK === "false") {
        throw error;
      }

      console.warn(`Alpaca provider unavailable: ${error.message}`);
      console.warn("Falling back to mock data so the dashboard can still run.");
      return new MockMarketProvider();
    }
  }

  throw new Error(`Unknown MARKET_DATA_PROVIDER: ${provider}`);
}
