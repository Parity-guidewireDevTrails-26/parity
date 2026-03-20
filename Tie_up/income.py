class IncomeCalculator:
    def __init__(self):
        pass

    def calculate_expected_income(self, hours_per_day, orders_per_hour, earnings_per_order, platform_demand_index=1.0, surge_multiplier=1.0):
        """
        Calculates the expected income under normal ideal conditions.
        """
        base_income = hours_per_day * orders_per_hour * earnings_per_order
        return base_income * platform_demand_index * surge_multiplier

    def validate_income_loss(self, expected_income, claimed_actual_income):
        """
        Validates the claimed income against the expected income
        Returns true if the claim seems reasonable, and the loss amount.
        """
        loss = expected_income - claimed_actual_income
        if loss < 0:
            return False, 0.0 # Cannot have negative loss
            
        # If they claim more than 100% of expected, flag anomaly
        if loss > expected_income:
            return False, expected_income
            
        return True, loss
        
    def get_historical_baseline(self, historical_data):
        """
        Calculates a rolling baseline for a rider based on historical data.
        Returns average hourly rate and daily earnings.
        """
        if not historical_data:
            return 0.0, 0.0
            
        avg_hourly = sum(d['hourly_rate'] for d in historical_data) / len(historical_data)
        avg_daily = sum(d['daily_earnings'] for d in historical_data) / len(historical_data)
        
        return avg_hourly, avg_daily
