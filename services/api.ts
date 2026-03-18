export interface User {
  id: string;
  phone_number: string;
  name: string;
  platform: string;
  work_city: string;
  work_zone?: string;
  is_verified: boolean;
}

export interface Policy {
  id: string;
  name: string;
  weekly_premium: number;
  coverage_limit: number;
  description: string;
  is_active: boolean;
}

export interface Claim {
  id: string;
  user_id: string;
  claim_type: string;
  status: string;
  estimated_income_loss: number;
  payout_amount: number;
  disruption_start: string;
  disruption_end: string;
  created_at: string;
  gps_verified: boolean;
  device_verified: boolean;
  fraud_score: number;
}

// ── Mock Helper ─────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ApiService {
  private static token: string | null = null;
  private static activePlanId: string | null = null;

  static setToken(token: string) { this.token = token; }
  static getToken() { return this.token; }
  static clearToken() { this.token = null; }

  // ── Auth ──
  static async register() {
    await delay(800);
    const token = 'mock_jwt_token_123';
    this.setToken(token);
    return { token };
  }

  static async login() {
    await delay(800);
    const token = 'mock_jwt_token_123';
    this.setToken(token);
    return { token };
  }

  // ── Profile ──
  static async getProfile(): Promise<{ user: User }> {
    await delay(300);
    return {
      user: {
        id: 'usr_123',
        name: 'Raj Kumar',
        phone_number: '+91 98765 43210',
        platform: 'Swiggy',
        work_city: 'Delhi',
        work_zone: 'Malviya Nagar, Delhi',
        is_verified: true,
      },
    };
  }

  static async updateProfile(updates: { work_zone?: string }) {
    await delay(600);
    return { success: true };
  }

  // ── Policies ──
  static async getPolicies(): Promise<{ policies: Policy[] }> {
    await delay(400);
    return {
      policies: [
        { id: 'policy_01', name: 'Silver', weekly_premium: 45, coverage_limit: 1500, description: 'Basic rain protection', is_active: false },
        { id: 'policy_02', name: 'Gold', weekly_premium: 85, coverage_limit: 3500, description: 'Most popular rider choice', is_active: true },
        { id: 'policy_03', name: 'Platinum', weekly_premium: 150, coverage_limit: 7000, description: 'Maximum coverage', is_active: false },
      ],
    };
  }

  static async subscribeToPlan(policyId: string): Promise<{ subscription: any }> {
    await delay(1200);
    this.activePlanId = policyId;
    return { subscription: { policy_id: policyId, status: 'active' } };
  }

  static async getActivePolicy() {
    await delay(300);
    if (!this.activePlanId) throw new Error("No active policy");
    
    let name = 'Gold', limit = 3500;
    if (this.activePlanId === 'policy_01') { name = 'Silver'; limit = 1500; }
    if (this.activePlanId === 'policy_03') { name = 'Platinum'; limit = 7000; }

    return {
      active_policy: {
        id: this.activePlanId,
        policy_name: name,
        coverage_limit: limit,
        status: 'active',
      },
    };
  }

  // ── Claims ──
  static async getClaims(userId: string): Promise<{ claims: Claim[] }> {
    await delay(500);
    const mockClaims: Claim[] = [
      {
        id: 'claim_901',
        user_id: 'usr_123',
        claim_type: 'rainfall',
        status: 'paid',
        estimated_income_loss: 500,
        payout_amount: 350,
        disruption_start: '2025-10-12T14:00:00Z',
        disruption_end: '2025-10-12T16:00:00Z',
        created_at: '2025-10-12T14:15:00Z',
        gps_verified: true,
        device_verified: true,
        fraud_score: 0.12,
      },
      {
        id: 'claim_902',
        user_id: 'usr_123',
        claim_type: 'pollution',
        status: 'pending',
        estimated_income_loss: 800,
        payout_amount: 0,
        disruption_start: '2026-03-01T08:00:00Z',
        disruption_end: '2026-03-01T12:00:00Z',
        created_at: '2026-03-01T14:00:00Z',
        gps_verified: true,
        device_verified: false,
        fraud_score: 0.65,
      },
    ];
    return { claims: mockClaims };
  }
}
