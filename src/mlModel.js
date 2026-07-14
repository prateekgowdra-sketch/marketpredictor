import { featureNames, vectorize } from "./features.js";
import { getLatestModelRun, getTrainingRows, saveModelRun } from "./database.js";

function sigmoid(value) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
}

function dot(weights, values) {
  return weights.reduce((sum, weight, index) => sum + weight * values[index], 0);
}

function baselineProbability(features) {
  let score = 0.45;
  score += features.score * 0.18;
  score += features.relativeVolume * 0.08;
  score += features.breakoutPressure * 0.07;
  score += features.aboveVwap * 0.05;
  score += features.trendUp * 0.04;
  score += features.eventStrength * 0.05;
  score -= features.volatilityPct * 0.7;
  return Math.max(0.05, Math.min(0.95, score));
}

export class PredictionEngine {
  constructor() {
    this.modelName = "heuristic-v1";
    this.weights = null;
    this.bias = 0;
    this.metrics = { mode: "heuristic", accuracy: null, rows: 0 };
    this.lastTrainingAt = 0;
  }

  maybeTrain(force = false) {
    const now = Date.now();
    if (!force && now - this.lastTrainingAt < 60_000) return this.metrics;
    this.lastTrainingAt = now;

    const rows = getTrainingRows("15m", 2500);
    if (rows.length < 40) {
      this.metrics = { mode: "heuristic", accuracy: null, rows: rows.length };
      return this.metrics;
    }

    const examples = rows.map((row) => {
      const features = Object.keys(row.features).length ? row.features : {
        score: row.score / 100,
        confidence: row.confidence / 100,
        rsi: (row.technical.rsi ?? 50) / 100,
        macd: (row.technical.macd ?? 0) / Math.max(row.price, 1),
        relativeVolume: Math.min((row.technical.relativeVolume ?? 1) / 4, 2),
        breakoutPressure: Math.max(0, ((row.technical.breakoutPressure ?? 1) - 0.98) / 0.04),
        aboveVwap: row.technical.aboveVwap ? 1 : 0,
        trendUp: row.technical.trendUp ? 1 : 0,
        volatilityPct: row.technical.volatilityPct ?? 0,
        priceChange: row.technical.priceChange ?? 0,
        eventStrength: 0,
        eventCount: 0,
        hasSecEvent: 0,
        hasNewsEvent: 0,
        hasSectorEvent: 0
      };
      return {
        x: vectorize(features),
        y: row.hit_target || row.return_pct > 0.004 ? 1 : 0
      };
    });

    const weights = Array(featureNames.length).fill(0);
    let bias = 0;
    const learningRate = 0.08;
    const lambda = 0.002;

    for (let epoch = 0; epoch < 120; epoch += 1) {
      for (const example of examples) {
        const prediction = sigmoid(dot(weights, example.x) + bias);
        const error = prediction - example.y;
        for (let index = 0; index < weights.length; index += 1) {
          weights[index] -= learningRate * (error * example.x[index] + lambda * weights[index]);
        }
        bias -= learningRate * error;
      }
    }

    const correct = examples.filter((example) => {
      const prediction = sigmoid(dot(weights, example.x) + bias);
      return (prediction >= 0.5 ? 1 : 0) === example.y;
    }).length;

    this.modelName = "logistic-15m-v1";
    this.weights = weights;
    this.bias = bias;
    this.metrics = {
      mode: "trained",
      rows: rows.length,
      accuracy: correct / examples.length,
      horizon: "15m"
    };

    saveModelRun({
      ts: new Date().toISOString(),
      modelName: this.modelName,
      trainingRows: rows.length,
      metrics: this.metrics,
      notes: "Lightweight logistic model trained on local signal outcomes."
    });

    return this.metrics;
  }

  predict(features) {
    this.maybeTrain(false);
    const probabilityUp = this.weights
      ? sigmoid(dot(this.weights, vectorize(features)) + this.bias)
      : baselineProbability(features);
    const expectedReturn =
      (probabilityUp - 0.5) * 0.025 +
      features.eventStrength * 0.004 +
      features.breakoutPressure * 0.003 -
      features.volatilityPct * 0.25;
    const riskScore = Math.max(
      0,
      Math.min(100, features.volatilityPct * 650 + (1 - probabilityUp) * 45)
    );

    return {
      modelName: this.modelName,
      probabilityUp,
      expectedReturn,
      riskScore,
      metrics: this.metrics,
      latestPersistedModel: getLatestModelRun()
    };
  }
}
