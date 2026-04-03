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

// ── Config ──────────────────────────────────────────────────────────────────
// EXPO_PUBLIC_API_URL=https://your-gateway.railway.app in production
// Falls back to localhost for local Go dev server
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

async function apiCall<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export class ApiService {
  private static token: string | null = null;
  private static activePlanId: string | null = null;

  static setToken(t: string) { this.token = t; }
  static getToken() { return this.token; }
  static clearToken() { this.token = null; }

  // ── Auth ──────────────────────────────────────────────────────────────────
  static async register(payload: RegisterPayload) {
    const data = await apiCall<{ token: string; user: { id: string } }>(
      '/api/v1/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
    );
    this.setToken(data.token);
    return { token: data.token, userId: data.user.id };
  }

  static async login(phoneNumber: string, password: string) {
    const data = await apiCall<{ token: string; user: { id: string } }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ phone_number: phoneNumber, password }) },
    );
    this.setToken(data.token);
    return { token: data.token, userId: data.user.id };
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  static async getProfile(): Promise<{ user: User }> {
    if (!this.token) throw new Error('Not authenticated');
    const data = await apiCall<{ user: any }>(
      '/api/v1/users/profile',
      { method: 'GET' },
      this.token,
    );
    const raw = data.user;
    let parsedFingerprint: DeviceFingerprint | null = null;
    try {
      parsedFingerprint = raw.device_fingerprint ? JSON.parse(raw.device_fingerprint) : null;
    } catch { parsedFingerprint = null; }

    return {
      user: {
        id: raw.id,
        name: raw.name,
        phone_number: raw.phone_number,
        platform: raw.platform,
        work_city: raw.work_city,
        work_zone: raw.work_zone ?? '',
        is_verified: raw.is_verified,
        device_fingerprint: parsedFingerprint,
        trust_score: 0.92,              // TODO: read from users table once column added
        zone_cluster_id: 'DEL-SAKET-01',
      } as User,
    };
  }

  static async updateProfile(updates: {
    work_zone?: string; name?: string; platform?: string; work_city?: string;
  }) {
    if (!this.token) throw new Error('Not authenticated');
    await apiCall(
      '/api/v1/users/profile',
      { method: 'PUT', body: JSON.stringify(updates) },
      this.token,
    );
    return { success: true };
  }

  // ── Policies ──────────────────────────────────────────────────────────────
  static async getPolicies(): Promise<{ policies: Policy[] }> {
    const data = await apiCall<{ policies: Policy[] }>('/api/v1/policies');
    return data;
  }

  static async subscribeToPlan(policyId: string): Promise<{ subscription: any }> {
    if (!this.token) throw new Error('Not authenticated');
    const data = await apiCall<{ subscription: any }>(
      '/api/v1/policies/subscribe',
      { method: 'POST', body: JSON.stringify({ policy_id: policyId }) },
      this.token,
    );
    this.activePlanId = policyId;
    return data;
  }

  static async getActivePolicy() {
    if (!this.token) throw new Error('Not authenticated');
    return apiCall<{ active_policy: any }>(
      '/api/v1/policies/active',
      { method: 'GET' },
      this.token,
    );
  }

  // ── Claims ────────────────────────────────────────────────────────────────
  static async getClaims(userId: string): Promise<{ claims: Claim[] }> {
    if (!this.token) throw new Error('Not authenticated');
    return apiCall<{ claims: Claim[] }>(
      `/api/v1/claims/user/${userId}`,
      { method: 'GET' },
      this.token,
    );
  }
}
