class PremiumCalculator:
    PLANS = {
        'SILVER': {'coverage': 0.50, 'loading': 1.0},
        'GOLD': {'coverage': 0.50, 'loading': 1.15},
        'PLATINUM': {'coverage': 0.55, 'loading': 1.30}
    }

    @staticmethod
    def calculate_premium(expected_weekly_income, risk_score, plan_type='SILVER'):
        \"\"\"
        Calculates the weekly micro-premium based on income, risk, and plan.
        \"\"\"
        if plan_type not in PremiumCalculator.PLANS:
            raise ValueError("Invalid Plan Type")
            
        plan_details = PremiumCalculator.PLANS[plan_type]
        
        # Base Premium = Expected Weekly Income * Coverage * constant (e.g. 1% as base rate)
        # Using 0.012 representing 1.2% base contribution to aggregate pool
        base_rate = 0.012 
        base_premium = expected_weekly_income * plan_details['coverage'] * base_rate
        
        # Risk Multiplier = 1 + (Risk ^ 1.5)
        risk_multiplier = 1 + (risk_score ** 1.5)
        
        # Premium = Base Premium * Risk Multiplier * Plan Loading
        final_premium = base_premium * risk_multiplier * plan_details['loading']
        
        # Cap min/max practical premiums typical for Indian gig workers
        return max(40, min(250, round(final_premium, 2)))
