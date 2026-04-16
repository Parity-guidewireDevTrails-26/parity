import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, LogOut, Save, Edit2, X, Check, Smartphone, Shield } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { ApiService, User } from '@/services/api';
import { C, FONT, RADIUS, SHADOW } from '@/utils/theme';

const PLATFORMS = ['Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'Porter'];

// FEATURE 1: Trust Score Arc using SVG
function TrustArc({ score }: { score: number }) {
  const size = 88;
  const strokeWidth = 6;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  // 270-degree arc (start at bottom-left, end at bottom-right)
  const arcFraction = 0.75;
  const dashArray = circumference * arcFraction;
  const dashOffset = dashArray * (1 - score);

  const color =
    score >= 0.85 ? C.green :
    score >= 0.6  ? C.amber : C.red;

  const label =
    score >= 0.85 ? 'Excellent' :
    score >= 0.6  ? 'Good'      : 'Building';

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {/* Track */}
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={C.border} strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${dashArray} ${circumference}`}
            strokeLinecap="round"
            rotation={135}
            origin={`${cx}, ${cy}`}
          />
          {/* Fill */}
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={color} strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${dashArray} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation={135}
            origin={`${cx}, ${cy}`}
          />
        </Svg>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: FONT.lg, fontWeight: FONT.heavy, color: C.txt1 }}>
            {Math.round(score * 100)}
          </Text>
          <Text style={{ fontSize: 9, color: C.txt3, fontWeight: FONT.bold, letterSpacing: 0.5 }}>
            TRUST
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: FONT.xs, fontWeight: FONT.semibold, color, marginTop: 6 }}>
        {label}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editZone, setEditZone] = useState('');
  const [editPlatform, setEditPlatform] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const d = await ApiService.getProfile();
      setUser(d.user);
      setEditName(d.user.name);
      setEditCity(d.user.work_city);
      setEditZone(d.user.work_zone ?? '');
      setEditPlatform(d.user.platform);
    } catch {
      Alert.alert('Error', 'Failed to load profile. Please log in again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim() || !editCity.trim()) {
      Alert.alert('Missing Fields', 'Name and city are required.');
      return;
    }
    setSaving(true);
    try {
      await ApiService.updateProfile({
        name: editName,
        work_city: editCity,
        work_zone: editZone,
        platform: editPlatform,
      });
      Alert.alert('Profile Updated', 'Your details are saved.');
      setEditing(false);
      fetchProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () =>
    Alert.alert('Sign Out', 'You will need to log in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => { ApiService.clearToken(); router.replace('/(auth)/login'); },
      },
    ]);

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={C.green} />
    </View>
  );

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'R';
  const fp = user?.device_fingerprint;
  const trust = user?.trust_score ?? 0.92;

  // Trust perks
  const perkUnlocked = trust >= 0.85;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroInner}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          {!editing ? (
            <View style={{ flex: 1, paddingLeft: 18 }}>
              <Text style={styles.name}>{user?.name}</Text>
              <Text style={styles.phone}>{user?.phone_number}</Text>
              <View style={[styles.kycBadge, {
                backgroundColor: user?.is_verified ? C.greenBg : C.amberBg,
              }]}>
                <View style={[styles.kycDot, {
                  backgroundColor: user?.is_verified ? C.green : C.amber,
                }]} />
                <Text style={[styles.kycText, {
                  color: user?.is_verified ? C.green : C.amber,
                }]}>
                  {user?.is_verified ? 'Verified' : 'Pending Verification'}
                </Text>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Edit2 size={12} color={C.brand} />
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, paddingLeft: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.editingLabel}>Editing Profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <X size={18} color={C.txt3} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* FEATURE 1 — Trust Score Panel */}
      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRUST SCORE</Text>
          <View style={styles.trustCard}>
            <TrustArc score={trust} />
            <View style={styles.trustInfo}>
              <Text style={styles.trustHeading}>Parity Trust Index</Text>
              <Text style={styles.trustDesc}>
                Your score improves with every fraud-free payout cycle. Workers above 85 unlock priority payouts and lower premiums.
              </Text>

              {/* Weekly notches */}
              <View style={styles.trustHistory}>
                {[0.71, 0.78, 0.83, 0.88, 0.92].map((v, i) => (
                  <View key={i} style={styles.trustBarWrap}>
                    <View
                      style={[
                        styles.trustBar,
                        {
                          height: Math.round(v * 28),
                          backgroundColor: v >= 0.85 ? C.green : C.amber,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <Text style={styles.trustHistoryLabel}>Last 5 weeks</Text>

              {perkUnlocked && (
                <View style={styles.perkBadge}>
                  <Check size={11} color={C.green} />
                  <Text style={styles.perkText}>Platinum-tier payout speed unlocked</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Edit Form */}
      {editing && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EDIT DETAILS</Text>
          <View style={styles.card}>
            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your full name"
                placeholderTextColor={C.txt3}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.divider} />

            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>Working City</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={13} color={C.txt3} />
                <TextInput
                  style={[styles.editInput, { flex: 1 }]}
                  value={editCity}
                  onChangeText={setEditCity}
                  placeholder="e.g. New Delhi"
                  placeholderTextColor={C.txt3}
                  autoCapitalize="words"
                />
              </View>
            </View>
            <View style={styles.divider} />

            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>Work Zone</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={13} color={C.txt3} />
                <TextInput
                  style={[styles.editInput, { flex: 1 }]}
                  value={editZone}
                  onChangeText={setEditZone}
                  placeholder="e.g. Malviya Nagar, Delhi"
                  placeholderTextColor={C.txt3}
                />
              </View>
            </View>
            <View style={styles.divider} />

            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>Gig Platform</Text>
              <View style={styles.platformGrid}>
                {PLATFORMS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.platformPill, editPlatform === p && styles.platformActive]}
                    onPress={() => setEditPlatform(p)}
                  >
                    <Text style={[styles.platformText, editPlatform === p && { color: '#fff' }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <>
                  <Save size={15} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
          </TouchableOpacity>
        </View>
      )}

      {/* Account Info */}
      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.card}>
            {[
              ['Platform',     user?.platform ?? '—'],
              ['Work City',    user?.work_city ?? '—'],
              ['Work Zone',    user?.work_zone || 'Not set'],
              ['Zone Cluster', user?.zone_cluster_id ?? 'DEL-SAKET-01'],
            ].map(([label, value], i, arr) => (
              <View key={label as string}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowValue}>{value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Device Security */}
      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DEVICE SECURITY</Text>
          <View style={styles.card}>
            <View style={styles.secRow}>
              <View style={[styles.secIconWrap, { backgroundColor: C.amberBg }]}>
                <Shield size={16} color={C.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.secTitle}>Biometric Authentication</Text>
                <Text style={styles.secDesc}>
                  For Platinum-tier payouts, a fingerprint or Face ID check is required at the moment of payout trigger.
                </Text>
              </View>
            </View>

            {fp && (
              <>
                <View style={styles.divider} />
                <View style={styles.secRow}>
                  <View style={[styles.secIconWrap, { backgroundColor: C.greenBg }]}>
                    <Smartphone size={16} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.secTitle}>Device Fingerprint Captured</Text>
                    <Text style={[styles.secDesc, { fontFamily: 'monospace', fontSize: FONT.xs }]}>
                      ID: {fp.hardware_uuid}{'\n'}
                      OS: {fp.os_version}{'\n'}
                      Root: Clean
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.secBadge}>
                  <Check size={11} color={C.green} />
                  <Text style={styles.secBadgeText}>
                    Device bound to this account. Fraud detection active.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Sign Out */}
      {!editing && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={15} color={C.red} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Parity v1.0 — AI-Parametric Safety Net</Text>
      </View>
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgPrimary },

  // Hero
  hero: {
    backgroundColor: C.bgCard, paddingTop: 64, paddingBottom: 24,
    paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: C.border,
    marginBottom: 10,
  },
  heroInner: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 72, height: 72, borderRadius: RADIUS.full,
    backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: FONT.xl, fontWeight: FONT.heavy, color: '#fff' },
  name: {
    fontSize: FONT.lg, fontWeight: FONT.heavy, color: C.txt1,
    letterSpacing: FONT.tight, marginBottom: 4,
  },
  phone: { fontSize: FONT.sm, color: C.txt3, marginBottom: 10 },
  kycBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  kycDot: { width: 6, height: 6, borderRadius: 3 },
  kycText: { fontSize: FONT.xs, fontWeight: FONT.bold },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: `${C.brand}33`, alignSelf: 'flex-start',
  },
  editBtnText: { fontSize: FONT.xs, color: C.brand, fontWeight: FONT.semibold },
  editingLabel: { fontSize: FONT.base, fontWeight: FONT.bold, color: C.txt1 },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 18 },
  sectionLabel: {
    fontSize: FONT.xs, fontWeight: FONT.bold, color: C.txt3,
    letterSpacing: FONT.wider, marginBottom: 10, marginTop: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: C.bgCard, borderRadius: RADIUS.lg,
    padding: 18, borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: FONT.sm, color: C.txt2 },
  rowValue: { fontSize: FONT.sm, color: C.txt1, fontWeight: FONT.semibold },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  // FEATURE 1 — Trust Score
  trustCard: {
    backgroundColor: C.bgCard, borderRadius: RADIUS.lg,
    padding: 20, flexDirection: 'row', gap: 20,
    borderWidth: 1, borderColor: C.border, ...SHADOW.sm,
  },
  trustInfo: { flex: 1 },
  trustHeading: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, marginBottom: 6 },
  trustDesc: { fontSize: FONT.xs, color: C.txt2, lineHeight: 17, marginBottom: 14 },
  trustHistory: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 32, marginBottom: 4 },
  trustBarWrap: { flex: 1, justifyContent: 'flex-end' },
  trustBar: { borderRadius: 3, minHeight: 4 },
  trustHistoryLabel: { fontSize: 10, color: C.txt3, marginBottom: 10 },
  perkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.greenBg, borderRadius: RADIUS.md,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  perkText: { fontSize: FONT.xs, color: C.green, fontWeight: FONT.semibold, flex: 1 },

  // Edit form
  editField: { marginBottom: 4 },
  fieldLabel: {
    fontSize: FONT.xs, fontWeight: FONT.bold, color: C.txt3,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  editInput: { fontSize: FONT.base, color: C.txt1, paddingVertical: 4 },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  platformPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSubtle,
  },
  platformActive: { backgroundColor: C.brand, borderColor: C.brand },
  platformText: { fontSize: FONT.sm, fontWeight: FONT.semibold, color: C.txt2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.brand, borderRadius: RADIUS.md, paddingVertical: 15, marginTop: 12,
  },
  saveBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: FONT.bold },

  // Security
  secRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  secIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  secTitle: { fontSize: FONT.sm, fontWeight: FONT.bold, color: C.txt1, marginBottom: 4 },
  secDesc: { fontSize: FONT.xs, color: C.txt2, lineHeight: 18 },
  secBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.greenBg, borderRadius: RADIUS.md, padding: 10,
  },
  secBadgeText: { fontSize: FONT.xs, color: C.green, fontWeight: FONT.semibold },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.bgCard, borderRadius: RADIUS.md, paddingVertical: 15,
    borderWidth: 1, borderColor: `${C.red}44`,
  },
  logoutText: { color: C.red, fontSize: FONT.sm, fontWeight: FONT.bold },

  footer: { alignItems: 'center', paddingVertical: 20 },
  footerText: { color: C.txt3, fontSize: FONT.xs },
});
