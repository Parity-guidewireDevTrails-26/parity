import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Activity, Map, Cpu, Zap, CheckCircle2, TrendingUp, AlertTriangle,
} from 'lucide-react-native';
import { C, FONT, RADIUS, SHADOW } from '@/utils/theme';

const ZONES = [
  { id: 'DEL-SKT', name: 'Saket',        risk: 'HIGH',   score: 0.82, policies: 45 },
  { id: 'DEL-MLV', name: 'Malviya Nagar', risk: 'MEDIUM', score: 0.45, policies: 112 },
  { id: 'DEL-HKZ', name: 'Hauz Khas',    risk: 'LOW',    score: 0.12, policies: 89 },
];

const RISK_COLOR = { HIGH: C.red, MEDIUM: C.amber, LOW: C.green };
const RISK_BG    = { HIGH: C.redBg, MEDIUM: C.amberBg, LOW: C.greenBg };

// Step 0: Idle | 1: Trigger | 2: ML | 3: Exclusions | 4: Payout
export default function AdminDashboard() {
  const [cycleStep, setCycleStep] = useState(0);
  const [running, setRunning] = useState(false);

  const handleSimulate = () => {
    if (running) return;
    setRunning(true);
    setCycleStep(1);
    setTimeout(() => setCycleStep(2), 2000);
    setTimeout(() => setCycleStep(3), 4500);
    setTimeout(() => setCycleStep(4), 7000);
    setTimeout(() => { setRunning(false); }, 8500);
  };

  const resetSimulator = () => {
    setCycleStep(0);
    setRunning(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.overline}>INSURER DASHBOARD</Text>
          <Text style={styles.title}>Underwriting Desk</Text>
          <Text style={styles.subtitle}>Unified risk operations and intelligence</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: C.blueBg }]}>
          <Activity size={20} color={C.blue} />
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderTopColor: C.blue, borderTopWidth: 3 }]}>
          <Text style={styles.metricLabel}>LOSS RATIO (MTD)</Text>
          <Text style={styles.metricValue}>1.24%</Text>
          <Text style={styles.metricSub}>Gross Premiums: Rs.1.4M</Text>
        </View>
        <View style={[styles.metricCard, { borderTopColor: C.green, borderTopWidth: 3 }]}>
          <Text style={styles.metricLabel}>AUTO PAYOUTS</Text>
          <Text style={styles.metricValue}>842</Text>
          <Text style={styles.metricSub}>98.4% Zero-Touch</Text>
        </View>
      </View>

      {/* Heatmap */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Map size={16} color={C.txt2} />
          <Text style={styles.sectionTitle}>XGBoost Zone Risk Heatmap</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.heatmapNote}>
            <AlertTriangle size={13} color={C.amber} />
            <Text style={styles.heatmapNoteText}>
              Next 7 days: Heavy rainfall probability 88% in South Delhi. Risk multipliers adjusted live.
            </Text>
          </View>

          <View style={{ gap: 14, marginTop: 16 }}>
            {ZONES.map(z => {
              const rColor = RISK_COLOR[z.risk as keyof typeof RISK_COLOR];
              const rBg    = RISK_BG[z.risk as keyof typeof RISK_BG];
              return (
                <View key={z.id} style={styles.zoneRow}>
                  <View style={{ flex: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <Text style={styles.zoneName}>{z.name}</Text>
                      <View style={[styles.riskBadge, { backgroundColor: rBg }]}>
                        <Text style={[styles.riskBadgeText, { color: rColor }]}>{z.risk}</Text>
                      </View>
                    </View>
                    <Text style={styles.zonePol}>{z.policies} policies active</Text>
                  </View>
                  <View style={{ flex: 3 }}>
                    <View style={styles.zoneBarBg}>
                      <View
                        style={[styles.zoneBarFill, {
                          width: `${z.score * 100}%` as any,
                          backgroundColor: rColor,
                        }]}
                      />
                    </View>
                    <Text style={[styles.zoneScore, { color: rColor }]}>
                      {(z.score * 100).toFixed(0)}% risk
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Event Simulator */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Cpu size={16} color={C.txt2} />
          <Text style={styles.sectionTitle}>End-to-End Event Simulator</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            Trigger a parametric disruption to demonstrate the full automated cycle: detection, fraud gating, legal exclusion check, and UPI payout dispatch.
          </Text>

          {cycleStep === 0 && (
            <TouchableOpacity style={styles.triggerBtn} onPress={handleSimulate}>
              <Zap size={16} color="#fff" />
              <Text style={styles.triggerBtnText}>Simulate 45mm Rainfall in Saket</Text>
            </TouchableOpacity>
          )}

          {cycleStep > 0 && (
            <View style={styles.loopContainer}>
              <LoopItem
                step={1} current={cycleStep}
                title="IoT Gateway Triggered"
                desc="Detected 47mm rainfall in Saket zone — threshold exceeded."
              />
              <LoopConnector done={cycleStep > 1} />
              <LoopItem
                step={2} current={cycleStep}
                title="Gatekeeper Fraud Layer"
                desc="Running XGBoost spoofing checks, speed anomaly detection, and device binding."
              />
              <LoopConnector done={cycleStep > 2} />
              <LoopItem
                step={3} current={cycleStep}
                title="Legal Exclusions Check"
                desc="Verifying against [War, Pandemic, Terrorism, Nuclear] — all clear."
              />
              <LoopConnector done={cycleStep > 3} />
              <LoopItem
                step={4} current={cycleStep}
                title="Razorpay Sandbox Payouts"
                desc="Routing Rs.15,750 aggregate to 45 worker wallets via UPI."
              />

              {cycleStep === 4 && !running && (
                <View style={styles.loopResult}>
                  <CheckCircle2 size={16} color={C.green} />
                  <Text style={styles.loopResultText}>
                    Cycle complete — 45 workers paid in under 8 seconds.
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.resetBtn} onPress={resetSimulator}>
                <Text style={styles.resetBtnText}>Reset Simulator</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Platform Health */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingUp size={16} color={C.txt2} />
          <Text style={styles.sectionTitle}>Platform Health</Text>
        </View>
        <View style={styles.card}>
          {[
            { label: 'Active Workers', value: '2,847', sub: '+14% MoM' },
            { label: 'Avg. Fraud Score', value: '0.07', sub: 'Well below 0.5 threshold' },
            { label: 'Claim Settlement', value: '< 3 min', sub: 'Median time to UPI' },
            { label: 'ML Model Accuracy', value: '94.2%', sub: 'XGBoost v2.1 on OWM data' },
          ].map((m, i, arr) => (
            <View key={m.label}>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>{m.label}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.healthValue}>{m.value}</Text>
                  <Text style={styles.healthSub}>{m.sub}</Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function LoopConnector({ done }: { done: boolean }) {
  return (
    <View style={styles.connectorWrap}>
      <View style={[styles.connector, { backgroundColor: done ? C.green : C.border }]} />
    </View>
  );
}

function LoopItem({
  step, current, title, desc,
}: {
  step: number; current: number; title: string; desc: string;
}) {
  const done   = current > step;
  const active = current === step;
  const color  = done ? C.green : active ? C.amber : C.txt3;
  const bg     = done ? C.greenBg : active ? C.amberBg : C.bgSubtle;

  return (
    <View style={styles.loopRow}>
      <View style={[styles.loopIconWrap, { backgroundColor: bg, borderColor: done ? '#A7F3D0' : active ? '#FDE68A' : C.border }]}>
        {done
          ? <CheckCircle2 size={16} color={C.green} />
          : active
          ? <ActivityIndicator size="small" color={C.amber} />
          : <View style={[styles.loopDot, { backgroundColor: C.border }]} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.loopTitle, { color: done || active ? C.txt1 : C.txt3 }]}>
          {title}
        </Text>
        <Text style={[styles.loopDesc, { color: done || active ? C.txt2 : C.txt3 }]}>
          {desc}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },

  header: {
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 10,
    backgroundColor: C.bgCard,
  },
  overline: {
    fontSize: FONT.xs, fontWeight: FONT.bold, color: C.txt3,
    letterSpacing: FONT.wider, marginBottom: 4,
  },
  title: {
    fontSize: FONT.xl, fontWeight: FONT.heavy, color: C.txt1,
    letterSpacing: FONT.tight, marginBottom: 4,
  },
  subtitle: { fontSize: FONT.sm, color: C.txt3 },
  headerIcon: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  metricsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 14, marginVertical: 20 },
  metricCard: {
    flex: 1, backgroundColor: C.bgCard, borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  metricLabel: {
    fontSize: FONT.xs, color: C.txt3, fontWeight: FONT.bold,
    letterSpacing: FONT.wide, marginBottom: 8, textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: FONT.xl, color: C.txt1, fontWeight: FONT.heavy,
    letterSpacing: FONT.tight, marginBottom: 4,
  },
  metricSub: { fontSize: FONT.xs, color: C.txt3 },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FONT.sm, color: C.txt2, fontWeight: FONT.bold,
    letterSpacing: FONT.wide, textTransform: 'uppercase',
  },
  card: {
    backgroundColor: C.bgCard, borderRadius: RADIUS.lg, padding: 20,
    borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  cardDesc: { fontSize: FONT.sm, color: C.txt2, lineHeight: 20, marginBottom: 18 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  // Heatmap
  heatmapNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.amberBg, borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  heatmapNoteText: { fontSize: FONT.xs, color: C.amber, flex: 1, lineHeight: 17 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneName: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1 },
  zonePol: { fontSize: FONT.xs, color: C.txt3 },
  riskBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  riskBadgeText: { fontSize: 10, fontWeight: FONT.heavy },
  zoneBarBg: {
    height: 6, backgroundColor: C.bgSubtle, borderRadius: 3,
    overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 4,
  },
  zoneBarFill: { height: '100%', borderRadius: 3 },
  zoneScore: { fontSize: FONT.xs, fontWeight: FONT.bold },

  // Simulator loop
  triggerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.brand, paddingVertical: 14, borderRadius: RADIUS.md,
  },
  triggerBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: FONT.bold },
  loopContainer: { gap: 0 },
  loopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  loopIconWrap: {
    width: 32, height: 32, borderRadius: RADIUS.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  loopDot: { width: 8, height: 8, borderRadius: 4 },
  loopTitle: { fontSize: FONT.sm, fontWeight: FONT.bold, marginBottom: 2 },
  loopDesc: { fontSize: FONT.xs, lineHeight: 18 },
  connectorWrap: { paddingLeft: 15, paddingVertical: 4 },
  connector: { width: 1.5, height: 20 },
  loopResult: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.greenBg, borderRadius: RADIUS.md, padding: 12,
    marginTop: 14, borderWidth: 1, borderColor: '#A7F3D0',
  },
  loopResultText: { fontSize: FONT.sm, color: C.green, fontWeight: FONT.semibold, flex: 1 },
  resetBtn: {
    marginTop: 14, paddingVertical: 10, alignItems: 'center',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border,
  },
  resetBtnText: { fontSize: FONT.sm, color: C.txt2, fontWeight: FONT.semibold },

  // Health
  healthRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  healthLabel: { fontSize: FONT.sm, color: C.txt2 },
  healthValue: { fontSize: FONT.base, fontWeight: FONT.heavy, color: C.txt1 },
  healthSub: { fontSize: FONT.xs, color: C.txt3, marginTop: 2 },
});
