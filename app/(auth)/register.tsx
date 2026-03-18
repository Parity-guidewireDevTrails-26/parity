import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Shield, MapPin, UploadCloud, Zap } from 'lucide-react-native';
import Svg, { Rect, Circle } from 'react-native-svg';
import { ApiService } from '@/services/api';
import { calculatePremium } from '@/utils/pricing';
import { detectFraud } from '@/utils/fraud';

const C = {
  bgPrimary: '#F5F5F7', bgCard: '#FFFFFF',
  txt1: '#1C1C1E', txt2: '#6E6E73', txt3: '#AEAEB2',
  green: '#22C55E', amber: '#F59E0B', red: '#EF4444', border: '#E5E5EA', brand: '#19213D'
};

const PLATFORMS = ['Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'Porter'];
const PLANS = [
  { id: 'policy_01', name: 'Silver', limit: 1500, cost: 45 },
  { id: 'policy_02', name: 'Gold', limit: 3500, cost: 85 },
  { id: 'policy_03', name: 'Platinum', limit: 7000, cost: 150 }
];

const ParityStaticLogo = () => (
  <View style={styles.logoWrap}>
    <Svg width="48" height="48" viewBox="0 0 100 100" fill="none">
      <Rect x="20" y="25" width="60" fill="#19213D" height="20" />
      <Rect x="10" y="50" width="80" fill="#19213D" height="6" />
      <Rect x="20" y="61" width="60" fill="#19213D" height="20" />
      <Circle cx="72" cy="18" r="4.5" fill="#7DB282" />
    </Svg>
  </View>
);

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  
  const [platform, setPlatform] = useState('');
  const [ocrStatus, setOcrStatus] = useState<'' | 'scanning' | 'done'>('');
  const [pricing, setPricing] = useState<any>(null);

  const nextStep = () => setStep(s => s + 1);

  const handleSendOTP = async () => {
    if (!fullName || !city || phone.length < 10) return Alert.alert('Missing Info', 'Please fill all fields properly.');
    setLoading(true);
    setTimeout(() => { setLoading(false); setOtpSent(true); }, 600);
  };

  const handleVerifyOTP = async () => {
    if (otp !== '1234') return Alert.alert('Incorrect OTP', 'Use 1234 for demo.');
    setLoading(true);
    setTimeout(() => { setLoading(false); nextStep(); }, 600);
  };

  const runHardwareHandshake = async () => {
    setLoading(true);
    const mockGPS = { lat: 28.5355, lng: 77.2158, device_mocked: false, vpn_active: false };
    const zone = { centerLat: 28.5, centerLng: 77.2, radiusKm: 10 };
    const result = detectFraud(mockGPS, zone);

    setTimeout(() => {
      setLoading(false);
      nextStep();
    }, 1500);
  };

  const simulateIncomeOCR = () => {
    setOcrStatus('scanning');
    setTimeout(() => {
      const p = calculatePremium(25, 40, 'High'); // High Risk Malviya Nagar
      setPricing(p);
      setOcrStatus('done');
      setTimeout(nextStep, 1000);
    }, 2500);
  };

  const handleBuyNow = async () => {
    setLoading(true);
    try {
      await ApiService.register();
      // Match the policy ID with the tier generated
      const match = PLANS.find(p => p.name === pricing.tier) || PLANS[1];
      await ApiService.subscribeToPlan(match.id);
      router.replace('/(tabs)');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await ApiService.register();
      router.replace('/(tabs)');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
      {step > 1 && (
        <View style={styles.header}>
          <Text style={styles.stepCount}>Step {step} of 4</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* STEP 1: Personal Info & Phone + OTP (Seamless Background) */}
        {step === 1 && (
          <View style={styles.seamlessContainer}>
            <View style={styles.brandHero}>
              <ParityStaticLogo />
              <Text style={styles.heroTitle}>Welcome to Parity</Text>
              <Text style={styles.heroSubtitle}>
                Income protection for Indian gig workers, simplified.
              </Text>
            </View>

            <View style={styles.formPadding}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={[styles.input, otpSent && styles.inputDisabled]}
                  placeholder="e.g. Rajesh Kumar"
                  placeholderTextColor={C.txt3}
                  value={fullName} onChangeText={setFullName}
                  editable={!otpSent}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Working City</Text>
                <TextInput
                  style={[styles.input, otpSent && styles.inputDisabled]}
                  placeholder="e.g. New Delhi"
                  placeholderTextColor={C.txt3}
                  value={city} onChangeText={setCity}
                  editable={!otpSent}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <TextInput
                  style={[styles.input, otpSent && styles.inputDisabled]}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={C.txt3}
                  value={phone} onChangeText={setPhone} 
                  keyboardType="phone-pad"
                  editable={!otpSent}
                />
              </View>

              {!otpSent ? (
                <TouchableOpacity style={[styles.btn, { marginTop: 10 }]} onPress={handleSendOTP} activeOpacity={0.8}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Get OTP</Text>}
                </TouchableOpacity>
              ) : (
                <View style={[styles.otpSection, { marginTop: 10 }]}>
                  <Text style={styles.inputLabel}>One Time Password (OTP)</Text>
                  <Text style={styles.otpHint}>We sent a secure code to {phone}</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="----"
                    placeholderTextColor={C.txt3}
                    maxLength={4} 
                    value={otp} 
                    onChangeText={setOtp} 
                    keyboardType="number-pad"
                    autoFocus
                  />
                  <TouchableOpacity style={styles.btn} onPress={handleVerifyOTP} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & Proceed</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* STEP 2: Security Handshake */}
        {step === 2 && (
          <View style={styles.seamlessContainer}>
            <View style={styles.brandHero}>
              <Shield size={48} color={C.brand} style={styles.iconCenter} />
              <Text style={styles.heroTitle}>Security Sync</Text>
              <Text style={styles.heroSubtitle}>
                Parity requires native device integrity and GPS binding to ensure secure payouts.
              </Text>
            </View>
            
            <View style={styles.formPadding}>
              <View style={styles.checklist}>
                <View style={styles.checkItem}><Check size={16} color={C.green} /><Text style={styles.checkText}>Checking root status...</Text></View>
                <View style={styles.checkItem}><Check size={16} color={C.green} /><Text style={styles.checkText}>Binding GPS module...</Text></View>
                <View style={styles.checkItem}><Check size={16} color={C.green} /><Text style={styles.checkText}>Verifying VPN status...</Text></View>
              </View>
              <TouchableOpacity style={styles.btn} onPress={runHardwareHandshake}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Run Integrity Check</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3: Platform & Income */}
        {step === 3 && (
          <View style={styles.seamlessContainer}>
            <View style={styles.brandHero}>
              <Text style={styles.heroTitle}>Baseline Earnings</Text>
              <Text style={styles.heroSubtitle}>Select your primary partner app to establish income protection.</Text>
            </View>

            <View style={styles.formPadding}>
              <View style={styles.platformGrid}>
                {PLATFORMS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.platformPill, platform === p && styles.platformActive]}
                    onPress={() => setPlatform(p)}>
                    <Text style={[styles.platformText, platform === p && { color: '#fff' }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {platform !== '' && (
                <View style={styles.uploadSection}>
                  <Text style={styles.inputLabel}>Upload previous week's earnings</Text>
                  
                  {ocrStatus === '' && (
                    <TouchableOpacity style={styles.uploadArea} onPress={simulateIncomeOCR}>
                      <UploadCloud size={32} color={C.txt3} />
                      <Text style={styles.uploadText}>Tap to upload screenshot</Text>
                    </TouchableOpacity>
                  )}

                  {ocrStatus === 'scanning' && (
                    <View style={styles.uploadArea}>
                      <ActivityIndicator size="large" color={C.brand} />
                      <Text style={[styles.uploadText, { color: C.brand }]}>OCR scanning payouts...</Text>
                    </View>
                  )}

                  {ocrStatus === 'done' && (
                    <View style={[styles.uploadArea, styles.uploadDone]}>
                      <Check size={32} color={C.green} />
                      <Text style={[styles.uploadText, { color: C.green }]}>Income verified.</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* STEP 4: Risk Profile Built & 3 Pricing Cards */}
        {step === 4 && pricing && (
           <View style={styles.seamlessContainer}>
            <View style={styles.brandHero}>
              <Zap size={32} color={C.amber} style={styles.iconCenter} />
              <Text style={styles.heroTitle}>Review & Activate</Text>
              <Text style={styles.heroSubtitle}>Your predicted income is ₹{pricing.expectedWeeklyIncome.toLocaleString()}/wk. A high-risk zone surcharge (+₹{pricing.surcharge}) is active.</Text>
            </View>

            <View style={styles.formPadding}>

              {/* Plans Render */}
              <View style={{ gap: 14, marginBottom: 30 }}>
                {PLANS.map((plan) => {
                  const isRecommended = plan.name === pricing.tier;
                  const finalCost = plan.cost + pricing.surcharge;
                  return (
                    <View key={plan.id} style={[styles.planCard, isRecommended && styles.planCardActive]}>
                      {isRecommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recText}>Best Match Found</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.planName, isRecommended && { color: C.green }]}>{plan.name}</Text>
                        <Text style={styles.planLimits}>Covers up to ₹{plan.limit}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.planCost, isRecommended && { color: C.txt1 }]}>₹{finalCost}</Text>
                        <Text style={styles.planFreq}>per week</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.btn} onPress={handleBuyNow}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Protect Income Now</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                <Text style={styles.skipBtnText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 10 },
  stepCount: { fontSize: 12, fontWeight: '800', color: C.txt3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  progressTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.brand },

  scroll: { flexGrow: 1, paddingBottom: 60 },
  
  // ALL Seamless!
  seamlessContainer: { flex: 1, paddingTop: 40 },
  brandHero: { alignItems: 'center', paddingHorizontal: 32, marginBottom: 36 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: C.txt1, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: C.txt2, textAlign: 'center', lineHeight: 22 },
  formPadding: { paddingHorizontal: 24 },
  
  logoWrap: { width: 72, height: 72, backgroundColor: C.bgCard, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: C.txt2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  input: { 
    backgroundColor: C.bgCard, borderRadius: 16, padding: 18, 
    fontSize: 16, color: C.txt1, fontWeight: '600',
    borderWidth: 1, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2
  },
  inputDisabled: { opacity: 0.5, backgroundColor: 'transparent', shadowOpacity: 0, borderWidth: 1, borderColor: C.border },
  
  otpSection: { paddingTop: 10 },
  otpHint: { fontSize: 13, color: C.txt2, marginBottom: 16, marginLeft: 4 },
  otpInput: { textAlign: 'center', fontSize: 32, letterSpacing: 16, fontWeight: '800', marginBottom: 24 },
  
  btn: { backgroundColor: C.brand, borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: C.brand, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  skipBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  skipBtnText: { color: C.txt2, fontSize: 14, fontWeight: '700' },

  iconCenter: { alignSelf: 'center', marginBottom: 8 },
  textCenter: { textAlign: 'center' },

  checklist: { gap: 12, marginVertical: 20 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: C.bgCard, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  checkText: { fontSize: 14, fontWeight: '600', color: C.txt1 },

  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  platformPill: { backgroundColor: C.bgCard, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: '#FFF' },
  platformActive: { backgroundColor: C.brand, borderColor: C.brand },
  platformText: { fontSize: 14, fontWeight: '700', color: C.txt2 },

  uploadSection: { marginTop: 32 },
  uploadArea: { 
    height: 140, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, 
    borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' 
  },
  uploadDone: { borderColor: C.green, backgroundColor: C.green + '11', borderStyle: 'solid' },
  uploadText: { fontSize: 14, fontWeight: '600', color: C.txt2, marginTop: 12 },

  // Pricing Cards
  planCard: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: C.bgCard, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2, borderWidth: 1, borderColor: '#FFF' },
  planCardActive: { borderColor: C.green, backgroundColor: '#F0FDF4' },
  recommendedBadge: { position: 'absolute', top: -10, left: 20, backgroundColor: C.green, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  recText: { color: '#FFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  planName: { fontSize: 16, fontWeight: '800', color: C.txt1, marginBottom: 4 },
  planLimits: { fontSize: 13, color: C.txt2 },
  planCost: { fontSize: 22, fontWeight: '800', color: C.txt2 },
  planFreq: { fontSize: 11, color: C.txt3, fontWeight: '600' }
});
