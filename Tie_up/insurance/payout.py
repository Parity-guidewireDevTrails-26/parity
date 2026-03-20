def calculate_payout(predicted_loss, expected_income, fraud_decision, claim_triggered, plan_type='SILVER'):
    \"\"\"
    Computes payout with deductibles, coverage limits, and fraud filtering.
    \"\"\"
    # 1. Check Fraud
    if fraud_decision in ['DENIED_FRAUD', 'WARNING_MANUAL_REVIEW']:
        # Manual review holds payout, returning 0 for now
        return 0.0

    # 2. Check Trigger
    if not claim_triggered:
        return 0.0
        
    # 3. Apply Minimum Loss Threshold (Small losses ignored)
    min_loss_threshold = 0.10 * expected_income
    if predicted_loss < min_loss_threshold:
        return 0.0
        
    # 4. Apply Deductible (Rider bears first portion)
    deductible = 0.10 * expected_income
    
    # 5. Apply Coverage Limit
    coverage_limit_pct = 0.55 if plan_type == 'PLATINUM' else 0.50
    coverage_limit_val = coverage_limit_pct * expected_income
    
    # 6. Final Payout Formula
    payout = min(coverage_limit_val, predicted_loss - deductible)
    
    return max(0.0, round(payout, 2))
