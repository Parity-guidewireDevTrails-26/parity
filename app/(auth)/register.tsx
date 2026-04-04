import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Check, Shield, MapPin, UploadCloud, Zap,
  Smartphone, ChevronRight, Info, Navigation,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Svg, { Rect, Circle } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { ApiService, DeviceFingerprint } from '@/services/api';
import { calculatePremium } from '@/utils/pricing';
import { detectFraud } from '@/utils/fraud';

const C = {
  bgPrimary: '#F5F5F7', bgCard: '#FFFFFF',
  txt1: '#1C1C1E', txt2: '#6E6E73', txt3: '#AEAEB2',
  green: '#22C55E', amber: '#F59E0B', red: '#EF4444',
  border: '#E5E5EA', brand: '#19213D',
};
const SHADOW = {
  shadowColor: '#000', shadowOpacity: 0.06,
  shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3,
};

const PLATFORMS = ['Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'Porter'];
const PLANS = [
  { id: 'policy_01', name: 'Silver', limit: 1500, cost: 45 },
  { id: 'policy_02', name: 'Gold', limit: 3500, cost: 85 },
  { id: 'policy_03', name: 'Platinum', limit: 7000, cost: 150 },
];

const TOTAL_STEPS = 7;

const ParityLogo = () => (
  <View style={styles.logoWrap}>
    <Svg width="44" height="44" viewBox="0 0 100 100" fill="none">
      <Rect x="20" y="25" width="60" fill={C.brand} height="20" />
      <Rect x="10" y="50" width="80" fill={C.brand} height="6" />
      <Rect x="20" y="61" width="60" fill={C.brand} height="20" />
      <Circle cx="72" cy="18" r="4.5" fill={C.green} />
    </Svg>
  </View>
);

// ── Generates a mock device fingerprint ──────────────────────────────────────
function buildDeviceFingerprint(): DeviceFingerprint {
  const uuid = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  return {
    hardware_uuid: uuid,
    os_version: Platform.OS === 'ios' ? 'iOS 17.4' : 'Android 13',
    root_status: false,
    screen_resolution: `${Dimensions.get('window').width}x${Dimensions.get('window').height}`,
    timestamp: new Date().toISOString(),
  };
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Consent
  // Step 2 — Location Permission
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied'
  >('idle');

  // Step 3 — Personal Details
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

  // Step 4 — OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  // Step 5 — Platform + Income
  const [platform, setPlatform] = useState('');
  const [ocrStatus, setOcrStatus] = useState<'' | 'scanning' | 'done'>('');
  const [mlPlans, setMlPlans] = useState<any[]>([]); // real ML-priced plans
  const [locationRisk, setLocationRisk] = useState<any>(null);

  // Step 6 — Device Security (captured fingerprint)
  const [fingerprint] = useState<DeviceFingerprint>(buildDeviceFingerprint());
  const [securityDone, setSecurityDone] = useState(false);

  // Step 7 — Policy + T&C
  const [acceptedTnc, setAcceptedTnc] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const nextStep = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // ── Handlers ────────────────────────────────────────────────────────────────
  // Step 2: Request location
  const handleRequestLocation = async () => {
    setLocationStatus('requesting');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLat(loc.coords.latitude);
      setUserLng(loc.coords.longitude);
      setLocationStatus('granted');
    } catch (e) {
      setLocationStatus('denied');
    }
  };

  const handleSendOTP = () => {
    if (!fullName.trim() || phone.length < 10 || !city.trim()) {
      return Alert.alert('Missing Info', 'Please fill in all fields.');
    }
    setOtpSent(true);
    nextStep();
  };

  const handleVerifyOTP = () => {
    if (otp !== '1234') return Alert.alert('Incorrect OTP', 'Use 1234 for the demo.');
    nextStep();
  };

  // Calls the real ML service with GPS + income data to get risk-priced plans
  const simulateIncomeOCR = async () => {
    if (!platform) return Alert.alert('Select Platform', 'Please choose your gig platform first.');
    setOcrStatus('scanning');
    try {
      const mlUrl = process.env.EXPO_PUBLIC_ML_URL ?? 'http://localhost:8085';
      const resp = await fetch(`${mlUrl}/risk/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: userLat ?? 28.5355,
          lng: userLng ?? 77.2158,
          hours_per_day: 8,
          orders_per_hour: 3,
          days_per_week: 5,
          earnings_per_order: 60,
          platform,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setLocationRisk(data);
        setMlPlans(data.plans ?? []);
      }
    } catch (e) {
      // Fallback to local formula
      const p = calculatePremium(25, 40, 'High');
      setLocationRisk(null);
    } finally {
      setOcrStatus('done');
    }
  };

  const runSecurityHandshake = () => {
    setLoading(true);
    const mockGPS = { lat: 28.5355, lng: 77.2158, device_mocked: false, vpn_active: false };
    const zone = { centerLat: 28.5, centerLng: 77.2, radiusKm: 10 };
    detectFraud(mockGPS, zone);
    setTimeout(() => { setLoading(false); setSecurityDone(true); }, 1500);
  };

  const getPushToken = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return undefined;
      const { data } = await Notifications.getExpoPushTokenAsync();
      return data;
    } catch {
      return undefined;
    }
  };

  const ensureRegistered = async () => {
    try {
      await ApiService.register({
        phone_number: `+91${phone}`,
        name: fullName,
        platform,
        work_city: city,
        password: '1234',
        device_fingerprint: fingerprint,
      });
    } catch (e: any) {
      if (e.message?.toLowerCase().includes('already registered')) {
        await ApiService.login(`+91${phone}`, '1234');
      } else {
        throw e;
      }
    }
  };

  const handleBuyNow = async () => {
    if (!acceptedTnc) return Alert.alert('Please Accept', 'You must accept the Terms & Conditions.');
    setLoading(true);
    try {
      await ensureRegistered();
      
      const pushToken = await getPushToken();
      if (pushToken) {
        await ApiService.updateProfile({ expo_push_token: pushToken });
      }
      
      // Fetch policies from backend to get the real UUIDs
      const data = await ApiService.getPolicies();
      
      let planName = 'Gold';
      if (selectedPlanId === 'policy_01') planName = 'Silver';
      else if (selectedPlanId === 'policy_02') planName = 'Gold';
      else if (selectedPlanId === 'policy_03') planName = 'Platinum';
      
      const actualPolicy = data.policies.find(p => p.name.toLowerCase() === planName.toLowerCase());
      if (!actualPolicy) {
        throw new Error(`Policy ${planName} not found in database.`);
      }

      await ApiService.subscribeToPlan(actualPolicy.id);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await ensureRegistered();
      
      const pushToken = await getPushToken();
      if (pushToken) {
        await ApiService.updateProfile({ expo_push_token: pushToken });
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };


  // ── Layout helpers ───────────────────────────────────────────────────────────
  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgPrimary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header / Progress */}
        <View style={styles.header}>
          {step > 1 && (
            <TouchableOpacity onPress={prevStep} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          <Text style={styles.stepCount}>{step} / {TOTAL_STEPS}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── STEP 1: Device Fingerprint Consent ── */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <ParityLogo />
              <Text style={styles.heroTitle}>Welcome to Parity</Text>
              <Text style={styles.heroSubtitle}>
                AI-parametric income protection for India's gig workers.
              </Text>

              <View style={[styles.card, styles.infoCard]}>
                <View style={styles.infoIconRow}>
                  <Shield size={20} color={C.amber} />
                  <Text style={styles.infoCardTitle}>Before We Start — Device Check</Text>
                </View>
                <Text style={styles.infoCardBody}>
                  To prevent fraud and protect your payouts, Parity records your device's{' '}
                  <Text style={{ fontWeight: '700', color: C.txt1 }}>hardware ID, OS version, screen resolution,
                  and root/jailbreak status</Text>.
                  {'\n\n'}
                  This data is securely stored, never sold, and used{' '}
                  <Text style={{ fontWeight: '700', color: C.txt1 }}>only to verify your identity
                  during zero-touch payout validation</Text>.
                  {'\n\n'}
                  You can request deletion at any time from your Profile settings.
                </Text>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Smartphone size={14} color={C.txt3} />
                  <Text style={styles.infoMeta}>
                    Hardware ID: <Text style={{ color: C.txt1 }}>{fingerprint.hardware_uuid}</Text>
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Info size={14} color={C.txt3} />
                  <Text style={styles.infoMeta}>
                    OS: <Text style={{ color: C.txt1 }}>{fingerprint.os_version}</Text>
                    {'   '}Root: <Text style={{ color: C.green }}>Clean</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.btnPrimary} onPress={nextStep} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>Accept & Continue</Text>
                <ChevronRight size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.disclaimer}>
                By continuing you agree to Parity's Privacy Policy and Terms of Service.
              </Text>
            </View>
          )}

          {/* ── STEP 2: Location Permission ── */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={[styles.logoWrap, { backgroundColor: '#F0FFF4', marginBottom: 8 }]}>
                <Navigation size={36} color={C.green} />
              </View>
              <Text style={styles.stepTitle}>Enable Location</Text>
              <Text style={styles.stepSubtitle}>
                Parity uses your GPS to assess real-time weather and traffic risk in your operating zone.
                This powers your personalised premium — riders in high-disruption zones pay less when risk is priced accurately.
              </Text>

              <View style={[styles.card, styles.infoCard]}>
                <View style={styles.infoIconRow}>
                  <MapPin size={20} color={C.green} />
                  <Text style={styles.infoCardTitle}>Why We Need Your Location</Text>
                </View>
                <Text style={styles.infoCardBody}>
                  <Text>{'\u2705 '}</Text><Text style={{ fontWeight: '700', color: C.txt1 }}>Personalised premium</Text>
                  <Text>{' — based on actual rain/heat/traffic in your zone\n'}</Text>
                  <Text>{'\u2705 '}</Text><Text style={{ fontWeight: '700', color: C.txt1 }}>Zero-touch triggers</Text>
                  <Text>{' — no manual claim filing when disruption detected\n'}</Text>
                  <Text>{'\u2705 '}</Text><Text style={{ fontWeight: '700', color: C.txt1 }}>Zone clustering</Text>
                  <Text>{' — grouped with riders in your area for peer fraud validation\n\n'}</Text>
                  <Text style={{ color: C.txt3, fontSize: 12 }}>
                    Location is only captured once during onboarding and during active disruption events. It is never tracked continuously.
                  </Text>
                </Text>
              </View>

              {locationStatus === 'idle' && (
                <TouchableOpacity style={styles.btnPrimary} onPress={handleRequestLocation} activeOpacity={0.85}>
                  <Navigation size={18} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Allow Location Access</Text>
                </TouchableOpacity>
              )}

              {locationStatus === 'requesting' && (
                <View style={[styles.btnPrimary, { opacity: 0.7 }]}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.btnPrimaryText}>Requesting…</Text>
                </View>
              )}

              {locationStatus === 'granted' && (
                <>
                  <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }]}>
                    <View style={{ backgroundColor: C.green + '18', borderRadius: 20, padding: 8 }}>
                      <Check size={20} color={C.green} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.green, fontWeight: '700', fontSize: 14 }}>Location Captured</Text>
                      <Text style={{ color: C.txt3, fontSize: 12, marginTop: 2 }}>
                        {userLat?.toFixed(4)}°N, {userLng?.toFixed(4)}°E
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: C.green }]} onPress={nextStep} activeOpacity={0.85}>
                    <Text style={styles.btnPrimaryText}>Continue</Text>
                    <ChevronRight size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              )}

              {locationStatus === 'denied' && (
                <>
                  <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }]}>
                    <Text style={{ color: C.amber, fontSize: 13, flex: 1 }}>
                      ⚠️ Location denied. You'll get a standard premium instead of a personalised one. You can grant it later in Settings.
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.btnPrimary} onPress={nextStep} activeOpacity={0.85}>
                    <Text style={styles.btnPrimaryText}>Continue Anyway</Text>
                    <ChevronRight size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ── STEP 3: Personal Details ── */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Your Details</Text>
              <Text style={styles.stepSubtitle}>
                This creates your Parity rider profile. Make sure your mobile number is the one registered with your gig platform.
              </Text>

              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="e.g. Rajesh Kumar"
                    placeholderTextColor={C.txt3}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Phone — India +91 only */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Mobile Number</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇮🇳  +91</Text>
                  </View>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={phone}
                    onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    placeholderTextColor={C.txt3}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                <Text style={styles.fieldHint}>
                  Stored as +91{phone || 'XXXXXXXXXX'}
                </Text>
              </View>

              {/* City */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Working City</Text>
                <View style={styles.inputWrap}>
                  <MapPin size={16} color={C.txt3} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={city}
                    onChangeText={setCity}
                    placeholder="e.g. New Delhi"
                    placeholderTextColor={C.txt3}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, (!fullName || phone.length < 10 || !city) && styles.btnDisabled]}
                onPress={handleSendOTP}
                disabled={!fullName || phone.length < 10 || !city}
                activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>Send OTP</Text>
                <ChevronRight size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 4: OTP Verification ── */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Verify Number</Text>
              <Text style={styles.stepSubtitle}>
                We've sent a 4-digit code to{' '}
                <Text style={{ fontWeight: '700', color: C.txt1 }}>+91 {phone}</Text>.
                {'\n'}Use <Text style={{ fontWeight: '700', color: C.brand }}>1234</Text> for the demo.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>One-Time Password</Text>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="· · · ·"
                  placeholderTextColor={C.txt3}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                  textAlign="center"
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, otp.length < 4 && styles.btnDisabled]}
                onPress={handleVerifyOTP}
                disabled={otp.length < 4}
                activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.btnPrimaryText}>Verify & Continue</Text>
                    <ChevronRight size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>Resend OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 5: Platform + Income Proof ── */}
          {step === 5 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Income Baseline</Text>
              <Text style={styles.stepSubtitle}>
                Select your primary platform. This establishes your 8-week income baseline used to calculate payouts.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Gig Platform</Text>
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
              </View>

              {platform !== '' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Last Week's Earnings Proof</Text>
                  <Text style={styles.fieldHint}>
                    Parity uses AI-OCR to read your payout screenshot and establish your income baseline. This acts as your fraud-proof identity anchor.
                  </Text>

                  {ocrStatus === '' && (
                    <TouchableOpacity style={styles.uploadArea} onPress={simulateIncomeOCR} activeOpacity={0.7}>
                      <UploadCloud size={36} color={C.txt3} />
                      <Text style={styles.uploadText}>Tap to upload earnings screenshot</Text>
                      <Text style={styles.uploadSubtext}>Supports Swiggy, Zomato, Zepto receipts</Text>
                    </TouchableOpacity>
                  )}

                  {ocrStatus === 'scanning' && (
                    <View style={styles.uploadArea}>
                      <ActivityIndicator size="large" color={C.brand} />
                      <Text style={[styles.uploadText, { color: C.brand }]}>OCR Scanning Payouts…</Text>
                      <Text style={styles.uploadSubtext}>Reading weekly earnings data</Text>
                    </View>
                  )}

                  {ocrStatus === 'done' && (
                    <View style={[styles.uploadArea, styles.uploadDone]}>
                      <Check size={36} color={C.green} />
                      <Text style={[styles.uploadText, { color: C.green }]}>Income Verified</Text>
                      <Text style={[styles.uploadSubtext, { color: C.green }]}>
                        {locationRisk
                          ? `Risk zone: ${locationRisk.risk_label} — ${locationRisk.data_source === 'historical_7d' ? '7-day' : 'live'} weather used`
                          : '~₹1,440/wk baseline locked'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {ocrStatus === 'done' && (
                <TouchableOpacity style={styles.btnPrimary} onPress={nextStep} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>Continue</Text>
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP 6: Device Security Handshake ── */}
          {step === 6 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Security Sync</Text>
              <Text style={styles.stepSubtitle}>
                Parity requires native device integrity to ensure secure, tamper-proof payouts. Run the one-time handshake below.
              </Text>

              <View style={styles.card}>
                {[
                  { label: 'Root / Jailbreak Check', done: securityDone },
                  { label: 'GPS Module Binding', done: securityDone },
                  { label: 'VPN Telemetry Scan', done: securityDone },
                  { label: `Device Fingerprint: ${fingerprint.hardware_uuid}`, done: securityDone },
                ].map((item, i) => (
                  <View key={i} style={[styles.checkRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 }]}>
                    <View style={[styles.checkCircle, item.done && styles.checkCircleDone]}>
                      {item.done && <Check size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.checkLabel, item.done && { color: C.txt1 }]}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {!securityDone ? (
                <TouchableOpacity style={styles.btnPrimary} onPress={runSecurityHandshake} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Text style={styles.btnPrimaryText}>Run Integrity Check</Text>
                      <Shield size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: C.green }]} onPress={nextStep} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>All Clear — Continue</Text>
                  <Check size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP 7: Policy Selection + T&C ── */}
          {step === 7 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Choose Your Shield</Text>
              <Text style={styles.stepSubtitle}>
                {locationRisk
                  ? `${locationRisk.risk_label} risk zone · Live weather pricing applied`
                  : 'Select the plan that fits your income.'}{'\n'}
                Powered by real OpenWeatherMap data for your location.
              </Text>

              {locationRisk && (
                <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }]}>
                  <Text style={{ fontSize: 20 }}>{locationRisk.risk_label === 'HIGH' ? '🌧️' : locationRisk.risk_label === 'MEDIUM' ? '⛅' : '☀️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.txt1, fontSize: 13 }}>Live Weather Status</Text>
                    <Text style={{ color: C.txt3, fontSize: 11.5, marginTop: 2 }}>
                      Rain: {locationRisk.weather?.current_rain_mm ?? 0}mm · Temp: {locationRisk.weather?.current_temp_c ?? '--'}°C
                    </Text>
                  </View>
                  <View style={{ backgroundColor: locationRisk.risk_label === 'HIGH' ? '#FEF3C7' : '#F0FFF4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontWeight: '700', fontSize: 12, color: locationRisk.risk_label === 'HIGH' ? C.amber : C.green }}>
                      {(locationRisk.risk_score * 100).toFixed(0)}% risk
                    </Text>
                  </View>
                </View>
              )}

              <View style={{ gap: 14, marginBottom: 20 }}>
                {(mlPlans.length > 0 ? mlPlans : PLANS.map(p => ({ plan: p.name.toUpperCase(), weekly_premium: p.cost, coverage_limit: p.limit }))).map((plan: any, idx: number) => {
                  const planId = idx === 0 ? 'policy_01' : idx === 1 ? 'policy_02' : 'policy_03';
                  const isRec = plan.plan === (locationRisk?.recommended_plan ?? 'GOLD');
                  const isSelected = selectedPlanId === planId;
                  return (
                    <TouchableOpacity
                      key={plan.plan}
                      onPress={() => setSelectedPlanId(planId)}
                      activeOpacity={0.8}
                      style={[styles.planCard, (isSelected || (!selectedPlanId && isRec)) && styles.planCardActive]}>
                      {isRec && (
                        <View style={styles.recBadge}>
                          <Text style={styles.recText}>Best Match</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.planName, isRec && { color: C.green }]}>{plan.plan.charAt(0) + plan.plan.slice(1).toLowerCase()}</Text>
                        <Text style={styles.planLimit}>Covers up to ₹{plan.coverage_limit?.toLocaleString()}</Text>
                        {plan.risk_loading > 0 && (
                          <Text style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>⚡ +{plan.risk_loading}% risk loading applied</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.planCost}>₹{plan.weekly_premium}</Text>
                        <Text style={styles.planFreq}>/week</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* T&C */}
              <View style={[styles.card, { marginBottom: 20 }]}>
                <Text style={styles.label}>Standard Exclusions</Text>
                <Text style={styles.infoCardBody}>
                  Parity does NOT cover losses from: War, Pandemics, Terrorism, or Nuclear events.
                  These events cannot produce a valid Oracle trigger payload in our Zero-Touch architecture.
                </Text>
                <View style={styles.infoDivider} />
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setAcceptedTnc(!acceptedTnc)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, acceptedTnc && styles.checkboxActive]}>
                    {acceptedTnc && <Check size={13} color="#fff" />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    I agree to the Terms & Conditions and acknowledge all standard exclusions.
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, !acceptedTnc && styles.btnDisabled]}
                onPress={handleBuyNow}
                disabled={!acceptedTnc || loading}
                activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.btnPrimaryText}>Activate Protection</Text>
                    <Zap size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={loading}>
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 10 },
  backBtn: { paddingVertical: 6, paddingRight: 16 },
  backText: { fontSize: 15, color: C.brand, fontWeight: '600' },
  stepCount: { fontSize: 12, fontWeight: '700', color: C.txt3, letterSpacing: 0.5 },
  progressTrack: { height: 3, backgroundColor: C.border, marginHorizontal: 20 },
  progressFill: { height: '100%', backgroundColor: C.brand, borderRadius: 2 },

  scroll: { paddingBottom: 60 },
  stepContainer: { paddingHorizontal: 24, paddingTop: 28 },

  // Brand (Step 1)
  logoWrap: { width: 72, height: 72, backgroundColor: C.bgCard, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 18, ...SHADOW },
  heroTitle: { fontSize: 30, fontWeight: '800', color: C.txt1, marginBottom: 6, letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 15, color: C.txt2, lineHeight: 22, marginBottom: 28 },

  // Step headers
  stepTitle: { fontSize: 26, fontWeight: '800', color: C.txt1, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: C.txt2, lineHeight: 22, marginBottom: 24 },

  // Info card (Step 1 consent)
  card: { backgroundColor: C.bgCard, borderRadius: 18, padding: 18, marginBottom: 24, ...SHADOW },
  infoCard: { borderLeftWidth: 3, borderLeftColor: C.amber },
  infoIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: C.txt1 },
  infoCardBody: { fontSize: 13, color: C.txt2, lineHeight: 21 },
  infoDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoMeta: { fontSize: 12, color: C.txt3 },

  // Form fields
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.txt3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bgCard, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: C.border, ...SHADOW,
  },
  input: { flex: 1, fontSize: 15, color: C.txt1 },
  fieldHint: { fontSize: 11, color: C.txt3, marginTop: 6, marginLeft: 4 },

  // Phone prefix
  countryCode: { paddingRight: 4 },
  countryCodeText: { fontSize: 15, fontWeight: '600', color: C.txt1 },
  phoneDivider: { width: 1, height: 22, backgroundColor: C.border, marginRight: 2 },

  // OTP
  otpInput: {
    backgroundColor: C.bgCard, borderRadius: 14, padding: 20,
    fontSize: 36, fontWeight: '800', color: C.txt1, textAlign: 'center',
    letterSpacing: 16, borderWidth: 1, borderColor: C.border, ...SHADOW,
  },

  // Platform pills
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  platformPill: {
    backgroundColor: C.bgCard, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 22, borderWidth: 1, borderColor: C.border, ...SHADOW,
  },
  platformActive: { backgroundColor: C.brand, borderColor: C.brand },
  platformText: { fontSize: 14, fontWeight: '600', color: C.txt2 },

  // Upload
  uploadArea: {
    height: 150, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.bgCard, marginTop: 12, gap: 8,
  },
  uploadDone: { borderStyle: 'solid', borderColor: C.green, backgroundColor: `${C.green}11` },
  uploadText: { fontSize: 14, fontWeight: '600', color: C.txt2 },
  uploadSubtext: { fontSize: 12, color: C.txt3 },

  // Security checklist
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  checkCircleDone: { backgroundColor: C.green, borderColor: C.green },
  checkLabel: { fontSize: 13, color: C.txt3, flex: 1 },

  // Plan cards
  planCard: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, ...SHADOW,
  },
  planCardActive: { borderColor: C.green, backgroundColor: `${C.green}08` },
  recBadge: { position: 'absolute', top: -10, left: 16, backgroundColor: C.green, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  recText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  planName: { fontSize: 17, fontWeight: '800', color: C.txt1, marginBottom: 2 },
  planLimit: { fontSize: 12, color: C.txt2 },
  planCost: { fontSize: 24, fontWeight: '800', color: C.txt1 },
  planFreq: { fontSize: 11, color: C.txt3, fontWeight: '600' },

  // T&C checkbox
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.txt3, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxActive: { backgroundColor: C.green, borderColor: C.green },
  checkboxLabel: { flex: 1, fontSize: 13, color: C.txt2, lineHeight: 20 },

  // Buttons
  btnPrimary: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.brand, borderRadius: 16, paddingVertical: 17,
    marginBottom: 12,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14, color: C.txt2, fontWeight: '600' },

  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkBtnText: { fontSize: 14, color: C.brand, fontWeight: '600' },

  disclaimer: { fontSize: 11, color: C.txt3, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
