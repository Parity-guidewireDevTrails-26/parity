def score_claim_fraud(device_integrity_issue=False, gps_ip_mismatch=False, speed_up_location=False, crowdsource_mismatch=False, trust_score=0.8):
    \"\"\"
    Calculates fraud probability score based on real-time event checks.
    Returns: fraud_score (int), decision (str)
    \"\"\"
    fraud_score = 0
    
    if device_integrity_issue:
        fraud_score += 2
        
    if gps_ip_mismatch:
        fraud_score += 2
        
    if speed_up_location:
        fraud_score += 3  # Auto-fraud
        
    if crowdsource_mismatch:
        fraud_score += 1
        
    if trust_score < 0.5:
        fraud_score += 1
        
    # Decision Logic
    if fraud_score <= 1:
        decision = 'VERIFIED'
    elif fraud_score == 2:
        decision = 'WARNING_MANUAL_REVIEW'
    else:
        decision = 'DENIED_FRAUD'
        
    return fraud_score, decision
