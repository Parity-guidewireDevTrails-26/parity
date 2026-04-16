import { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Shield, MapPin, Bell, TrendingUp, Zap, Users, CloudRain, Wind, Sun,
} from 'lucide-react-native';
import { ApiService, User } from '@/services/api';
import { supabase } from '@/utils/supabase';
import { C, FONT, RADIUS, SHADOW } from '@/utils/theme';

const isSupabaseConfigured =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_KEY;

const { width } = Dimensions.get('window');
const RADAR_SIZE = 190;

// ── FEATURE 3: Zone Community Feed (synthetic but realistic) ──────────────
const ZONE_FEED = [
  {
    id: 'z1',
    zone: 'Saket',
    event: 'Heavy Rainfall — 47mm',
    riders: 38,
    payout: '₹13,300',
    type: 'rain',
    hoursAgo: 2,
  },
  {
    id: 'z2',
    zone: 'Malviya Nagar',
    event: 'Traffic Collapse — NH48',
    riders: 21,
    payout: '₹5,880',
    type: 'traffic',
    hoursAgo: 5,
  },
  {
    id: 'z3',
    zone: 'Hauz Khas',
    event: 'AQI Spike — 418',
    riders: 14,
    payout: '₹3,920',
    type: 'pollution',
    hoursAgo: 11,
  },
];

const ZONE_ICON: Record<string, any> = {
  rain:      CloudRain,
  traffic:   Wind,
  pollution: Sun,
};

const MOCK_DISRUPTION = {
  title: 'Extreme Rainfall (45mm) Detected in Saket',
  message: 'Your income protection has been automatically initiated.',
  payout: 350,
};

export default function DashboardScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disruption, setDisruption] = useState<null | typeof MOCK_DISRUPTION>(null);
  const [payoutReady, setPayoutReady] = useState(false);
  const [expandZoneFeed, setExpandZoneFeed] = useState(false);

  const ring1 = useRef(new Animated.Value(0.6)).current;
  const ring2 = useRef(new Animated.Value(0.35)).current;
  const ring3 = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number, low: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(val, { toValue: low, duration: 2200, useNativeDriver: true }),
        ])
      ).start();
    pulse(ring1, 0, 0.6);
    pulse(ring2, 500, 0.35);
    pulse(ring3, 1000, 0.15);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [profile, policy] = await Promise.all([
        ApiService.getProfile(),
        ApiService.getActivePolicy().catch(() => ({ active_policy: null })),
      ]);
      setUser(profile.user);
      setActivePolicy(policy.active_policy);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setTimeout(() => setLoading(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    const userZone = user.work_zone || 'DEL-SAKET-01';
    try {
      const channel = supabase
        .channel('disruption-alerts')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'parametric_events' },
          (payload: any) => {
            const e = payload.new;
            if (e.zone === userZone && e.severity > e.threshold && e.is_active) {
              const label =
                e.event_type === 'HEAVY_RAIN'
                  ? `Heavy Rainfall (${e.severity?.toFixed(0)}mm) in ${e.zone}`
                  : e.event_type === 'HEAT_WAVE'
                  ? `Heat Wave (${e.severity?.toFixed(0)}C) in ${e.zone}`
                  : `Disruption Event in ${e.zone}`;
              setDisruption({
                title: label,
                message: 'Your income protection has been automatically initiated.',
                payout: Math.round(350 + Math.random() * 150),
              });
              setPayoutReady(false);
              setTimeout(() => setPayoutReady(true), 3000);
            }
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch (e) {
      console.warn('Supabase Realtime failed:', e);
    }
  }, [user]);

  const simulateDisruption = () => {
    if (!activePolicy) {
      alert('You must purchase a plan first.');
      return;
    }
    setDisruption(MOCK_DISRUPTION);
    setPayoutReady(false);
    setTimeout(() => setPayoutReady(true), 3000);
  };

  const dismissDisruption = () => {
    setDisruption(null);
    setPayoutReady(false);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={styles.loaderText}>Loading your protection...</Text>
      </View>
    );
  }

  const visibleFeed = expandZoneFeed ? ZONE_FEED : ZONE_FEED.slice(0, 2);

  return (
    <View style={{ flex: 1, backgroundColor: C.bgPrimary }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDashboardData(); }}
            tintColor={C.green}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.name}>{user?.name ?? 'Rider'}</Text>
          </View>
          <View style={[styles.shieldBadge, { backgroundColor: activePolicy ? C.greenBg : C.bgCard }]}>
            <Shield size={20} color={activePolicy ? C.green : C.txt3} />
          </View>
        </View>

        {/* ── Radar ── */}
        <View style={styles.radarSection}>
          <View style={styles.radarContainer}>
            {[ring3, ring2, ring1].map((val, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.radarRing,
                  {
                    width: RADAR_SIZE - i * 44,
                    height: RADAR_SIZE - i * 44,
                    borderRadius: (RADAR_SIZE - i * 44) / 2,
                    opacity: val,
                  },
                ]}
              />
            ))}
            <View style={styles.radarCore}>
              <Shield size={28} color={C.green} />
            </View>
          </View>
          <Text style={styles.radarLabel}>Monitoring Active</Text>
          <View style={styles.zonePill}>
            <MapPin size={11} color={C.txt3} />
            <Text style={styles.zoneText}>{user?.work_zone ?? 'Set your zone in Profile'}</Text>
          </View>
        </View>

        {/* ── Earnings Protected Card ── */}
        {activePolicy ? (
          <View style={styles.incomeCard}>
            <View style={styles.incomeCardTop}>
              <View>
                <Text style={styles.sectionLabel}>EARNINGS PROTECTED</Text>
                <Text style={styles.incomeAmount}>
                  Rs.{(activePolicy.coverage_limit ?? 0).toLocaleString()}
                </Text>
                <Text style={styles.incomeMeta}>
                  {activePolicy.policy_name || 'Policy'} Plan
                </Text>
              </View>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>Active</Text>
              </View>
            </View>

            <View style={styles.incomeDivider} />

            <View style={styles.incomeMetrics}>
              {[
                { label: 'MATCH RATE', value: `${((activePolicy.payout_rate ?? 0.20) * 100).toFixed(0)}%` },
                { label: 'DURATION', value: `${activePolicy.duration_days ?? 7} Days` },
                { label: 'PAYOUT', value: 'Instant' },
              ].map((m, i, arr) => (
                <View key={m.label} style={{ flexDirection: 'row', flex: 1 }}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>{m.label}</Text>
                    <Text style={styles.metricValue}>{m.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.metricDivider} />}
                </View>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 8 }]}>WEEKLY CYCLE</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '65%' }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressTxt}>Mon</Text>
              <Text style={styles.progressTxt}>Premium renews Sunday</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noProtCard}>
            <Shield size={36} color={C.txt3} />
            <Text style={styles.noProtTitle}>No Active Plan</Text>
            <Text style={styles.noProtSub}>Get covered from income loss today.</Text>
            <TouchableOpacity
              style={styles.noProtBtn}
              onPress={() => router.push('/(tabs)/policies')}
            >
              <Text style={styles.noProtBtnText}>View Plans</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { Icon: TrendingUp, value: 'Rs.0', label: 'Total Received', color: C.amber },
            { Icon: Shield,     value: '0',    label: 'Protected Days', color: C.green },
            { Icon: Zap,        value: '0',    label: 'Auto-Claims',    color: C.blue  },
          ].map(s => (
            <View key={s.label} style={styles.statChip}>
              <s.Icon size={16} color={s.color} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── FEATURE 3: Zone Community Feed ── */}
        <View style={styles.feedSection}>
          <View style={styles.feedHeaderRow}>
            <View>
              <Text style={styles.feedTitle}>Zone Activity</Text>
              <Text style={styles.feedSub}>
                Recent disruptions in your region
              </Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          {visibleFeed.map(item => {
            const Icon = ZONE_ICON[item.type] ?? Zap;
            return (
              <View key={item.id} style={styles.feedCard}>
                <View style={styles.feedIconWrap}>
                  <Icon size={16} color={C.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedEventTitle}>{item.event}</Text>
                  <Text style={styles.feedZone}>{item.zone}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.feedRiders}>
                    <Users size={10} color={C.txt3} /> {item.riders} riders
                  </Text>
                  <Text style={styles.feedAmt}>{item.payout} paid</Text>
                  <Text style={styles.feedTime}>{item.hoursAgo}h ago</Text>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.feedToggle}
            onPress={() => setExpandZoneFeed(v => !v)}
          >
            <Text style={styles.feedToggleText}>
              {expandZoneFeed ? 'Show less' : 'View all zone activity'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Simulate Disruption ── */}
        <TouchableOpacity
          style={[styles.simulateBtn, !activePolicy && { opacity: 0.4 }]}
          onPress={simulateDisruption}
          activeOpacity={0.7}
        >
          <Bell size={16} color={C.txt2} />
          <Text style={styles.simulateBtnText}>Simulate Disruption Event</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Disruption Alert Banner ── */}
      {disruption && (
        <View style={styles.alertBanner}>
          <View style={styles.alertAccent} />
          <View style={styles.alertBody}>
            <View style={styles.alertTopRow}>
              <Text style={styles.alertTitle}>{disruption.title}</Text>
              <TouchableOpacity onPress={dismissDisruption}>
                <Text style={styles.alertDismiss}>Dismiss</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.alertMsg}>{disruption.message}</Text>

            {payoutReady ? (
              <View style={styles.alertPayoutBox}>
                <View>
                  <Text style={styles.alertPayoutLabel}>Zero-Touch Verified</Text>
                  <Text style={styles.alertPayoutSub}>Sent automatically via UPI</Text>
                </View>
                <Text style={styles.alertPayoutAmt}>Rs.{disruption.payout}</Text>
              </View>
            ) : (
              <View style={styles.alertProcessingRow}>
                <ActivityIndicator size="small" color={C.green} />
                <Text style={styles.alertProcessingText}>
                  Verifying device location and fraud signals...
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  loader: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.bgPrimary, gap: 12,
  },
  loaderText: { color: C.txt2, fontSize: FONT.sm, fontWeight: FONT.medium },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 8,
  },
  greeting: { fontSize: FONT.sm, color: C.txt3, fontWeight: FONT.medium, marginBottom: 2 },
  name: { fontSize: FONT.xl, fontWeight: FONT.heavy, color: C.txt1, letterSpacing: FONT.tight },
  shieldBadge: {
    width: 44, height: 44, borderRadius: RADIUS.full,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    ...SHADOW.sm,
  },

  // Radar
  radarSection: { alignItems: 'center', paddingVertical: 28 },
  radarContainer: { width: RADAR_SIZE, height: RADAR_SIZE, alignItems: 'center', justifyContent: 'center' },
  radarRing: {
    position: 'absolute', borderWidth: 1.5, borderColor: C.green,
    backgroundColor: C.greenBg,
  },
  radarCore: {
    width: 68, height: 68, borderRadius: RADIUS.full,
    backgroundColor: C.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    ...SHADOW.md,
  },
  radarLabel: {
    fontSize: FONT.sm, fontWeight: FONT.semibold, color: C.txt2,
    marginTop: 18, marginBottom: 6, letterSpacing: FONT.normal,
  },
  zonePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  zoneText: { fontSize: FONT.xs, color: C.txt3 },

  // Section label
  sectionLabel: {
    fontSize: FONT.xs, fontWeight: FONT.bold, color: C.txt3,
    letterSpacing: FONT.wider, textTransform: 'uppercase',
  },

  // Income card
  incomeCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: RADIUS.xl,
    padding: 22, marginBottom: 14, borderWidth: 1, borderColor: C.border,
    ...SHADOW.md,
  },
  incomeCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 4,
  },
  incomeAmount: {
    fontSize: FONT.hero, fontWeight: FONT.heavy, color: C.txt1,
    letterSpacing: FONT.tight, marginTop: 4, marginBottom: 2,
  },
  incomeMeta: { fontSize: FONT.sm, color: C.txt3, marginTop: 2 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.greenBg, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  activeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.green,
  },
  activePillText: { fontSize: FONT.xs, fontWeight: FONT.bold, color: C.green },
  incomeDivider: { height: 1, backgroundColor: C.border, marginVertical: 18 },
  incomeMetrics: { flexDirection: 'row', alignItems: 'center' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricLabel: {
    fontSize: FONT.xs, color: C.txt3, fontWeight: FONT.bold,
    letterSpacing: FONT.wide, textTransform: 'uppercase', marginBottom: 4,
  },
  metricValue: { fontSize: FONT.md, fontWeight: FONT.heavy, color: C.txt1 },
  metricDivider: { width: 1, height: 28, backgroundColor: C.border },
  progressTrack: {
    height: 4, backgroundColor: C.bgSubtle, borderRadius: 2,
    overflow: 'hidden', borderWidth: 1, borderColor: C.border,
  },
  progressFill: { height: '100%', backgroundColor: C.amber, borderRadius: 2 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  progressTxt: { fontSize: FONT.xs, color: C.txt3 },

  // No protection
  noProtCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: RADIUS.xl,
    padding: 32, alignItems: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  noProtTitle: {
    fontSize: FONT.md, fontWeight: FONT.bold, color: C.txt1, marginTop: 16, marginBottom: 6,
  },
  noProtSub: { fontSize: FONT.sm, color: C.txt2, textAlign: 'center', marginBottom: 20 },
  noProtBtn: {
    backgroundColor: C.brand, borderRadius: RADIUS.md,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  noProtBtnText: { color: '#fff', fontWeight: FONT.bold, fontSize: FONT.sm },

  // Stats row
  statsRow: {
    flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 20,
  },
  statChip: {
    flex: 1, backgroundColor: C.bgCard, borderRadius: RADIUS.lg,
    padding: 14, alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  statValue: { fontSize: FONT.md, fontWeight: FONT.heavy, color: C.txt1 },
  statLabel: {
    fontSize: 10, color: C.txt3, fontWeight: FONT.semibold,
    textAlign: 'center', letterSpacing: 0.3,
  },

  // FEATURE 3 — Zone Feed
  feedSection: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: C.bgCard, borderRadius: RADIUS.xl,
    padding: 20, borderWidth: 1, borderColor: C.border, ...SHADOW.md,
  },
  feedHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  feedTitle: {
    fontSize: FONT.base, fontWeight: FONT.bold, color: C.txt1, marginBottom: 2,
  },
  feedSub: { fontSize: FONT.xs, color: C.txt3 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.greenBg, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: C.green,
  },
  liveText: { fontSize: FONT.xs, color: C.green, fontWeight: FONT.bold },
  feedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  feedIconWrap: {
    width: 34, height: 34, borderRadius: RADIUS.md,
    backgroundColor: C.bgSubtle, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  feedEventTitle: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: C.txt1, marginBottom: 2 },
  feedZone: { fontSize: FONT.xs, color: C.txt3 },
  feedRiders: { fontSize: FONT.xs, color: C.txt3, marginBottom: 2 },
  feedAmt: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.green },
  feedTime: { fontSize: FONT.xs, color: C.txt3, marginTop: 2 },
  feedToggle: { paddingTop: 12, alignItems: 'center' },
  feedToggleText: {
    fontSize: FONT.sm, color: C.blue, fontWeight: FONT.semibold,
  },

  // Simulate
  simulateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: 20, paddingVertical: 15, borderRadius: RADIUS.lg,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  simulateBtnText: { color: C.txt2, fontSize: FONT.sm, fontWeight: FONT.semibold },

  // Alert Banner
  alertBanner: {
    position: 'absolute', bottom: 92, left: 16, right: 16,
    backgroundColor: C.bgCard, borderRadius: RADIUS.xl,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, ...SHADOW.lg,
  },
  alertAccent: { width: 4, backgroundColor: C.green },
  alertBody: { flex: 1, padding: 16 },
  alertTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  alertTitle: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, flex: 1, paddingRight: 8 },
  alertDismiss: { fontSize: FONT.sm, color: C.txt3 },
  alertMsg: { fontSize: FONT.xs, color: C.txt2, marginBottom: 12 },
  alertPayoutBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.greenBg, borderRadius: RADIUS.md, padding: 12,
  },
  alertPayoutLabel: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, marginBottom: 2 },
  alertPayoutSub: { fontSize: FONT.xs, color: C.green },
  alertPayoutAmt: { fontSize: FONT.xl, fontWeight: FONT.heavy, color: C.green },
  alertProcessingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertProcessingText: { fontSize: FONT.xs, color: C.txt2, flex: 1 },
});
