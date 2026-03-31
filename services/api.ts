import { supabase } from '@/utils/supabase';

export interface DeviceFingerprint {
  hardware_uuid: string;
  os_version: string;
  root_status: boolean;
  screen_resolution: string;
  timestamp: string;
}

export interface User {
  id: string;
  phone_number: string;
  name: string;
  platform: string;
  work_city: string;
  work_zone?: string;
  is_verified: boolean;
  device_fingerprint?: DeviceFingerprint | null;
  trust_score?: number;
  zone_cluster_id?: string;
}

export interface RegisterPayload {
  phone_number: string;
  name: string;
  platform: string;
  work_city: string;
  password: string;
  device_fingerprint: DeviceFingerprint;
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
  private static currentUserId: string | null = null;

  static setToken(token: string) { this.token = token; }
  static getToken() { return this.token; }
  static clearToken() { this.token = null; this.currentUserId = null; }

  // ── Auth ──
  static async register(payload: RegisterPayload) {
    // 1. Insert into Supabase users table
    const { data, error } = await supabase
      .from('users')
      .insert({
        phone_number: payload.phone_number,
        name: payload.name,
        platform: payload.platform,
        work_city: payload.work_city,
        device_fingerprint: JSON.stringify(payload.device_fingerprint),
        is_verified: true,
        password_hash: `mock_hash_${payload.password}`, // In prod: bcrypt hashed
      })
      .select('id')
      .single();

    if (error) {
      // If phone already registered, try to fetch the existing user
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('phone_number', payload.phone_number)
          .single();
        if (existing) {
          this.currentUserId = existing.id;
          const token = 'mock_jwt_token_123';
          this.setToken(token);
          return { token, userId: existing.id };
        }
      }
      throw new Error(error.message);
    }

    this.currentUserId = data.id;
    const token = 'mock_jwt_token_123';
    this.setToken(token);
    return { token, userId: data.id };
  }

  static async login(phoneNumber: string, password: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, platform, work_city')
      .eq('phone_number', phoneNumber)
      .single();

    if (error || !data) throw new Error('User not found. Please register first.');

    this.currentUserId = data.id;
    const token = 'mock_jwt_token_123';
    this.setToken(token);
    return { token, userId: data.id };
  }

  // ── Profile ──
  static async getProfile(): Promise<{ user: User }> {
    if (!this.currentUserId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('users')
      .select('id, phone_number, name, platform, work_city, work_zone, is_verified, device_fingerprint')
      .eq('id', this.currentUserId)
      .single();

    if (error || !data) throw new Error('Profile not found');

    let parsedFingerprint: DeviceFingerprint | null = null;
    try {
      parsedFingerprint = data.device_fingerprint ? JSON.parse(data.device_fingerprint) : null;
    } catch { parsedFingerprint = null; }

    return {
      user: {
        id: data.id,
        name: data.name,
        phone_number: data.phone_number,
        platform: data.platform,
        work_city: data.work_city,
        work_zone: data.work_zone ?? '',
        is_verified: data.is_verified,
        device_fingerprint: parsedFingerprint,
        trust_score: 0.92,
        zone_cluster_id: 'DEL-SAKET-01',
      },
    };
  }

  static async updateProfile(updates: { work_zone?: string; name?: string; platform?: string; work_city?: string }) {
    if (!this.currentUserId) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', this.currentUserId);

    if (error) throw new Error(error.message);
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
    if (!this.activePlanId) throw new Error('No active policy');

    let name = 'Gold', limit = 3500;
    if (this.activePlanId === 'policy_01') { name = 'Silver'; limit = 1500; }
    if (this.activePlanId === 'policy_03') { name = 'Platinum'; limit = 7000; }

    return {
      active_policy: { id: this.activePlanId, policy_name: name, coverage_limit: limit, status: 'active' },
    };
  }

  // ── Claims ──
  static async getClaims(userId: string): Promise<{ claims: Claim[] }> {
    await delay(500);
    return {
      claims: [
        {
          id: 'claim_901', user_id: userId, claim_type: 'rainfall', status: 'paid',
          estimated_income_loss: 500, payout_amount: 350,
          disruption_start: '2025-10-12T14:00:00Z', disruption_end: '2025-10-12T16:00:00Z',
          created_at: '2025-10-12T14:15:00Z', gps_verified: true, device_verified: true, fraud_score: 0.12,
        },
        {
          id: 'claim_902', user_id: userId, claim_type: 'pollution', status: 'pending',
          estimated_income_loss: 800, payout_amount: 0,
          disruption_start: '2026-03-01T08:00:00Z', disruption_end: '2026-03-01T12:00:00Z',
          created_at: '2026-03-01T14:00:00Z', gps_verified: true, device_verified: false, fraud_score: 0.65,
        },
      ],
    };
  }
}
