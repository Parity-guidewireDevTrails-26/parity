def compute_risk_score(rainfall_mm, aqi, temperature, platform_demand_index, restaurant_density, peak_hour_ratio):
    \"\"\"
    Computes a normalized risk score [0, 1] based on environmental and operational indicators.
    Tailored to Indian urban conditions (e.g., Delhi summer heat, monsoons).
    \"\"\"
    score = 0.0
    
    # 1. Rainfall Thresholds (max +0.35)
    if rainfall_mm > 40:
        score += min(0.35, (rainfall_mm - 40) * 0.005)
        
    # 2. AQI Levels (max +0.2)
    if aqi > 300:
        score += min(0.2, (aqi - 300) * 0.001)
        
    # 3. Temperature Extremes (max +0.25)
    if temperature > 42:
        score += min(0.25, (temperature - 42) * 0.05)
    elif temperature < 10:
        score += min(0.2, (10 - temperature) * 0.05)
        
    # 4. Operational Modifiers
    # High demand might increase haste and risk (+0.1)
    if platform_demand_index > 1.5:
        score += 0.1
        
    # High density means closer orders, slightly less travel risk (-0.05)
    if restaurant_density > 0.8:
        score = max(0, score - 0.05)
        
    # Peak hour introduces traffic risk (+0.15)
    if peak_hour_ratio > 0.5:
        score += 0.15
        
    # Normalize heavily to [0, 1]
    return max(0.0, min(1.0, score))
