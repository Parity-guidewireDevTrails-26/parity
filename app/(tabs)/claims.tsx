import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { CircleCheck as CheckCircle2, Clock, CloudRain, Wind, Zap, Thermometer } from 'lucide-react-native';
import { ApiService, Claim, User } from '@/services/api';

const C = {
  bgPrimary: '#F5F5F7', bgCard: '#FFFFFF',
  txt1: '#1C1C1E', txt2: '#6E6E73', txt3: '#AEAEB2',
  green: '#22C55E', amber: '#F59E0B', red: '#EF4444', border: '#E5E5EA',
};

const getStatus = (s: string) => ({
  paid:     { color: C.green,  label: 'PAID' },
  verified: { color: '#3B82F6', label: 'VERIFIED' },
  pending:  { color: C.amber,  label: 'PENDING' },
  rejected: { color: C.red,    label: 'REJECTED' },
}[s] ?? { color: C.txt3, label: s.toUpperCase() });

const EVENT_ICON: Record<string, any> = {
  rainfall: CloudRain, pollution: Wind, heat: Thermometer, auto: Zap, manual: Clock,
};

export default function ClaimsScreen() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClaims = async () => {
    try {
      const p = await ApiService.getProfile();
      const d = await ApiService.getClaims(p.user.id);
      setClaims(d.claims);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchClaims(); }, []);

  const totalPaid = claims.filter(c => c.status === 'paid').reduce((s, c) => s + c.payout_amount, 0);

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={C.green} />
      <Text style={styles.loaderText}>Loading claims…</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClaims(); }} tintColor={C.green} />}>

      <View style={styles.header}>
        <Text style={styles.title}>Claims History</Text>
        <Text style={styles.subtitle}>Zero-touch automated payouts</Text>
      </View>

      {/* Summary */}
      {claims.length > 0 && (
        <View style={styles.summaryRow}>
          {[
            { label: 'Total Paid', value: `₹${totalPaid.toFixed(0)}` },
            { label: 'Paid', value: `${claims.filter(c => c.status === 'paid').length}` },
            { label: 'Pending', value: `${claims.filter(c => c.status === 'pending').length}` },
          ].map(s => (
            <View key={s.label} style={styles.summaryChip}>
              <Text style={styles.summaryValue}>{s.value}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty state */}
      {claims.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <CheckCircle2 size={40} color={C.txt3} />
          </View>
          <Text style={styles.emptyTitle}>No Claims Yet</Text>
          <Text style={styles.emptyText}>
            When a parametric disruption triggers in your zone, claims auto-appear here. No action needed.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {claims.map(claim => {
            const st = getStatus(claim.status);
            const Icon = EVENT_ICON[claim.claim_type] ?? Zap;
            return (
              <View key={claim.id} style={styles.card}>
                {/* Card header */}
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: st.color + '14' }]}>
                    <Icon size={18} color={st.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {claim.claim_type === 'auto' ? '⚡ Auto-Trigger' : '📋 Manual'} Claim
                    </Text>
                    <Text style={styles.cardDate}>
                      {new Date(claim.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.color + '16' }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Disruption Window</Text>
                    <Text style={styles.detailValue}>
                      {new Date(claim.disruption_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} → {new Date(claim.disruption_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Est. Loss</Text>
                    <Text style={styles.detailValue}>₹{claim.estimated_income_loss.toFixed(0)}</Text>
                  </View>

                  {/* Fraud signals */}
                  <View style={styles.signalRow}>
                    {[
                      { label: 'GPS', ok: claim.gps_verified },
                      { label: 'Device', ok: claim.device_verified },
                      { label: `Fraud: ${claim.fraud_score.toFixed(2)}`, ok: claim.fraud_score < 0.5 },
                    ].map(sig => (
                      <View key={sig.label} style={styles.signal}>
                        <View style={[styles.signalDot, { backgroundColor: sig.ok ? C.green : C.red }]} />
                        <Text style={styles.signalLabel}>{sig.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.payoutRow}>
                  <Text style={styles.payoutLabel}>Payout</Text>
                  <Text style={[styles.payoutAmount, { color: st.color }]}>₹{claim.payout_amount.toFixed(0)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>About Zero-Touch Claims</Text>
        <Text style={styles.infoText}>
          Parity verifies your GPS location and device integrity before processing any payout. No forms. No waiting. Funds arrive via UPI in minutes.
        </Text>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const SHADOW = { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgPrimary, gap: 10 },
  loaderText: { color: C.txt2, fontSize: 14 },
  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  title: { fontSize: 30, fontWeight: '800', color: C.txt1, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.txt2 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 18 },
  summaryChip: { flex: 1, backgroundColor: C.bgCard, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, ...SHADOW },
  summaryValue: { fontSize: 18, fontWeight: '800', color: C.txt1 },
  summaryLabel: { fontSize: 10, color: C.txt3, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 48 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.bgCard, justifyContent: 'center', alignItems: 'center', marginBottom: 18, ...SHADOW },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.txt1, marginBottom: 10 },
  emptyText: { fontSize: 13, color: C.txt2, textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 20, gap: 14, marginBottom: 20 },
  card: { backgroundColor: C.bgCard, borderRadius: 18, padding: 18, ...SHADOW },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.txt1, marginBottom: 2 },
  cardDate: { fontSize: 11, color: C.txt3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardDetails: { gap: 8, marginBottom: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: C.txt2 },
  detailValue: { fontSize: 13, color: C.txt1, fontWeight: '600' },
  signalRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  signalDot: { width: 7, height: 7, borderRadius: 4 },
  signalLabel: { fontSize: 11, color: C.txt3 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 14 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payoutLabel: { fontSize: 14, fontWeight: '700', color: C.txt1 },
  payoutAmount: { fontSize: 24, fontWeight: '800' },
  infoCard: { backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: 16, padding: 18, ...SHADOW },
  infoTitle: { fontSize: 14, fontWeight: '700', color: C.txt1, marginBottom: 8 },
  infoText: { fontSize: 13, color: C.txt2, lineHeight: 20 },
});
