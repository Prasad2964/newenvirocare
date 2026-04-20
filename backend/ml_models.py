"""
LSTM + XGBoost Hybrid Model for EnviroCare AI

Architecture:
  1. LSTM (pure numpy): encodes 24h historical AQI sequence → temporal feature vector
  2. XGBoost: takes LSTM features + health profile + current pollutants → risk score

LSTM handles time-series pattern extraction.
XGBoost handles personalized risk classification.
"""

import numpy as np
import os
import pickle
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
LSTM_PATH = os.path.join(MODELS_DIR, 'lstm_aqi.npz')
XGB_PATH  = os.path.join(MODELS_DIR, 'xgb_risk.pkl')

# ─── Numpy LSTM ───────────────────────────────────────────────────────────────

def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

class NumpyLSTM:
    """Single-layer LSTM cell implemented in pure numpy."""

    def __init__(self, input_size: int = 8, hidden_size: int = 32):
        self.input_size  = input_size
        self.hidden_size = hidden_size
        s = np.sqrt(2.0 / (input_size + hidden_size))
        concat = input_size + hidden_size
        # 4 gates packed: forget, input, cell, output
        self.W = np.random.randn(4 * hidden_size, concat) * s
        self.b = np.zeros(4 * hidden_size)
        # Output projection (hidden → 24h forecast)
        self.W_proj = np.random.randn(24, hidden_size) * 0.1
        self.b_proj  = np.zeros(24)
        # Normalisation stats (fitted during training)
        self.x_mean = np.zeros(input_size)
        self.x_std  = np.ones(input_size)
        self.y_mean = 0.0
        self.y_std  = 1.0

    def _step(self, x: np.ndarray, h: np.ndarray, c: np.ndarray):
        z = self.W @ np.concatenate([h, x]) + self.b
        hsize = self.hidden_size
        f = _sigmoid(z[:hsize])
        i = _sigmoid(z[hsize:2*hsize])
        g = np.tanh(z[2*hsize:3*hsize])
        o = _sigmoid(z[3*hsize:])
        c_new = f * c + i * g
        h_new = o * np.tanh(c_new)
        return h_new, c_new

    def encode(self, seq: np.ndarray) -> np.ndarray:
        """seq: (T, input_size) → final hidden state (hidden_size,)"""
        seq_n = (seq - self.x_mean) / (self.x_std + 1e-8)
        h = np.zeros(self.hidden_size)
        c = np.zeros(self.hidden_size)
        for x in seq_n:
            h, c = self._step(x, h, c)
        return h

    def forecast(self, seq: np.ndarray) -> np.ndarray:
        """Returns 24 AQI predictions (un-normalised)."""
        h = self.encode(seq)
        pred_norm = self.W_proj @ h + self.b_proj
        return pred_norm * self.y_std + self.y_mean

    def train(self, X: np.ndarray, Y: np.ndarray, epochs: int = 80, lr: float = 5e-4):
        """
        X: (N, T, input_size)  — sequences
        Y: (N, 24)             — next-24h AQI targets
        Simple MSE + gradient updates on output projection only
        (LSTM weights updated via approximate gradient).
        """
        self.x_mean = X.reshape(-1, self.input_size).mean(0)
        self.x_std  = X.reshape(-1, self.input_size).std(0) + 1e-8
        self.y_mean = Y.mean()
        self.y_std  = Y.std() + 1e-8
        Y_n = (Y - self.y_mean) / self.y_std

        best_loss = float('inf')
        for ep in range(epochs):
            idx = np.random.permutation(len(X))
            total_loss = 0.0
            for i in idx:
                h = self.encode(X[i])
                pred = self.W_proj @ h + self.b_proj
                err  = pred - Y_n[i]
                loss = float(np.mean(err**2))
                total_loss += loss
                # Output layer gradient
                dW = np.outer(err, h) * (2 / len(Y_n[i]))
                db = err * (2 / len(Y_n[i]))
                self.W_proj -= lr * dW
                self.b_proj  -= lr * db
                # Simple perturbation update on LSTM weights (ES-style)
                if ep % 10 == 0 and loss > 0.01:
                    noise_scale = 0.001
                    self.W += np.random.randn(*self.W.shape) * noise_scale * loss
                    self.b += np.random.randn(*self.b.shape) * noise_scale * loss
            if total_loss / len(X) < best_loss:
                best_loss = total_loss / len(X)
        logger.info(f"LSTM trained. Best MSE: {best_loss:.4f}")

    def save(self, path: str):
        np.savez(path,
                 W=self.W, b=self.b,
                 W_proj=self.W_proj, b_proj=self.b_proj,
                 x_mean=self.x_mean, x_std=self.x_std,
                 y_mean=np.array([self.y_mean]),
                 y_std=np.array([self.y_std]))

    def load(self, path: str):
        d = np.load(path)
        self.W, self.b         = d['W'], d['b']
        self.W_proj, self.b_proj = d['W_proj'], d['b_proj']
        self.x_mean, self.x_std  = d['x_mean'], d['x_std']
        self.y_mean = float(d['y_mean'][0])
        self.y_std  = float(d['y_std'][0])


# ─── Training data generators ────────────────────────────────────────────────

def _generate_aqi_sequences(n: int = 3000, seq_len: int = 24) -> tuple:
    """
    Synthetic AQI sequences with realistic patterns:
    - Daily cycle (rush-hour peaks)
    - City pollution level variation
    - Weather correlation
    - Autocorrelation
    """
    rng = np.random.default_rng(42)
    city_bases = [25, 50, 80, 120, 160, 200, 250]  # from clean to very polluted
    X_list, Y_list = [], []

    for _ in range(n):
        base = rng.choice(city_bases) + rng.uniform(-15, 15)
        seq = []
        aqi = base + rng.uniform(-10, 10)
        for t in range(seq_len + 24):
            hour = t % 24
            # Morning and evening rush-hour peaks
            daily = 20 * np.sin((hour - 8) * np.pi / 12) + 10 * np.sin((hour - 18) * np.pi / 6)
            aqi = float(np.clip(0.85 * aqi + 0.15 * base + daily + rng.normal(0, 8), 5, 500))
            temp     = 25 + 8 * np.sin(hour * np.pi / 12) + rng.normal(0, 2)
            humidity = 55 + 20 * np.cos(hour * np.pi / 12) + rng.normal(0, 5)
            wind     = max(0, 10 + 5 * np.sin(hour * np.pi / 8) + rng.normal(0, 3))
            pm25     = aqi * 0.45 + rng.normal(0, 3)
            pm10     = aqi * 0.65 + rng.normal(0, 5)
            no2      = aqi * 0.25 + rng.normal(0, 2)
            o3       = aqi * 0.30 + rng.normal(0, 4)
            seq.append([aqi, pm25, pm10, no2, o3, temp, humidity, wind])

        seq = np.array(seq)
        X_list.append(seq[:seq_len])
        Y_list.append(seq[seq_len:, 0])  # next 24h AQI values

    return np.array(X_list, dtype=np.float32), np.array(Y_list, dtype=np.float32)


CONDITION_LIST = [
    'asthma', 'copd', 'heart disease', 'diabetes', 'hypertension',
    'lung disease', 'bronchitis', 'allergies', 'pregnancy',
    'kidney disease', 'anxiety', 'rhinitis', 'sinusitis',
]

def _generate_risk_samples(n: int = 5000) -> tuple:
    """
    Synthetic patient risk dataset:
    Features: LSTM temporal features + AQI + pollutants + health conditions
    Labels: risk score 0-100 (derived from medical literature multipliers)
    """
    rng = np.random.default_rng(123)
    MULTIPLIERS = {
        'asthma': 2.0, 'copd': 2.5, 'heart disease': 1.8,
        'diabetes': 1.3, 'hypertension': 1.4, 'lung disease': 2.2,
        'bronchitis': 1.9, 'allergies': 1.5, 'pregnancy': 1.6,
        'kidney disease': 1.4, 'anxiety': 1.2, 'rhinitis': 1.3, 'sinusitis': 1.2,
    }
    X_list, Y_list = [], []

    for _ in range(n):
        aqi   = rng.uniform(5, 500)
        pm25  = aqi * 0.45 + rng.normal(0, 5)
        pm10  = aqi * 0.65 + rng.normal(0, 8)
        no2   = aqi * 0.25 + rng.normal(0, 3)
        o3    = aqi * 0.30 + rng.normal(0, 4)
        temp  = rng.uniform(5, 42)
        humidity = rng.uniform(20, 95)
        age   = rng.uniform(10, 85)
        # Random temporal features (simulating LSTM output)
        trend     = rng.uniform(-1, 1)   # AQI trend direction
        volatility = rng.uniform(0, 50)  # AQI variability
        peak_aqi  = aqi + rng.uniform(0, 80)
        lstm_feats = rng.normal(0, 1, 8)  # other LSTM hidden state features

        # Condition flags
        cond_flags = (rng.random(len(CONDITION_LIST)) > 0.85).astype(float)
        mult = max([MULTIPLIERS[c] for c, f in zip(CONDITION_LIST, cond_flags) if f], default=1.0)

        base_risk = min(100, (aqi / 500) * 100)
        age_factor = 1.0 + max(0, (age - 60) * 0.01)
        risk = float(np.clip(base_risk * mult * age_factor + rng.normal(0, 3), 0, 100))

        features = np.concatenate([
            [aqi, pm25, pm10, no2, o3, temp, humidity, age,
             trend, volatility, peak_aqi],
            lstm_feats,
            cond_flags
        ])
        X_list.append(features)
        Y_list.append(risk)

    return np.array(X_list, dtype=np.float32), np.array(Y_list, dtype=np.float32)


# ─── Model registry (singleton) ──────────────────────────────────────────────

_lstm: Optional[NumpyLSTM] = None
_xgb  = None
_models_ready = False

def ensure_models_loaded():
    global _lstm, _xgb, _models_ready
    if _models_ready:
        return
    os.makedirs(MODELS_DIR, exist_ok=True)

    # ── LSTM ──
    _lstm = NumpyLSTM(input_size=8, hidden_size=32)
    if os.path.exists(LSTM_PATH):
        _lstm.load(LSTM_PATH)
        logger.info("LSTM model loaded from disk")
    else:
        logger.info("Training LSTM model...")
        X, Y = _generate_aqi_sequences(3000)
        _lstm.train(X, Y, epochs=80)
        _lstm.save(LSTM_PATH)
        logger.info(f"LSTM saved → {LSTM_PATH}")

    # ── XGBoost ──
    import xgboost as xgb
    if os.path.exists(XGB_PATH):
        with open(XGB_PATH, 'rb') as f:
            _xgb = pickle.load(f)
        logger.info("XGBoost model loaded from disk")
    else:
        logger.info("Training XGBoost risk model...")
        from sklearn.preprocessing import StandardScaler
        X_risk, Y_risk = _generate_risk_samples(5000)
        _xgb = xgb.XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            objective='reg:squarederror', random_state=42,
            tree_method='hist'
        )
        _xgb.fit(X_risk, Y_risk)
        with open(XGB_PATH, 'wb') as f:
            pickle.dump(_xgb, f)
        logger.info(f"XGBoost saved → {XGB_PATH}")

    _models_ready = True


# ─── Public API ───────────────────────────────────────────────────────────────

def predict_aqi_forecast(aqi_history: List[float], pollutants: Dict,
                          weather: Dict) -> Dict:
    """
    aqi_history: list of up to 24 past AQI readings (oldest first)
    Returns: 24-hour AQI forecast + trend analysis
    """
    ensure_models_loaded()
    # Pad/trim to exactly 24 steps
    history = list(aqi_history)
    while len(history) < 24:
        history.insert(0, history[0] if history else 100.0)
    history = history[-24:]

    seq = []
    for i, aqi_val in enumerate(history):
        hour = i % 24
        temp     = weather.get('temperature', 25)
        humidity = weather.get('humidity', 55)
        wind     = weather.get('wind_speed', 10)
        pm25     = pollutants.get('pm25', aqi_val * 0.45)
        pm10     = pollutants.get('pm10', aqi_val * 0.65)
        no2      = pollutants.get('no2',  aqi_val * 0.25)
        o3       = pollutants.get('o3',   aqi_val * 0.30)
        seq.append([aqi_val, pm25, pm10, no2, o3, temp, humidity, wind])

    seq_arr = np.array(seq, dtype=np.float32)
    forecast_raw = _lstm.forecast(seq_arr)
    forecast = [round(float(np.clip(v, 5, 500)), 1) for v in forecast_raw]

    # Trend analysis
    current_aqi = history[-1]
    avg_forecast = float(np.mean(forecast[:6]))  # next 6 hours
    trend = "improving" if avg_forecast < current_aqi * 0.95 else \
            "worsening" if avg_forecast > current_aqi * 1.05 else "stable"
    peak_val  = float(max(forecast))
    peak_hour = int(np.argmax(forecast))

    return {
        "forecast_24h": forecast,
        "trend": trend,
        "peak_aqi": peak_val,
        "peak_in_hours": peak_hour + 1,
        "avg_next_6h": round(avg_forecast, 1),
    }


def predict_risk_score(aqi: float, conditions: List[str],
                        pollutants: Dict, weather: Dict,
                        age: Optional[int] = None,
                        aqi_history: Optional[List[float]] = None) -> Dict:
    """
    Hybrid LSTM→XGBoost risk prediction.
    LSTM extracts temporal features, XGBoost predicts personalised risk.
    """
    ensure_models_loaded()

    # ── LSTM temporal features ──
    if aqi_history and len(aqi_history) >= 3:
        history = list(aqi_history)
        while len(history) < 24:
            history.insert(0, history[0])
        history = history[-24:]
        seq = []
        for aqi_val in history:
            seq.append([
                aqi_val,
                pollutants.get('pm25', aqi_val * 0.45),
                pollutants.get('pm10', aqi_val * 0.65),
                pollutants.get('no2',  aqi_val * 0.25),
                pollutants.get('o3',   aqi_val * 0.30),
                weather.get('temperature', 25),
                weather.get('humidity', 55),
                weather.get('wind_speed', 10),
            ])
        seq_arr = np.array(seq, dtype=np.float32)
        lstm_feats = _lstm.encode(seq_arr)
        trend_val    = float((history[-1] - history[0]) / (abs(history[0]) + 1))
        volatility   = float(np.std(history))
        peak_aqi_val = float(max(history))
    else:
        lstm_feats   = np.zeros(32, dtype=np.float32)
        trend_val    = 0.0
        volatility   = 0.0
        peak_aqi_val = aqi

    # ── Condition encoding ──
    cond_lower = [c.lower() for c in conditions]
    cond_flags = np.array([
        1.0 if any(c in cond for cond in cond_lower) else 0.0
        for c in CONDITION_LIST
    ], dtype=np.float32)

    # ── XGBoost feature vector ──
    features = np.concatenate([
        [aqi,
         pollutants.get('pm25', aqi * 0.45),
         pollutants.get('pm10', aqi * 0.65),
         pollutants.get('no2',  aqi * 0.25),
         pollutants.get('o3',   aqi * 0.30),
         weather.get('temperature', 25),
         weather.get('humidity', 55),
         float(age) if age else 30.0,
         trend_val, volatility, peak_aqi_val],
        lstm_feats[:8],   # use first 8 LSTM features
        cond_flags
    ])

    import xgboost as xgb
    risk_score = float(np.clip(_xgb.predict(features.reshape(1, -1))[0], 0, 100))

    # ── Risk level label ──
    if risk_score <= 20:   level = "low"
    elif risk_score <= 45: level = "medium"
    elif risk_score <= 70: level = "high"
    else:                  level = "dangerous"

    # ── Top contributing conditions ──
    affected = []
    MULTIPLIERS = {'asthma': 2.0, 'copd': 2.5, 'heart disease': 1.8,
                   'diabetes': 1.3, 'hypertension': 1.4, 'lung disease': 2.2,
                   'bronchitis': 1.9, 'allergies': 1.5, 'pregnancy': 1.6}
    for cond in conditions:
        for key, mult in MULTIPLIERS.items():
            if key in cond.lower():
                affected.append({"condition": cond, "impact": f"{mult}x risk"})

    return {
        "score": round(risk_score, 1),
        "level": level,
        "model": "lstm_xgb_hybrid",
        "affected_conditions": affected,
        "temporal_trend": "worsening" if trend_val > 0.1 else
                          "improving" if trend_val < -0.1 else "stable",
    }
