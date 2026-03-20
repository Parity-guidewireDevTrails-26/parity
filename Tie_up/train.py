import os
import pandas as pd
import xgboost as xgb
import pickle
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def train_model(data_path='data/synthetic_delivery_data.csv', model_dir='models'):
    print("Loading dataset...")
    df = pd.read_csv(data_path)
    
    # We predict income_loss based on environment and base features
    # Note: actual_income is what we derive, so we don't use it as input.
    # expected_income is also technically derived, but could be known prior.
    
    features = [
        'hours_per_day', 'orders_per_hour', 'days_per_week', 'earnings_per_order',
        'rainfall_mm', 'restaurant_density', 'peak_hour_ratio', 
        'platform_demand_index', 'surge_multiplier', 'aqi', 'temperature',
        'expected_income'
    ]
    
    X = df[features]
    y = df['income_loss']
    
    print("Splitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=100, 
        learning_rate=0.1, 
        max_depth=5, 
        random_state=42,
        objective='reg:squarederror'
    )
    
    model.fit(X_train, y_train)
    
    print("Evaluating model...")
    y_pred = model.predict(X_test)
    
    mse = mean_squared_error(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"MSE: {mse:.4f}")
    print(f"MAE: {mae:.4f}")
    print(f"R²: {r2:.4f}")
    
    # Ensure models directory exists
    os.makedirs(model_dir, exist_ok=True)
    
    model_path = os.path.join(model_dir, 'xgboost_income_loss.json')
    features_path = os.path.join(model_dir, 'model_features.pkl')
    
    print(f"Saving model to {model_path}...")
    model.save_model(model_path)
    
    with open(features_path, 'wb') as f:
        pickle.dump(features, f)
        
    print("Training complete and model saved securely.")

if __name__ == "__main__":
    if not os.path.exists('data/synthetic_delivery_data.csv'):
        print("Data not found. Please run generate_dataset.py first.")
    else:
        train_model()
