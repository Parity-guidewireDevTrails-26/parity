"""
Parity ML Service — FastAPI
Exposes: /predict, /fraud/score, /premium/calculate, /payout/calculate, /health
"""
import os
import sys
import time as _time
import pickle
import json
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx

import numpy as np
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("parity-ml")

# ── Model State ──────────────────────────────────────────────────────────────
MODEL_STATE = {
    "model": None,
    "features": None,
    "loaded": False,
}

MODEL_PATH = os.getenv("MODEL_PATH", "models/xgboost_income_loss.json")
FEATURES_PATH = os.getenv("FEATURES_PATH", "models/model_features.pkl")

EXPECTED_FEATURES = [
    "hours_per_day", "orders_per_hour", "days_per_week", "earnings_per_order",
    "rainfall_mm", "restaurant_density", "peak_hour_ratio",
    "platform_demand_index", "surge_multiplier", "aqi", "temperature",
    "expected_income",
]


def load_model():
    """Load XGBoost model and feature list from disk."""
    if os.path.exists(MODEL_PATH) and os.path.exists(FEATURES_PATH):
        model = xgb.XGBRegressor()
        model.load_model(MODEL_PATH)
        with open(FEATURES_PATH, "rb") as f:
            features = pickle.load(f)
        MODEL_STATE["model"] = model
        MODEL_STATE["features"] = features
        MODEL_STATE["loaded"] = True
        logger.info("✅ XGBoost model loaded successfully from %s", MODEL_PATH)
    else:
        logger.warning(
            "⚠️  Model files not found at %s / %s — run train.py first. "
            "Falling back to formula-based estimation.",
            MODEL_PATH, FEATURES_PATH
        )
        MODEL_STATE["loaded"] = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Parity ML Service",
    description="Income loss prediction, fraud scoring, premium calculation, and payout computation.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class PredictionRequest(BaseModel):
    hours_per_day: float = Field(..., ge=0, le=24, description="Avg working hours/day")
    orders_per_hour: float = Field(..., ge=0, description="Deliveries per hour")
    days_per_week: float = Field(..., ge=0, le=7)
    earnings_per_order: float = Field(..., ge=0, description="INR per delivery")
    rainfall_mm: float = Field(0.0, ge=0)
    restaurant_density: float = Field(0.5, ge=0, le=1)
    peak_hour_ratio: float = Field(0.3, ge=0, le=1)
    platform_demand_index: float = Field(1.0, ge=0)
    surge_multiplier: float = Field(1.0, ge=1)
    aqi: float = Field(100.0, ge=0)
    temperature: float = Field(30.0)
    expected_income: Optional[float] = Field(None, description="Pre-calculated or will be derived")


class FraudRequest(BaseModel):
    device_integrity_issue: bool = False
    gps_ip_mismatch: bool = False
    speed_up_location: bool = False
    crowdsource_mismatch: bool = False
    trust_score: float = Field(1.0, ge=0, le=1)


class PremiumRequest(BaseModel):
    expected_weekly_income: float = Field(..., ge=0)
    risk_score: float = Field(..., ge=0, le=1)
    plan: str = Field(..., pattern="^(SILVER|GOLD|PLATINUM)$")


class PayoutRequest(BaseModel):
    predicted_loss: float = Field(..., ge=0)
    expected_income: float = Field(..., ge=0)
    fraud_decision: str = Field(..., description="VERIFIED | WARNING_MANUAL_REVIEW | DENIED_FRAUD")
    claim_triggered: bool = True
    plan: str = Field("GOLD", pattern="^(SILVER|GOLD|PLATINUM)$")
    coverage_limit: Optional[float] = Field(None, description="Override coverage limit (e.g. from user policy)")


class RiskRequest(BaseModel):
    rainfall_mm: float = Field(0.0, ge=0)
    aqi: float = Field(100.0, ge=0)
    temperature: float = Field(30.0)
    platform_demand_index: float = Field(1.0, ge=0)
    restaurant_density: float = Field(0.5, ge=0, le=1)
    peak_hour_ratio: float = Field(0.3, ge=0, le=1)


# ── Formula-based fallback ────────────────────────────────────────────────────
def estimate_income_loss_formula(req: PredictionRequest, expected_income: float) -> float:
    """
    Used when the XGBoost model is not loaded.
    Mirrors the logic from generate_dataset.py.
    """
    rain_penalty = max(0, min(0.80, (req.rainfall_mm - 10) * 0.015)) if req.rainfall_mm > 10 else 0
    aqi_penalty = max(0, min(0.40, (req.aqi - 300) * 0.001)) if req.aqi > 300 else 0
    heat_penalty = max(0, min(0.50, (req.temperature - 40) * 0.05)) if req.temperature > 40 else 0
    total_penalty = min(0.95, rain_penalty + aqi_penalty + heat_penalty)
    return round(expected_income * total_penalty, 2)


def compute_risk_score(rainfall_mm, aqi, temperature, platform_demand_index, restaurant_density, peak_hour_ratio) -> float:
    """Port of Tie_up/insurance/risk.py."""
    score = 0.0
    if rainfall_mm > 40:
        score += min(0.35, (rainfall_mm - 40) * 0.005)
    if aqi > 300:
        score += min(0.20, (aqi - 300) * 0.001)
    if temperature > 42:
        score += min(0.25, (temperature - 42) * 0.05)
    elif temperature < 10:
        score += min(0.20, (10 - temperature) * 0.05)
    if platform_demand_index > 1.5:
        score += 0.10
    if restaurant_density > 0.8:
        score = max(0, score - 0.05)
    if peak_hour_ratio > 0.5:
        score += 0.15
    return round(max(0.0, min(1.0, score)), 4)


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "parity-ml",
        "model_loaded": MODEL_STATE["loaded"],
        "model_path": MODEL_PATH,
    }


@app.post("/predict")
def predict_income_loss(req: PredictionRequest):
    """
    Predict income loss for a rider given environmental and operational features.
    Uses XGBoost if trained model is available, formula-based fallback otherwise.
    """
    # Derive expected_income if not provided
    expected_income = req.expected_income
    if expected_income is None or expected_income <= 0:
        expected_income = (
            req.hours_per_day
            * req.orders_per_hour
            * req.earnings_per_order
            * req.platform_demand_index
            * req.surge_multiplier
        )

    if MODEL_STATE["loaded"]:
        try:
            feature_vector = np.array([[
                req.hours_per_day, req.orders_per_hour, req.days_per_week,
                req.earnings_per_order, req.rainfall_mm, req.restaurant_density,
                req.peak_hour_ratio, req.platform_demand_index, req.surge_multiplier,
                req.aqi, req.temperature, expected_income,
            ]])
            predicted_loss = float(MODEL_STATE["model"].predict(feature_vector)[0])
            predicted_loss = max(0.0, predicted_loss)
            method = "xgboost"
        except Exception as e:
            logger.error("XGBoost prediction failed: %s — falling back to formula", e)
            predicted_loss = estimate_income_loss_formula(req, expected_income)
            method = "formula_fallback"
    else:
        predicted_loss = estimate_income_loss_formula(req, expected_income)
        method = "formula_fallback"

    risk_score = compute_risk_score(
        req.rainfall_mm, req.aqi, req.temperature,
        req.platform_demand_index, req.restaurant_density, req.peak_hour_ratio,
    )

    return {
        "predicted_income_loss": round(predicted_loss, 2),
        "expected_income": round(expected_income, 2),
        "risk_score": risk_score,
        "method": method,
    }


@app.post("/fraud/score")
def score_fraud(req: FraudRequest):
    """
    4-layer fraud gatekeeper scoring.
    Port of Tie_up/insurance/fraud.py.
    """
    fraud_score = 0

    if req.device_integrity_issue:
        fraud_score += 2
    if req.gps_ip_mismatch:
        fraud_score += 2
    if req.speed_up_location:
        fraud_score += 3  # Auto-fraud
    if req.crowdsource_mismatch:
        fraud_score += 1
    if req.trust_score < 0.5:
        fraud_score += 1

    if fraud_score <= 1:
        decision = "VERIFIED"
    elif fraud_score == 2:
        decision = "WARNING_MANUAL_REVIEW"
    else:
        decision = "DENIED_FRAUD"

    return {
        "fraud_score": fraud_score,
        "decision": decision,
        "breakdown": {
            "device_integrity": 2 if req.device_integrity_issue else 0,
            "gps_ip_mismatch": 2 if req.gps_ip_mismatch else 0,
            "speed_anomaly": 3 if req.speed_up_location else 0,
            "crowdsource_mismatch": 1 if req.crowdsource_mismatch else 0,
            "low_trust_score": 1 if req.trust_score < 0.5 else 0,
        },
    }


@app.post("/risk/score")
def risk_score_endpoint(req: RiskRequest):
    """Compute environmental risk score [0, 1]."""
    score = compute_risk_score(
        req.rainfall_mm, req.aqi, req.temperature,
        req.platform_demand_index, req.restaurant_density, req.peak_hour_ratio,
    )
    return {"risk_score": score}


@app.post("/premium/calculate")
def calculate_premium(req: PremiumRequest):
    """
    Dynamic premium calculator.
    Port of Tie_up/insurance/premium.py.
    Formula: Base × RiskMultiplier × PlanLoading, capped [40, 250] INR/week
    """
    plans = {
        "SILVER":   {"coverage": 0.50, "loading": 1.00},
        "GOLD":     {"coverage": 0.50, "loading": 1.15},
        "PLATINUM": {"coverage": 0.55, "loading": 1.30},
    }

    plan = plans[req.plan]
    base_rate = 0.012  # 1.2% base contribution to aggregate pool
    base_premium = req.expected_weekly_income * plan["coverage"] * base_rate
    risk_multiplier = 1 + (req.risk_score ** 1.5)
    final_premium = base_premium * risk_multiplier * plan["loading"]

    # Cap to realistic INR range
    final_premium = max(40, min(250, final_premium))

    coverage_limit = req.expected_weekly_income * plan["coverage"]

    return {
        "plan": req.plan,
        "base_premium": round(base_premium, 2),
        "risk_multiplier": round(risk_multiplier, 4),
        "risk_surcharge": round(final_premium - base_premium, 2),
        "total_premium": round(final_premium, 2),
        "coverage_limit": round(coverage_limit, 2),
        "coverage_pct": plan["coverage"],
    }


@app.post("/payout/calculate")
def calculate_payout(req: PayoutRequest):
    """
    Final payout formula with deductibles, thresholds, and fraud filtering.
    Port of Tie_up/insurance/payout.py.
    """
    if req.fraud_decision in ("DENIED_FRAUD", "WARNING_MANUAL_REVIEW"):
        return {
            "payout": 0.0,
            "reason": "Claim denied or held for manual review due to fraud signals.",
            "fraud_decision": req.fraud_decision,
        }

    if not req.claim_triggered:
        return {"payout": 0.0, "reason": "No parametric trigger met threshold."}

    min_threshold = 0.10 * req.expected_income
    if req.predicted_loss < min_threshold:
        return {
            "payout": 0.0,
            "reason": f"Loss ₹{req.predicted_loss:.0f} below minimum threshold ₹{min_threshold:.0f}.",
        }

    deductible = 0.10 * req.expected_income
    net_loss = req.predicted_loss - deductible

    if req.coverage_limit:
        coverage_cap = req.coverage_limit
    else:
        pct = 0.55 if req.plan == "PLATINUM" else 0.50
        coverage_cap = pct * req.expected_income

    payout = max(0.0, min(coverage_cap, net_loss))

    return {
        "payout": round(payout, 2),
        "predicted_loss": req.predicted_loss,
        "deductible": round(deductible, 2),
        "net_loss": round(net_loss, 2),
        "coverage_cap": round(coverage_cap, 2),
        "reason": "Verified and processed.",
        "fraud_decision": req.fraud_decision,
    }


# ── /risk/location — personalised premium from GPS ───────────────────────────
class LocationRiskRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    hours_per_day: float = Field(8.0, ge=0, le=24)
    orders_per_hour: float = Field(3.0, ge=0)
    days_per_week: float = Field(5.0, ge=0, le=7)
    earnings_per_order: float = Field(60.0, ge=0)
    platform: str = Field("Swiggy")


def _fetch_owm_current(lat: float, lng: float, api_key: str) -> dict:
    """Fetch current weather from OpenWeatherMap."""
    url = (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?lat={lat}&lon={lng}&appid={api_key}&units=metric"
    )
    resp = httpx.get(url, timeout=8)
    resp.raise_for_status()
    return resp.json()


def _fetch_owm_history(lat: float, lng: float, api_key: str) -> dict:
    """Fetch past 7 days (168 hours) of weather history from OWM."""
    end_ts = int(_time.time())
    start_ts = end_ts - (7 * 24 * 3600)  # 7 days ago
    url = (
        f"https://history.openweathermap.org/data/2.5/history/city"
        f"?lat={lat}&lon={lng}&type=hour&start={start_ts}&cnt=168"
        f"&appid={api_key}&units=metric"
    )
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _build_risk_from_owm(current: dict, history: dict | None) -> dict:
    """Extract weather signals and compute aggregate risk for the location."""
    rain1h = current.get("rain", {}).get("1h", 0.0)
    temp = current.get("main", {}).get("temp", 30.0)
    humidity = current.get("main", {}).get("humidity", 50.0)

    # Defaults for historical averages
    avg_rain = rain1h
    max_temp = temp
    rain_event_days = 1 if rain1h > 5 else 0

    if history and "list" in history:
        rain_vals = [r.get("rain", {}).get("1h", 0.0) for r in history["list"]]
        temp_vals = [r.get("main", {}).get("temp", 30.0) for r in history["list"]]
        avg_rain = sum(rain_vals) / max(len(rain_vals), 1)
        max_temp = max(temp_vals) if temp_vals else temp
        rain_event_days = sum(1 for r in rain_vals if r > 10) // 8  # 8 readings/day

    return {
        "current_rain_mm": round(rain1h, 2),
        "avg_rain_7d_mm": round(avg_rain, 2),
        "current_temp_c": round(temp, 2),
        "max_temp_7d_c": round(max_temp, 2),
        "humidity_pct": humidity,
        "rain_event_days_7d": rain_event_days,
    }


@app.post("/risk/location")
async def risk_from_location(req: LocationRiskRequest):
    """
    Called during onboarding after the user grants location.
    1. Fetches live OWM weather for the user's GPS
    2. Tries OWM History API for past 7 days (requires paid plan — gracefully falls back)
    3. Computes risk score from combined signals
    4. Returns personalised premium recommendations for all 3 plans
    """
    owm_key = os.getenv("OWM_API_KEY", "b1777a4ef541f1908bb7b32aece06067")

    # ── Step 1: Fetch current weather ─────────────────────────────────────────
    try:
        current = _fetch_owm_current(req.lat, req.lng, owm_key)
    except Exception as e:
        logger.warning("OWM current weather fetch failed: %s — using defaults", e)
        current = {}

    # ── Step 2: Try historical data (paid plan feature) ───────────────────────
    history = None
    try:
        history = _fetch_owm_history(req.lat, req.lng, owm_key)
        logger.info("✅ OWM historical data fetched (%d records)", len(history.get("list", [])))
    except Exception as e:
        logger.info("OWM history not available (free plan): %s", e)

    # ── Step 3: Build weather signals ─────────────────────────────────────────
    signals = _build_risk_from_owm(current, history)

    # ── Step 4: Compute risk score ────────────────────────────────────────────
    risk_score = compute_risk_score(
        rainfall_mm=signals["avg_rain_7d_mm"],
        aqi=100.0,  # AQI not in OWM free tier
        temperature=signals["current_temp_c"],
        platform_demand_index=1.0,
        restaurant_density=0.6,
        peak_hour_ratio=0.35,
    )

    # ── Step 5: Compute expected weekly income ────────────────────────────────
    expected_weekly = (
        req.hours_per_day * req.orders_per_hour * req.earnings_per_order * req.days_per_week
    )

    # ── Step 6: Personalised premium for each plan ────────────────────────────
    def _premium(plan: str) -> dict:
        plans = {
            "SILVER":   {"coverage": 0.50, "loading": 1.00, "coverage_limit": 1500},
            "GOLD":     {"coverage": 0.50, "loading": 1.15, "coverage_limit": 3500},
            "PLATINUM": {"coverage": 0.55, "loading": 1.30, "coverage_limit": 7000},
        }
        p = plans[plan]
        base = expected_weekly * p["coverage"] * 0.012
        multiplier = 1 + (risk_score ** 1.5)
        total = max(40, min(250, base * multiplier * p["loading"]))
        return {
            "plan": plan,
            "weekly_premium": round(total, 2),
            "coverage_limit": p["coverage_limit"],
            "risk_loading": round((multiplier - 1) * 100, 1),
        }

    return {
        "location": {"lat": req.lat, "lng": req.lng},
        "weather": signals,
        "risk_score": risk_score,
        "risk_label": "HIGH" if risk_score > 0.6 else "MEDIUM" if risk_score > 0.3 else "LOW",
        "expected_weekly_income": round(expected_weekly, 2),
        "recommended_plan": "GOLD" if risk_score > 0.4 else "SILVER",
        "plans": [_premium("SILVER"), _premium("GOLD"), _premium("PLATINUM")],
        "data_source": "historical_7d" if history else "current_only",
    }

