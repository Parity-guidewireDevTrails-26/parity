/**
 * Calculates the recommended Parametric Insurance Tier and Weekly Premium
 * based on the rider's expected income and historical zone risk.
 *
 * @param {number} deliveriesPerDay - Average deliveries completed per day.
 * @param {number} avgDeliveryFee - Average fee earned per delivery in ₹.
 * @param {'Low' | 'Medium' | 'High'} riskLevel - Risk profile of the primary work city/zone.
 * @returns {Object} { tier: string, base_premium: number, surcharge: number, total_premium: number, coverage_limit: number }
 */
export function calculatePremium(deliveriesPerDay: number, avgDeliveryFee: number, riskLevel: 'Low' | 'Medium' | 'High') {
    // 1. Calculate Expected Baseline Income (assuming 7-day work week)
    const expectedWeeklyIncome = (deliveriesPerDay * avgDeliveryFee) * 7;
  
    // 2. Determine Tier based on Expected Income
    let tier = '';
    let basePremium = 0;
    let coverageLimit = 0;
  
    if (expectedWeeklyIncome >= 10000) {
      tier = 'Platinum';
      basePremium = 115;
      coverageLimit = 5500; // 55%
    } else if (expectedWeeklyIncome >= 7000) {
      tier = 'Gold';
      basePremium = 85;
      coverageLimit = 3500; // 50%
    } else {
      tier = 'Silver';
      basePremium = 60;
      coverageLimit = 2000; // 50%
    }
  
    // 3. Apply Dynamic Surcharges
    let surcharge = 0;
    switch (riskLevel) {
      case 'Low':
        surcharge = 15;
        break;
      case 'Medium':
        surcharge = 35;
        break;
      case 'High':
        surcharge = 55;
        break;
    }
  
    return {
      expectedWeeklyIncome,
      tier,
      basePremium,
      surcharge,
      totalPremium: basePremium + surcharge,
      coverageLimit,
    };
  }
  
