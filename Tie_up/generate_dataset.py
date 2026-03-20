import pandas as pd
import numpy as np
import os

def generate_synthetic_data(num_samples=10000):
    np.random.seed(42)

    # Base driver features
    hours_per_day = np.random.uniform(4, 12, num_samples)
    orders_per_hour = np.random.uniform(1.5, 4.0, num_samples)
    days_per_week = np.random.randint(3, 8, num_samples)
    earnings_per_order = np.random.uniform(40, 120, num_samples)

    # Environmental/Contextual features
    rainfall_mm = np.random.exponential(15, num_samples) # Heavy right skew
    # Cap rainfall to realistic limits
    rainfall_mm = np.clip(rainfall_mm, 0, 150)
    
    restaurant_density = np.random.uniform(0.1, 1.0, num_samples)
    peak_hour_ratio = np.random.uniform(0.1, 0.6, num_samples)
    platform_demand_index = np.random.uniform(0.5, 2.0, num_samples)
    surge_multiplier = np.where(platform_demand_index > 1.2, np.random.uniform(1.1, 2.5, num_samples), 1.0)
    
    aqi = np.random.normal(150, 100, num_samples)
    aqi = np.clip(aqi, 20, 800)
    
    temperature = np.random.normal(30, 8, num_samples)
    temperature = np.clip(temperature, 5, 50)

    # Expected Income (Ideal conditions)
    # expected_income = hours_per_day * orders_per_hour * earnings_per_order
    expected_income = hours_per_day * orders_per_hour * earnings_per_order * platform_demand_index * surge_multiplier

    # Calculate negative impacts from environment
    rain_penalty = np.where(rainfall_mm > 10, (rainfall_mm - 10) * 0.015, 0) # 1.5% drop per mm over 10
    rain_penalty = np.clip(rain_penalty, 0, 0.8) # Max 80% loss from rain

    aqi_penalty = np.where(aqi > 300, (aqi - 300) * 0.001, 0)
    aqi_penalty = np.clip(aqi_penalty, 0, 0.4)

    heat_penalty = np.where(temperature > 40, (temperature - 40) * 0.05, 0)
    heat_penalty = np.clip(heat_penalty, 0, 0.5)
    
    traffic_penalty = np.random.uniform(0, 0.3, num_samples) # base traffic

    total_penalty = np.clip(rain_penalty + aqi_penalty + heat_penalty + traffic_penalty, 0, 0.95)

    # Actual Income
    actual_income = expected_income * (1 - total_penalty)
    
    # Calculate Income Loss
    income_loss = expected_income - actual_income

    data = pd.DataFrame({
        'hours_per_day': hours_per_day,
        'orders_per_hour': orders_per_hour,
        'days_per_week': days_per_week,
        'earnings_per_order': earnings_per_order,
        'rainfall_mm': rainfall_mm,
        'restaurant_density': restaurant_density,
        'peak_hour_ratio': peak_hour_ratio,
        'platform_demand_index': platform_demand_index,
        'surge_multiplier': surge_multiplier,
        'aqi': aqi,
        'temperature': temperature,
        'expected_income': expected_income,
        'actual_income': actual_income,
        'income_loss': income_loss
    })

    return data

if __name__ == "__main__":
    print("Generating synthetic dataset...")
    df = generate_synthetic_data(20000)
    
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    output_path = 'data/synthetic_delivery_data.csv'
    df.to_csv(output_path, index=False)
    print(f"Dataset securely generated and saved to {output_path}")
    print(df.head())
