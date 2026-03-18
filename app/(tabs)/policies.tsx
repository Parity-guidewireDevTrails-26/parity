import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { ApiService, Policy } from '@/services/api';

const C = {
  bgPrimary: '#F5F5F7',
  bgCard:    '#FFFFFF',
  txt1:      '#1C1C1E',
  txt2:      '#6E6E73',
  txt3:      '#AEAEB2',
  green:     '#22C55E',
  amber:     '#F59E0B',
  border:    '#E5E5EA',
};

const PLAN_META = {
  Silver:   { features: ['Rainfall > 40mm', 'Auto-trigger payouts', 'Weekly settlement', 'Basic fraud shield'] },
  Gold:     { features: ['All Silver features', 'Traffic collapse coverage', 'AQI > 500 protection', 'Priority UPI payout', 'Advanced GPS shield'] },
  Platinum: { features: ['All Gold features', 'Extreme heat > 45°C', 'Section 144 disruption', 'Zero-deductible payouts', 'Claim concierge'] },
};

const SURCHARGES = [
  { label: 'Low Risk', rate: '+₹15', color: C.green },
  { label: 'Medium Risk', rate: '+₹35', color: C.amber },
  { label: 'High Risk', rate: '+₹55', color: '#EF4444' },
];

export default function PoliciesScreen() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => { fetchPolicies(); }, []);

  const fetchPolicies = async () => {
    try {
      const data = await ApiService.getPolicies();
      setPolicies(data.policies);
    } catch {
      Alert.alert('Error', 'Failed to load plans. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (id: string, name: string) => {
    if (name === 'Platinum') {
      Alert.alert(
        '2-Week Waiting Period',
        'Upgrading to Platinum activates a 2-week cooling-off period before the higher coverage limit applies.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => doSubscribe(id) }]
      );
    } else {
      doSubscribe(id);
    }
  };

  const doSubscribe = async (id: string) => {
    setSubscribing(id);
    try {
      await ApiService.subscribeToPlan(id);
      Alert.alert('Protection Active', 'Your weekly income protection is now live.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSubscribing(null); }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={styles.loaderText}>Loading plans…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>Weekly protection · cancel anytime</Text>
      </View>

      {/* Surcharge explainer */}
      <View style={styles.surchargeCard}>
        <Text style={styles.surchargeTitle}>Dynamic Zone Pricing</Text>
        <Text style={styles.surchargeDesc}>Your premium adjusts automatically based on your zone's live risk score.</Text>
        <View style={styles.surchargeRow}>
          {SURCHARGES.map(s => (
            <View key={s.label} style={styles.surchargePill}>
              <Text style={[styles.surchargeRate, { color: s.color }]}>{s.rate}</Text>
              <Text style={styles.surchargeLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Plan cards */}
      <View style={styles.plans}>
        {policies.map((p, i) => {
          const meta = PLAN_META[p.name as keyof typeof PLAN_META] ?? PLAN_META.Silver;
          const isPopular = i === 1;

          return (
            <View key={p.id} style={[styles.planCard, isPopular && styles.planCardPopular]}>
              {/* Popular badge */}
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>POPULAR</Text>
                </View>
              )}

              <View style={styles.planHeaderRow}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planDesc}>{p.description}</Text>
              </View>

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>₹{p.weekly_premium}</Text>
                <Text style={styles.priceUnit}>/week</Text>
              </View>

              {/* Coverage pill */}
              <View style={styles.coveragePill}>
                <Text style={styles.coverageLabel}>Coverage Limit</Text>
                <Text style={[styles.coverageValue, isPopular && { color: C.amber }]}>
                  ₹{p.coverage_limit.toLocaleString()}
                </Text>
              </View>

              {/* Amber underline on popular */}
              {isPopular && <View style={styles.amberUnderline} />}

              {/* Features */}
              <View style={styles.featureList}>
                {meta.features.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Check size={14} color={C.green} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[styles.cta, isPopular && styles.ctaPopular]}
                onPress={() => handleSubscribe(p.id, p.name)}
                disabled={subscribing !== null}>
                {subscribing === p.id
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.ctaText}>Activate Protection</Text>}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* How it works */}
      <View style={styles.how}>
        <Text style={styles.howTitle}>How It Works</Text>
        {[
          ['Subscribe', 'Pick a plan. Premium auto-deducts every Sunday.'],
          ['Background Watch', 'Parity monitors your zone for rain, traffic & pollution 24/7.'],
          ['Zero-Touch Trigger', 'When a disruption threshold is crossed, your claim auto-fires.'],
          ['Instant UPI Payout', 'Funds hit your account within minutes. No paperwork.'],
        ].map(([step, desc]) => (
          <View key={step} style={styles.howRow}>
            <View style={styles.howDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.howStep}>{step}</Text>
              <Text style={styles.howDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgPrimary, gap: 10 },
  loaderText: { color: C.txt2, fontSize: 14 },

  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  title: { fontSize: 30, fontWeight: '800', color: C.txt1, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.txt2 },

  surchargeCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: 18, padding: 18, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  surchargeTitle: { fontSize: 14, fontWeight: '700', color: C.txt1, marginBottom: 4 },
  surchargeDesc: { fontSize: 12, color: C.txt2, marginBottom: 14 },
  surchargeRow: { flexDirection: 'row', gap: 8 },
  surchargePill: { flex: 1, backgroundColor: C.bgPrimary, borderRadius: 12, padding: 10, alignItems: 'center' },
  surchargeRate: { fontSize: 15, fontWeight: '800' },
  surchargeLabel: { fontSize: 10, color: C.txt3, marginTop: 3, textAlign: 'center' },

  plans: { paddingHorizontal: 20, gap: 20, marginBottom: 24 },
  planCard: {
    backgroundColor: C.bgCard, borderRadius: 20, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  planCardPopular: { borderWidth: 2, borderColor: C.amber },
  popularBadge: {
    alignSelf: 'flex-start', backgroundColor: C.amber, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14,
  },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planHeaderRow: { marginBottom: 16 },
  planName: { fontSize: 22, fontWeight: '800', color: C.txt1, marginBottom: 4 },
  planDesc: { fontSize: 12, color: C.txt2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginBottom: 14 },
  priceAmount: { fontSize: 38, fontWeight: '800', color: C.txt1 },
  priceUnit: { fontSize: 15, color: C.txt2 },
  coveragePill: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.bgPrimary, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  coverageLabel: { fontSize: 12, color: C.txt2 },
  coverageValue: { fontSize: 18, fontWeight: '800', color: C.txt1 },
  amberUnderline: { height: 3, backgroundColor: C.amber, borderRadius: 2, marginBottom: 16, width: 40 },
  featureList: { gap: 10, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, color: C.txt2 },
  cta: { backgroundColor: C.txt1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ctaPopular: { backgroundColor: C.txt1 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  how: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: 18, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  howTitle: { fontSize: 16, fontWeight: '700', color: C.txt1, marginBottom: 18 },
  howRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  howDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginTop: 5 },
  howStep: { fontSize: 13, fontWeight: '700', color: C.txt1, marginBottom: 2 },
  howDesc: { fontSize: 12, color: C.txt2, lineHeight: 18 },
});
