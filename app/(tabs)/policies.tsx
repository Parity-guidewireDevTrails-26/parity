import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Check, ChevronDown, ChevronUp, TrendingDown, AlertCircle } from 'lucide-react-native';
import { ApiService, Policy } from '@/services/api';
import { C, FONT, RADIUS, SHADOW } from '@/utils/theme';

const PLAN_META = {
  Silver:   {
    features: [
      'Rainfall above 40mm',
      'Auto-trigger payouts',
      'Weekly settlement cycle',
      'Basic fraud shield',
    ],
  },
  Gold:     {
    features: [
      'All Silver features',
      'Traffic collapse coverage',
      'AQI above 500 protection',
      'Priority UPI payout',
      'Advanced GPS shield',
    ],
  },
  Platinum: {
    features: [
      'All Gold features',
      'Extreme heat above 45C',
      'Section 144 disruption',
      'Zero-deductible payouts',
      'Claim concierge support',
    ],
  },
};

// FEATURE 4: What-If Projection — synthetic disruption data for Saket (realistic)
const WHATIF_EVENTS = [
  { date: 'Apr 10', event: 'Heavy Rainfall — 52mm', estimatedLoss: 420 },
  { date: 'Apr 4',  event: 'Traffic Collapse — NH48', estimatedLoss: 360 },
  { date: 'Mar 29', event: 'AQI Spike — 430',         estimatedLoss: 270 },
];
const WHATIF_TOTAL = WHATIF_EVENTS.reduce((s, e) => s + e.estimatedLoss, 0);

export default function PoliciesScreen() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showTnc, setShowTnc] = useState(false);
  const [selectedPlanForTnc, setSelectedPlanForTnc] = useState<{id: string; name: string} | null>(null);
  const [acceptedTnc, setAcceptedTnc] = useState(false);
  const [whatIfExpanded, setWhatIfExpanded] = useState(false);

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

  const handleSubscribe = (id: string, name: string) => {
    setSelectedPlanForTnc({ id, name });
    setAcceptedTnc(false);
    setShowTnc(true);
  };

  const proceedWithSubscription = () => {
    setShowTnc(false);
    if (!selectedPlanForTnc) return;
    const { id, name } = selectedPlanForTnc;
    if (name === 'Platinum') {
      Alert.alert(
        '2-Week Waiting Period',
        'Upgrading to Platinum activates a 2-week cooling-off period before the higher coverage limit applies.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => doSubscribe(id) },
        ]
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
        <Text style={styles.loaderText}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Coverage Plans</Text>
        <Text style={styles.subtitle}>Weekly protection — cancel anytime</Text>
      </View>

      {/* FEATURE 4 — What-If Projection Banner */}
      <View style={styles.whatIfCard}>
        <View style={styles.whatIfHeaderRow}>
          <View style={styles.whatIfIconWrap}>
            <TrendingDown size={16} color={C.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.whatIfTitle}>Your Unprotected Exposure</Text>
            <Text style={styles.whatIfSub}>Last 30 days — Saket Zone</Text>
          </View>
          <TouchableOpacity
            onPress={() => setWhatIfExpanded(v => !v)}
            style={styles.whatIfToggle}
          >
            <Text style={styles.whatIfToggleText}>
              {whatIfExpanded ? 'Hide' : 'Details'}
            </Text>
            {whatIfExpanded
              ? <ChevronUp size={14} color={C.blue} />
              : <ChevronDown size={14} color={C.blue} />}
          </TouchableOpacity>
        </View>

        <View style={styles.whatIfAmountRow}>
          <Text style={styles.whatIfAmount}>Rs.{WHATIF_TOTAL.toLocaleString()}</Text>
          <Text style={styles.whatIfAmountLabel}>
            would have been recovered from {WHATIF_EVENTS.length} disruption events.
          </Text>
        </View>

        {whatIfExpanded && (
          <View style={styles.whatIfEventList}>
            <View style={styles.whatIfDivider} />
            {WHATIF_EVENTS.map((e, i) => (
              <View key={i} style={styles.whatIfEventRow}>
                <View>
                  <Text style={styles.whatIfEventName}>{e.event}</Text>
                  <Text style={styles.whatIfEventDate}>{e.date}</Text>
                </View>
                <Text style={styles.whatIfEventLoss}>-Rs.{e.estimatedLoss}</Text>
              </View>
            ))}
            <View style={styles.whatIfNote}>
              <AlertCircle size={12} color={C.blue} />
              <Text style={styles.whatIfNoteText}>
                Based on your zone history. Coverage activates immediately after subscribing.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Dynamic Pricing Info */}
      <View style={styles.pricingCard}>
        <Text style={styles.pricingTitle}>Dynamic Zone Pricing</Text>
        <Text style={styles.pricingDesc}>
          Your premium adjusts automatically based on your zone's live risk score from OpenWeatherMap.
        </Text>
        <View style={styles.pricingRow}>
          {[
            { label: 'Low Risk',    rate: '+Rs.15', color: C.green },
            { label: 'Medium Risk', rate: '+Rs.35', color: C.amber },
            { label: 'High Risk',   rate: '+Rs.55', color: C.red   },
          ].map(s => (
            <View key={s.label} style={styles.pricingPill}>
              <Text style={[styles.pricingRate, { color: s.color }]}>{s.rate}</Text>
              <Text style={styles.pricingLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Plan Cards */}
      <View style={styles.plans}>
        {policies.map((p, i) => {
          const meta = PLAN_META[p.name as keyof typeof PLAN_META] ?? PLAN_META.Silver;
          const isPopular = i === 1;

          return (
            <View
              key={p.id}
              style={[
                styles.planCard,
                isPopular && styles.planCardPopular,
              ]}
            >
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}

              <View style={styles.planHeaderRow}>
                <Text style={[styles.planName, isPopular && { color: C.brand }]}>
                  {p.name}
                </Text>
                <Text style={styles.planDesc}>{p.description}</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>Rs.{p.weekly_premium}</Text>
                <Text style={styles.priceUnit}>/week</Text>
              </View>

              <View style={styles.coveragePill}>
                <Text style={styles.coverageLabel}>Coverage up to</Text>
                <Text style={[styles.coverageValue, isPopular && { color: C.brand }]}>
                  Rs.{p.coverage_limit.toLocaleString()}
                </Text>
              </View>

              {isPopular && <View style={styles.popularUnderline} />}

              <View style={styles.featureList}>
                {meta.features.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <View style={styles.featureCheck}>
                      <Check size={10} color={C.green} />
                    </View>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.cta, isPopular && styles.ctaPopular]}
                onPress={() => handleSubscribe(p.id, p.name)}
                disabled={subscribing !== null}
              >
                {subscribing === p.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.ctaText}>Activate Protection</Text>}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* How it works */}
      <View style={styles.how}>
        <Text style={styles.howTitle}>How It Works</Text>
        {([
          ['Subscribe', 'Pick a plan. Premium auto-deducts every Sunday.'],
          ['Background Watch', 'Parity monitors your zone for rain, traffic and pollution 24/7.'],
          ['Auto-Trigger', 'When disruption threshold is crossed, your claim auto-fires.'],
          ['Instant Payout', 'Funds arrive in your account within minutes. No paperwork.'],
        ] as const).map(([step, desc], i) => (
          <View key={step} style={[styles.howRow, i > 0 && { marginTop: 14 }]}>
            <View style={styles.howDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.howStep}>{step}</Text>
              <Text style={styles.howDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 48 }} />

      {/* T&C Modal */}
      <Modal visible={showTnc} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Terms and Conditions</Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalText}>
                Before activating your Parity income protection, please review the standard conditions.
                {'\n\n'}
                <Text style={{ fontWeight: FONT.bold, color: C.txt1 }}>Standard Exclusions{'\n'}</Text>
                Parity products do NOT provide coverage for losses caused directly or indirectly by:{'\n\n'}
                - War, invasion, acts of foreign enemies{'\n'}
                - Pandemics and related governmental lockdowns{'\n'}
                - Terrorism, cyber-terrorism, or riots not mapped to mobility collapse{'\n'}
                - Nuclear energy risks or radioactive contamination
              </Text>

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptedTnc(!acceptedTnc)}
              >
                <View style={[styles.checkbox, acceptedTnc && styles.checkboxActive]}>
                  {acceptedTnc && <Check size={12} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree to the Terms and Conditions and acknowledge all standard exclusions.
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowTnc(false)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAccept, !acceptedTnc && styles.btnDisabled]}
                onPress={proceedWithSubscription}
                disabled={!acceptedTnc}
              >
                <Text style={styles.btnAcceptText}>Agree and Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgPrimary, gap: 12 },
  loaderText: { color: C.txt2, fontSize: FONT.sm },

  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  title: { fontSize: FONT.xxl, fontWeight: FONT.heavy, color: C.txt1, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: FONT.sm, color: C.txt3 },

  // FEATURE 4 — What-If
  whatIfCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 14, borderWidth: 1, borderColor: C.border, ...SHADOW.md,
  },
  whatIfHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  whatIfIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: C.redBg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FECACA',
  },
  whatIfTitle: { fontSize: FONT.base, fontWeight: FONT.bold, color: C.txt1 },
  whatIfSub: { fontSize: FONT.xs, color: C.txt3, marginTop: 2 },
  whatIfToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whatIfToggleText: { fontSize: FONT.xs, color: C.blue, fontWeight: FONT.semibold },
  whatIfAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  whatIfAmount: { fontSize: FONT.xl, fontWeight: FONT.heavy, color: C.red },
  whatIfAmountLabel: { fontSize: FONT.sm, color: C.txt2, flex: 1 },
  whatIfDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  whatIfEventList: {},
  whatIfEventRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  whatIfEventName: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: C.txt1, marginBottom: 2 },
  whatIfEventDate: { fontSize: FONT.xs, color: C.txt3 },
  whatIfEventLoss: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.red },
  whatIfNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.blueBg, borderRadius: RADIUS.md,
    padding: 10, marginTop: 4,
  },
  whatIfNoteText: { fontSize: FONT.xs, color: C.blue, flex: 1, lineHeight: 17 },

  // Pricing
  pricingCard: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: RADIUS.xl,
    padding: 18, marginBottom: 20, borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  pricingTitle: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, marginBottom: 4 },
  pricingDesc: { fontSize: FONT.xs, color: C.txt2, marginBottom: 14, lineHeight: 18 },
  pricingRow: { flexDirection: 'row', gap: 8 },
  pricingPill: {
    flex: 1, backgroundColor: C.bgSubtle, borderRadius: RADIUS.md,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  pricingRate: { fontSize: FONT.base, fontWeight: FONT.heavy, marginBottom: 3 },
  pricingLabel: { fontSize: 10, color: C.txt3, textAlign: 'center' },

  // Plans
  plans: { paddingHorizontal: 20, gap: 18, marginBottom: 24 },
  planCard: {
    backgroundColor: C.bgCard, borderRadius: RADIUS.xl, padding: 22,
    borderWidth: 1, borderColor: C.border, ...SHADOW.md,
  },
  planCardPopular: { borderColor: C.brand, borderWidth: 2 },
  popularBadge: {
    alignSelf: 'flex-start', backgroundColor: C.brand, borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14,
  },
  popularText: { color: '#fff', fontSize: FONT.xs, fontWeight: FONT.heavy, letterSpacing: FONT.wide },
  planHeaderRow: { marginBottom: 16 },
  planName: { fontSize: FONT.xl, fontWeight: FONT.heavy, color: C.txt1, marginBottom: 4 },
  planDesc: { fontSize: FONT.xs, color: C.txt3 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginBottom: 14 },
  priceAmount: { fontSize: FONT.hero, fontWeight: FONT.heavy, color: C.txt1, letterSpacing: -1 },
  priceUnit: { fontSize: FONT.base, color: C.txt3 },
  coveragePill: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.bgSubtle, borderRadius: RADIUS.md, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  coverageLabel: { fontSize: FONT.sm, color: C.txt2 },
  coverageValue: { fontSize: FONT.md, fontWeight: FONT.heavy, color: C.txt1 },
  popularUnderline: { height: 3, backgroundColor: C.brand, borderRadius: 2, marginBottom: 18, width: 36 },
  featureList: { gap: 10, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: C.greenBg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  featureText: { fontSize: FONT.sm, color: C.txt2, flex: 1 },
  cta: {
    backgroundColor: C.txt1, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center',
  },
  ctaPopular: { backgroundColor: C.brand },
  ctaText: { color: '#fff', fontSize: FONT.base, fontWeight: FONT.bold },

  // How it works
  how: {
    backgroundColor: C.bgCard, marginHorizontal: 20, borderRadius: RADIUS.xl,
    padding: 22, borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  howTitle: { fontSize: FONT.md, fontWeight: FONT.bold, color: C.txt1, marginBottom: 20 },
  howRow: { flexDirection: 'row', gap: 14 },
  howDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginTop: 5,
  },
  howStep: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, marginBottom: 3 },
  howDesc: { fontSize: FONT.xs, color: C.txt2, lineHeight: 18 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20,
  },
  modalContent: {
    backgroundColor: C.bgCard, borderRadius: RADIUS.xl, padding: 24, maxHeight: '80%',
  },
  modalTitle: { fontSize: FONT.lg, fontWeight: FONT.heavy, color: C.txt1, marginBottom: 16 },
  modalScroll: { marginBottom: 20 },
  modalText: { fontSize: FONT.sm, color: C.txt2, lineHeight: 22, marginBottom: 20 },
  checkboxContainer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.bgSubtle, padding: 16, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.txt3,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxActive: { backgroundColor: C.green, borderColor: C.green },
  checkboxLabel: { flex: 1, fontSize: FONT.sm, color: C.txt1, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRadius: RADIUS.md, backgroundColor: C.bgSubtle,
    borderWidth: 1, borderColor: C.border,
  },
  btnCancelText: { color: C.txt2, fontWeight: FONT.bold, fontSize: FONT.sm },
  btnAccept: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRadius: RADIUS.md, backgroundColor: C.brand,
  },
  btnAcceptText: { color: '#fff', fontWeight: FONT.bold, fontSize: FONT.sm },
  btnDisabled: { opacity: 0.4 },
});
