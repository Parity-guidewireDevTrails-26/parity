import { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, MapPin, Bell, TrendingUp, Zap, Check } from 'lucide-react-native';
import { ApiService, User } from '@/services/api';

const { width } = Dimensions.get('window');
const RADAR_SIZE = 200;

const MOCK_DISRUPTION = {
  title: '⛈ Extreme rainfall (45mm) detected in Saket',
  message: 'Your income protection has been automatically initiated.',
  payout: 350,
};

// ── Design Tokens ─────────────────────────────────────────────
const C = {
  bgPrimary: '#F5F5F7',
  bgCard:    '#FFFFFF',
  txt1:      '#1C1C1E',   // headings
  txt2:      '#6E6E73',   // labels
  txt3:      '#AEAEB2',   // hints
  green:     '#22C55E',   // active / success
  amber:     '#F59E0B',   // payouts / progress
  border:    '#E5E5EA',
};

export default function DashboardScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disruption, setDisruption] = useState<null | typeof MOCK_DISRUPTION>(null);
  const [payoutReady, setPayoutReady] = useState(false);

  // Radar pulse rings
  const ring1 = useRef(new Animated.Value(0.7)).current;
  const ring2 = useRef(new Animated.Value(0.5)).current;
  const ring3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(val, { toValue: val === ring1 ? 0.7 : val === ring2 ? 0.5 : 0.3, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    pulse(ring1, 0);
    pulse(ring2, 400);
    pulse(ring3, 800);
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

  useEffect(() => { fetchDashboardData(); }, []);

  const simulateDisruption = () => {
    if (!activePolicy) {
      alert('You must purchase a plan first!');
      return;
    }
    setDisruption(MOCK_DISRUPTION);
    setPayoutReady(false);
    
    // Simulate Background Fraud Check + Zero Touch Payout
    setTimeout(() => setPayoutReady(true), 3000); // 3 seconds of "verifying device GPS"
  };

  // Auto-trigger the disruption for Demo purposes if they bought a plan
  useEffect(() => {
    if (activePolicy && !loading) {
      const timer = setTimeout(() => {
        simulateDisruption();
      }, 4000); // Trigger 4 seconds after landing on the dashboard
      return () => clearTimeout(timer);
    }
  }, [activePolicy, loading]);

  const dismissDisruption = () => {
    setDisruption(null);
    setPayoutReady(false);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={styles.loaderText}>Loading your protection…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bgPrimary }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} tintColor={C.green} />}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.name}>{user?.name ?? 'Rider'}</Text>
          </View>
          <View style={styles.shieldBadge}>
            <Shield size={22} color={activePolicy ? C.green : C.txt3} />
          </View>
        </View>

        {/* ── Radar ── */}
        <View style={styles.radarSection}>
          <View style={styles.radarContainer}>
            {/* Three concentric pulsing rings */}
            {[ring3, ring2, ring1].map((val, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.radarRing,
                  {
                    width: RADAR_SIZE - i * 40,
                    height: RADAR_SIZE - i * 40,
                    borderRadius: (RADAR_SIZE - i * 40) / 2,
                    opacity: val,
                  },
                ]}
              />
            ))}
            {/* Core circle */}
            <View style={styles.radarCore}>
              <Shield size={32} color={C.green} />
            </View>
          </View>
          <Text style={styles.radarLabel}>Monitoring Active</Text>
          <View style={styles.zonePill}>
            <MapPin size={12} color={C.txt3} />
            <Text style={styles.zoneText}>{user?.work_zone ?? 'Set your zone in Profile'}</Text>
          </View>
        </View>

        {/* ── Income Protection Card ── */}
        {activePolicy ? (
          <View style={styles.incomeCard}>
            <View style={styles.incomeCardTop}>
              <View>
                <Text style={styles.incomeLabel}>EARNINGS PROTECTED</Text>
                <Text style={styles.incomeAmount}>₹{activePolicy.coverage_limit.toLocaleString()}</Text>
                <Text style={styles.incomeMeta}>{activePolicy.policy_name} Plan · Active</Text>
              </View>
              <View style={[styles.activePill, { backgroundColor: C.green + '18' }]}>
                <View style={[styles.activeDot, { backgroundColor: C.green }]} />
                <Text style={[styles.activePillText, { color: C.green }]}>ON</Text>
              </View>
            </View>

            {/* Weekly progress bar */}
            <Text style={styles.progressLabel}>Weekly Cycle</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '65%' }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressStart}>Mon</Text>
              <Text style={styles.progressEnd}>Premium renews Sunday</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noProtCard}>
            <Shield size={40} color={C.txt3} />
            <Text style={styles.noProtTitle}>No Active Plan</Text>
            <Text style={styles.noProtSub}>Get covered from income loss today.</Text>
            <TouchableOpacity style={styles.noProtBtn} onPress={() => router.push('/(tabs)/policies')}>
              <Text style={styles.noProtBtnText}>View Plans →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { icon: <TrendingUp size={18} color={C.amber} />, value: '₹0', label: 'Total Paid' },
            { icon: <Shield size={18} color={C.green} />, value: '0', label: 'Protected Days' },
            { icon: <Zap size={18} color={C.txt2} />, value: '0', label: 'Auto-Claims' },
          ].map(s => (
            <View key={s.label} style={styles.statChip}>
              {s.icon}
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Simulate Disruption ── */}
        <TouchableOpacity 
          style={[styles.simulateBtn, !activePolicy && { opacity: 0.5 }]} 
          onPress={simulateDisruption} 
          activeOpacity={0.7}>
          <Bell size={18} color={C.txt2} />
          <Text style={styles.simulateBtnText}>Simulate Disruption Event</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Zero-Touch Disruption Alert (Apple-style banner) ── */}
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
            <Text style={styles.alertEvent}>{disruption.message}</Text>

            {payoutReady ? (
              <View style={[styles.alertPayoutRow, { backgroundColor: C.green + '15', padding: 12, borderRadius: 12, marginTop: 6 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: C.green, borderRadius: 10, padding: 4 }}>
                    <Check size={16} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.alertPayoutLabel}>Zero-Touch Verified</Text>
                    <Text style={{ fontSize: 12, color: C.green, fontWeight: '700' }}>Sent automatically to UPI</Text>
                  </View>
                </View>
                <Text style={[styles.alertPayoutAmount, { color: C.green }]}>₹{disruption.payout}</Text>
              </View>
            ) : (
              <View style={[styles.alertProcessingRow, { marginTop: 6 }]}>
                <ActivityIndicator size="small" color={C.green} />
                <Text style={styles.alertProcessingText}>Verifying device location & fraud signals…</Text>
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgPrimary, gap: 10 },
  loaderText: { color: C.txt2, fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 8,
  },
  greeting: { fontSize: 13, color: C.txt2, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '700', color: C.txt1 },
  shieldBadge: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.bgCard, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },

  // Radar
  radarSection: { alignItems: 'center', paddingVertical: 32 },
  radarContainer: { width: RADAR_SIZE, height: RADAR_SIZE, alignItems: 'center', justifyContent: 'center' },
  radarRing: {
    position: 'absolute', borderWidth: 1, borderColor: C.green,
    backgroundColor: C.green + '08',
  },
  radarCore: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.bgCard, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  radarLabel: { fontSize: 14, fontWeight: '600', color: C.txt2, marginTop: 16, marginBottom: 8 },
  zonePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  zoneText: { fontSize: 12, color: C.txt3 },

  // Income Card
  incomeCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: 20, padding: 22, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  incomeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  incomeLabel: { fontSize: 11, fontWeight: '700', color: C.txt3, letterSpacing: 1, marginBottom: 6 },
  incomeAmount: { fontSize: 40, fontWeight: '800', color: C.txt1 },
  incomeMeta: { fontSize: 13, color: C.txt2, marginTop: 4 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  activePillText: { fontSize: 11, fontWeight: '800' },
  progressLabel: { fontSize: 12, color: C.txt3, marginBottom: 8 },
  progressTrack: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.amber, borderRadius: 3 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressStart: { fontSize: 11, color: C.txt3 },
  progressEnd: { fontSize: 11, color: C.txt3 },

  // No protection
  noProtCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: 20, padding: 32,
    alignItems: 'center', marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  noProtTitle: { fontSize: 18, fontWeight: '700', color: C.txt1, marginTop: 14, marginBottom: 6 },
  noProtSub: { fontSize: 13, color: C.txt2, textAlign: 'center', marginBottom: 20 },
  noProtBtn: { backgroundColor: C.txt1, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  noProtBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 14 },
  statChip: {
    flex: 1, backgroundColor: C.bgCard, borderRadius: 16, padding: 14, alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: C.txt1 },
  statLabel: { fontSize: 10, color: C.txt3, fontWeight: '600', textAlign: 'center' },

  // Simulate
  simulateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: 20, paddingVertical: 16, borderRadius: 14,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
  },
  simulateBtnText: { color: C.txt2, fontSize: 14, fontWeight: '600' },

  // Alert banner — Apple-style, anchored at bottom
  alertBanner: {
    position: 'absolute', bottom: 90, left: 20, right: 20,
    backgroundColor: C.bgCard, borderRadius: 18, flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  alertAccent: { width: 5, backgroundColor: C.green },
  alertBody: { flex: 1, padding: 18 },
  alertTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  alertTitle: { fontSize: 15, fontWeight: '700', color: C.txt1 },
  alertDismiss: { fontSize: 13, color: C.txt2 },
  alertEvent: { fontSize: 13, color: C.txt2, marginBottom: 14 },
  alertPayoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertPayoutLabel: { fontSize: 14, fontWeight: '600', color: C.txt1 },
  alertPayoutAmount: { fontSize: 26, fontWeight: '800', color: C.amber },
  alertProcessingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertProcessingText: { fontSize: 13, color: C.txt2 },
});
