const horizons = [
  { label: "5m", ticks: 5 },
  { label: "15m", ticks: 15 },
  { label: "1h", ticks: 60 }
];

export class OutcomeTracker {
  constructor() {
    this.pending = [];
  }

  track(signalId, signal, tick) {
    for (const horizon of horizons) {
      this.pending.push({
        signalId,
        symbol: signal.symbol,
        entryPrice: signal.price,
        target: signal.target,
        stop: signal.stop,
        horizon: horizon.label,
        dueTick: tick + horizon.ticks,
        maxPrice: signal.price,
        minPrice: signal.price,
        firstTargetTick: null,
        firstStopTick: null
      });
    }
  }

  collectDue(currentTick, opportunities) {
    const priceBySymbol = new Map(opportunities.map((item) => [item.symbol, item.price]));
    const due = [];
    const stillPending = [];

    for (const item of this.pending) {
      const price = priceBySymbol.get(item.symbol);
      if (price) {
        item.maxPrice = Math.max(item.maxPrice, price);
        item.minPrice = Math.min(item.minPrice, price);
        if (item.firstTargetTick === null && price >= item.target) item.firstTargetTick = currentTick;
        if (item.firstStopTick === null && price <= item.stop) item.firstStopTick = currentTick;
      }

      if (item.dueTick > currentTick) {
        stillPending.push(item);
        continue;
      }

      if (!price) continue;
      const returnPct = (price - item.entryPrice) / item.entryPrice;
      const maxGainPct = (item.maxPrice - item.entryPrice) / item.entryPrice;
      const maxDrawdownPct = (item.minPrice - item.entryPrice) / item.entryPrice;
      const hitTarget = item.firstTargetTick !== null;
      const hitStop = item.firstStopTick !== null;
      const targetBeforeStop =
        hitTarget && (!hitStop || item.firstTargetTick <= item.firstStopTick);

      due.push({
        signalId: item.signalId,
        horizon: item.horizon,
        checkedAt: new Date().toISOString(),
        price,
        returnPct,
        hitTarget,
        hitStop,
        maxPrice: item.maxPrice,
        minPrice: item.minPrice,
        maxGainPct,
        maxDrawdownPct,
        labels: {
          profitable: returnPct > 0,
          moveUp1Pct: maxGainPct >= 0.01,
          moveUp2Pct: maxGainPct >= 0.02,
          avoid: maxDrawdownPct <= -0.01 && maxGainPct < 0.005,
          targetBeforeStop
        }
      });
    }

    this.pending = stillPending;
    return due;
  }
}
