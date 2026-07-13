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
        dueTick: tick + horizon.ticks
      });
    }
  }

  collectDue(currentTick, opportunities) {
    const priceBySymbol = new Map(opportunities.map((item) => [item.symbol, item.price]));
    const due = [];
    const stillPending = [];

    for (const item of this.pending) {
      if (item.dueTick > currentTick) {
        stillPending.push(item);
        continue;
      }

      const price = priceBySymbol.get(item.symbol);
      if (!price) continue;

      due.push({
        signalId: item.signalId,
        horizon: item.horizon,
        checkedAt: new Date().toISOString(),
        price,
        returnPct: (price - item.entryPrice) / item.entryPrice,
        hitTarget: price >= item.target,
        hitStop: price <= item.stop
      });
    }

    this.pending = stillPending;
    return due;
  }
}
