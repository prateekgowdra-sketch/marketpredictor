export function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function ema(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let result = sma(values.slice(0, period), period);
  for (let index = period; index < values.length; index += 1) {
    result = values[index] * multiplier + result * (1 - multiplier);
  }
  return result;
}

export function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  const slice = values.slice(-period - 1);

  for (let index = 1; index < slice.length; index += 1) {
    const change = slice[index] - slice[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  const averageGain = gains / period;
  const averageLoss = losses / period;
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

export function macd(values) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  if (fast === null || slow === null) return null;
  return fast - slow;
}

export function atr(candles, period = 14) {
  if (candles.length <= period) return null;
  const recent = candles.slice(-period);
  const ranges = recent.map((candle, index) => {
    const previousClose = index === 0 ? candle.open : recent[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  return ranges.reduce((sum, value) => sum + value, 0) / period;
}

export function vwap(candles, period = 30) {
  const recent = candles.slice(-period);
  const volume = recent.reduce((sum, candle) => sum + candle.volume, 0);
  if (!volume) return null;
  const weighted = recent.reduce((sum, candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    return sum + typical * candle.volume;
  }, 0);
  return weighted / volume;
}

export function buildTechnicalSnapshot(candles) {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const last = candles.at(-1);
  const previous = candles.at(-2);
  const avgVolume = sma(volumes, Math.min(20, volumes.length));
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const currentRsi = rsi(closes);
  const currentMacd = macd(closes);
  const currentAtr = atr(candles);
  const currentVwap = vwap(candles);
  const recentHigh = Math.max(...candles.slice(-30).map((candle) => candle.high));
  const recentLow = Math.min(...candles.slice(-30).map((candle) => candle.low));
  const openingRange = candles.slice(0, Math.min(15, candles.length));
  const openingRangeHigh = Math.max(...openingRange.map((candle) => candle.high));
  const openingRangeLow = Math.min(...openingRange.map((candle) => candle.low));
  const sessionOpen = candles[0]?.open ?? last.open;
  const relativeVolume = avgVolume ? last.volume / avgVolume : 1;
  const priceChange = previous ? (last.close - previous.close) / previous.close : 0;
  const breakoutPressure = recentHigh ? last.close / recentHigh : 1;

  return {
    price: last.close,
    priceChange,
    rsi: currentRsi,
    macd: currentMacd,
    atr: currentAtr,
    vwap: currentVwap,
    ma20,
    ma50,
    relativeVolume,
    breakoutPressure,
    recentHigh,
    recentLow,
    openingRangeHigh,
    openingRangeLow,
    sessionOpen,
    sessionGapPct: sessionOpen ? (last.close - sessionOpen) / sessionOpen : 0,
    aboveVwap: currentVwap ? last.close > currentVwap : false,
    trendUp: ma20 !== null && ma50 !== null ? ma20 > ma50 : false,
    volatilityPct: currentAtr ? currentAtr / last.close : 0
  };
}
