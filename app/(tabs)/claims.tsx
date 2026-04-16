import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import {
  CheckCircle2, Clock, CloudRain, Wind, Zap, Thermometer,
  ChevronDown, ChevronUp, FileText,
} from 'lucide-react-native';
import { ApiService, Claim } from '@/services/api';
import { C, FONT, RADIUS, SHADOW } from '@/utils/theme';

const getStatus = (s: string) => ({
  paid:     { color: C.green,  bg: C.greenBg, label: 'Paid' },
  verified: { color: C.blue,   bg: C.blueBg,  label: 'Verified' },
  pending:  { color: C.amber,  bg: C.amberBg, label: 'Pending' },
  rejected: { color: C.red,    bg: C.redBg,   label: 'Rejected' },
}[s] ?? { color: C.txt3, bg: C.bgSubtle, label: s });

const EVENT_ICON: Record<string, any> = {
  rainfall: CloudRain,
  pollution: Wind,
  heat: Thermometer,
  auto: Zap,
  manual: Clock,
};

// FEATURE 2: Weekly payslip — computed from claim history
function buildPayslip(claims: Claim[]) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const thisWeek = claims.filter(c => new Date(c.created_at) >= weekStart);
  const paidThisWeek = thisWeek.filter(c => c.status === 'paid');
  const totalProtected = paidThisWeek.reduce((s, c) => s + c.payout_amount, 0);
  const totalLoss = paidThisWeek.reduce((s, c) => s + c.estimated_income_loss, 0);

  // Estimate hours down based on disruption windows
  let hoursDown = 0;
  paidThisWeek.forEach(c => {
    const start = new Date(c.disruption_start).getTime();
    const end   = new Date(c.disruption_end).getTime();
    hoursDown += (end - start) / 3_600_000;
  });

  return {
    eventsCount: paidThisWeek.length,
    totalProtected,
    totalLoss,
    hoursDown: Math.round(hoursDown),
    activeDays: [...new Set(thisWeek.map(c => c.created_at.split('T')[0]))].length,
  };
}

export default function ClaimsScreen() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const ps = buildPayslip(claims);

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={C.green} />
      <Text style={styles.loaderText}>Loading claims...</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchClaims(); }}
          tintColor={C.green}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Claims</Text>
        <Text style={styles.subtitle}>Zero-touch automated payouts</Text>
      </View>

      {/* FEATURE 2 — Weekly Income Report Card */}
      <View style={styles.payslipCard}>
        <View style={styles.payslipHeaderRow}>
          <View style={styles.payslipIconWrap}>
            <FileText size={16} color={C.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.payslipTitle}>Weekly Report</Text>
            <Text style={styles.payslipSub}>Your Parity income record</Text>
          </View>
          <View style={styles.payslipBadge}>
            <Text style={styles.payslipBadgeText}>This Week</Text>
          </View>
        </View>

        <View style={styles.payslipDivider} />

        <View style={styles.payslipGrid}>
          <View style={styles.payslipCell}>
            <Text style={styles.payslipCellValue}>
              {ps.eventsCount > 0 ? `Rs.${ps.totalProtected.toFixed(0)}` : 'Rs.0'}
            </Text>
            <Text style={styles.payslipCellLabel}>Income Protected</Text>
          </View>
          <View style={styles.payslipCellDivider} />
          <View style={styles.payslipCell}>
            <Text style={styles.payslipCellValue}>{ps.eventsCount}</Text>
            <Text style={styles.payslipCellLabel}>Disruptions Covered</Text>
          </View>
          <View style={styles.payslipCellDivider} />
          <View style={styles.payslipCell}>
            <Text style={styles.payslipCellValue}>{ps.activeDays}</Text>
            <Text style={styles.payslipCellLabel}>Active Days</Text>
          </View>
        </View>

        {ps.hoursDown > 0 && (
          <View style={styles.payslipNote}>
            <Text style={styles.payslipNoteText}>
              {ps.hoursDown}h of disruption covered — estimated income loss of Rs.{ps.totalLoss.toFixed(0)} recovered.
            </Text>
          </View>
        )}

        {ps.eventsCount === 0 && (
          <View style={styles.payslipNote}>
            <Text style={styles.payslipNoteText}>
              No disruptions this week. Your earnings are fully active — protection is standing by.
            </Text>
          </View>
        )}
      </View>

      {/* Lifetime Summary Row */}
      {claims.length > 0 && (
        <View style={styles.summaryRow}>
          {[
            { label: 'Total Received', value: `Rs.${totalPaid.toFixed(0)}` },
            { label: 'Paid Claims',    value: `${claims.filter(c => c.status === 'paid').length}` },
            { label: 'Pending',        value: `${claims.filter(c => c.status === 'pending').length}` },
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
            <CheckCircle2 size={32} color={C.txt3} />
          </View>
          <Text style={styles.emptyTitle}>No Claims Yet</Text>
          <Text style={styles.emptyText}>
            When a parametric disruption triggers in your zone, claims auto-appear here. No action needed.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.listSectionLabel}>CLAIM HISTORY</Text>
          {claims.map(claim => {
            const st = getStatus(claim.status);
            const Icon = EVENT_ICON[claim.claim_type] ?? Zap;
            const isExpanded = expandedId === claim.id;
            return (
              <View key={claim.id} style={styles.card}>
                {/* Card header row */}
                <TouchableOpacity
                  style={styles.cardTop}
                  onPress={() => setExpandedId(isExpanded ? null : claim.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: st.bg }]}>
                    <Icon size={16} color={st.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {claim.claim_type === 'auto' ? 'Auto-Trigger Claim' : 'Manual Claim'}
                    </Text>
                    <Text style={styles.cardDate}>
                      {new Date(claim.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                    {isExpanded
                      ? <ChevronUp size={14} color={C.txt3} />
                      : <ChevronDown size={14} color={C.txt3} />}
                  </View>
                </TouchableOpacity>

                {/* Expanded details */}
                {isExpanded && (
                  <View style={styles.cardDetails}>
                    <View style={styles.detailDivider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Disruption Window</Text>
                      <Text style={styles.detailValue}>
                        {new Date(claim.disruption_start).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit',
                        })}{' → '}
                        {new Date(claim.disruption_end).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Estimated Loss</Text>
                      <Text style={styles.detailValue}>
                        Rs.{claim.estimated_income_loss.toFixed(0)}
                      </Text>
                    </View>

                    {/* Fraud signal indicators */}
                    <View style={styles.signalRow}>
                      {[
                        { label: 'GPS', ok: claim.gps_verified },
                        { label: 'Device', ok: claim.device_verified },
                        {
                          label: `Fraud Score: ${claim.fraud_score.toFixed(2)}`,
                          ok: claim.fraud_score < 0.5,
                        },
                      ].map(sig => (
                        <View key={sig.label} style={styles.signalChip}>
                          <View
                            style={[
                              styles.signalDot,
                              { backgroundColor: sig.ok ? C.green : C.red },
                            ]}
                          />
                          <Text style={styles.signalLabel}>{sig.label}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.payoutRow}>
                      <Text style={styles.payoutLabel}>Payout</Text>
                      <Text style={[styles.payoutAmount, { color: st.color }]}>
                        Rs.{claim.payout_amount.toFixed(0)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Always-visible payout footer */}
                {!isExpanded && (
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerPayout}>
                      Rs.{claim.payout_amount.toFixed(0)} payout
                    </Text>
                    <Text style={styles.footerExpand}>Tap for details</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>About Zero-Touch Claims</Text>
        <Text style={styles.infoText}>
          Parity verifies your GPS location and device integrity before processing any payout.
          No forms. No waiting. Funds arrive via UPI in minutes.
        </Text>
      </View>
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  loader: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.bgPrimary, gap: 12,
  },
  loaderText: { color: C.txt2, fontSize: FONT.sm },

  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  title: {
    fontSize: FONT.xxl, fontWeight: FONT.heavy, color: C.txt1,
    letterSpacing: FONT.tight, marginBottom: 4,
  },
  subtitle: { fontSize: FONT.sm, color: C.txt3 },

  // FEATURE 2 — Payslip
  payslipCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 14, borderWidth: 1, borderColor: C.border, ...SHADOW.md,
  },
  payslipHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  payslipIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: C.bgSubtle, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  payslipTitle: { fontSize: FONT.base, fontWeight: FONT.bold, color: C.txt1 },
  payslipSub: { fontSize: FONT.xs, color: C.txt3, marginTop: 2 },
  payslipBadge: {
    backgroundColor: C.blueBg, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  payslipBadgeText: { fontSize: FONT.xs, color: C.blue, fontWeight: FONT.bold },
  payslipDivider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  payslipGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  payslipCell: { flex: 1, alignItems: 'center' },
  payslipCellValue: {
    fontSize: FONT.xl, fontWeight: FONT.heavy, color: C.txt1, marginBottom: 4,
  },
  payslipCellLabel: { fontSize: FONT.xs, color: C.txt3, textAlign: 'center' },
  payslipCellDivider: { width: 1, height: 36, backgroundColor: C.border },
  payslipNote: {
    backgroundColor: C.bgSubtle, borderRadius: RADIUS.md, padding: 12,
    marginTop: 14, borderWidth: 1, borderColor: C.border,
  },
  payslipNoteText: { fontSize: FONT.xs, color: C.txt2, lineHeight: 18 },

  // Lifetime summary
  summaryRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 18,
  },
  summaryChip: {
    flex: 1, backgroundColor: C.bgCard, borderRadius: RADIUS.lg,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  summaryValue: { fontSize: FONT.md, fontWeight: FONT.heavy, color: C.txt1 },
  summaryLabel: { fontSize: 10, color: C.txt3, fontWeight: FONT.semibold, textAlign: 'center' },

  // Empty state
  empty: { alignItems: 'center', padding: 48 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: RADIUS.full,
    backgroundColor: C.bgCard, justifyContent: 'center', alignItems: 'center',
    marginBottom: 18, borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  emptyTitle: {
    fontSize: FONT.md, fontWeight: FONT.bold, color: C.txt1, marginBottom: 10,
  },
  emptyText: { fontSize: FONT.sm, color: C.txt2, textAlign: 'center', lineHeight: 20 },

  // List
  list: { paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  listSectionLabel: {
    fontSize: FONT.xs, fontWeight: FONT.bold, color: C.txt3,
    letterSpacing: FONT.wider, marginBottom: 4,
  },

  // Claim card
  card: {
    backgroundColor: C.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', ...SHADOW.sm,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, marginBottom: 2 },
  cardDate: { fontSize: FONT.xs, color: C.txt3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: FONT.bold },

  // Expanded
  cardDetails: { paddingHorizontal: 16, paddingBottom: 16 },
  detailDivider: { height: 1, backgroundColor: C.border, marginBottom: 14 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: { fontSize: FONT.sm, color: C.txt2 },
  detailValue: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: C.txt1 },
  signalRow: { flexDirection: 'row', gap: 8, marginVertical: 12, flexWrap: 'wrap' },
  signalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.bgSubtle, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: C.border,
  },
  signalDot: { width: 6, height: 6, borderRadius: 3 },
  signalLabel: { fontSize: FONT.xs, color: C.txt2 },
  payoutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  payoutLabel: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1 },
  payoutAmount: { fontSize: FONT.xl, fontWeight: FONT.heavy },

  // Collapsed footer
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  footerPayout: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.green },
  footerExpand: { fontSize: FONT.xs, color: C.txt3 },

  // Info
  infoCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: RADIUS.lg,
    padding: 18, borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  infoTitle: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, marginBottom: 6 },
  infoText: { fontSize: FONT.sm, color: C.txt2, lineHeight: 20 },
});
