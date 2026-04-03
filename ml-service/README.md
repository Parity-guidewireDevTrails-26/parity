# Parity ML Service

## What it does
Serves 5 endpoints to power Parity's real-time intelligence:

| Endpoint | Description |
|---|---|
| `POST /predict` | XGBoost income loss prediction (falls back to formula if model not trained) |
| `POST /fraud/score` | 4-layer fraud gatekeeper score |
| `POST /risk/score` | Environmental risk score [0–1] |
| `POST /premium/calculate` | Dynamic weekly premium |
| `POST /payout/calculate` | Final payout with deductibles, thresholds, and fraud filter |
| `GET /health` | Service health + model load status |

## Local Setup

### Step 1 — Install dependencies
```bash
cd ml-service
pip install -r requirements.txt
```

### Step 2 — Train the model (one-time)
```bash
cd ../Tie_up
python generate_dataset.py    # creates data/synthetic_delivery_data.csv
python train.py               # trains and saves models/xgboost_income_loss.json
```

### Step 3 — Copy models to ml-service
```bash
cp -r Tie_up/models ml-service/models
```

### Step 4 — Start the server
```bash
cd ml-service
uvicorn main:app --host 0.0.0.0 --port 8085 --reload
```

### Step 5 — Test it
```bash
curl -X POST http://localhost:8085/predict \
  -H "Content-Type: application/json" \
  -d '{"hours_per_day":8,"orders_per_hour":3,"days_per_week":5,"earnings_per_order":60,"rainfall_mm":55,"aqi":120,"temperature":32,"restaurant_density":0.6,"peak_hour_ratio":0.4,"platform_demand_index":1.0,"surge_multiplier":1.0}'
```

## Deploy to Railway

1. Push the `ml-service/` directory to Railway
2. Railway auto-detects `Procfile` and runs: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Set environment variable: `MODEL_PATH=models/xgboost_income_loss.json`
4. Copy the Railway URL and set `ML_SERVICE_URL=https://xxx.railway.app` in your Go backend's env

> The service works WITHOUT a trained model — it falls back to a formula-based income loss estimate derived from the same logic as `generate_dataset.py`.
