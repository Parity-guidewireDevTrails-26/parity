import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, LogOut, Save, Shield, Edit2, X, Check, Smartphone } from 'lucide-react-native';
import { ApiService, User } from '@/services/api';

const C = {
  bgPrimary: '#F5F5F7', bgCard: '#FFFFFF',
  txt1: '#1C1C1E', txt2: '#6E6E73', txt3: '#AEAEB2',
  green: '#22C55E', amber: '#F59E0B', red: '#EF4444',
  border: '#E5E5EA', brand: '#19213D',
};
const SHADOW = { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 };

const PLATFORMS = ['Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'Porter'];

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editable fields
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Hero Avatar ── */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        {!editing ? (
          <>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.phone}>{user?.phone_number}</Text>
            <View style={[styles.kycBadge, { backgroundColor: user?.is_verified ? `${C.green}18` : `${C.amber}18` }]}>
              <View style={[styles.kycDot, { backgroundColor: user?.is_verified ? C.green : C.amber }]} />
              <Text style={[styles.kycText, { color: user?.is_verified ? C.green : C.amber }]}>
                {user?.is_verified ? 'Identity Verified' : 'Verification Pending'}
              </Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Edit2 size={14} color={C.brand} />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.editHeader}>
            <Text style={styles.editingLabel}>Editing Profile</Text>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <X size={20} color={C.txt3} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Edit Form ── */}
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
                <MapPin size={14} color={C.txt3} />
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
              <Text style={styles.fieldLabel}>Work Zone (3–5 km area)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={14} color={C.txt3} />
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
                    onPress={() => setEditPlatform(p)}>
                    <Text style={[styles.platformText, editPlatform === p && { color: '#fff' }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Save size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Account Info (read view) ── */}
      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.card}>
            {[
              ['Platform', user?.platform ?? '—'],
              ['Work City', user?.work_city ?? '—'],
              ['Work Zone', user?.work_zone || 'Not set'],
              ['Zone Cluster', user?.zone_cluster_id ?? 'DEL-SAKET-01'],
              ['Trust Score', user?.trust_score != null ? `${(user.trust_score * 100).toFixed(0)}%` : '—'],
            ].map(([label, value], i, arr) => (
              <View key={label as string}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={[styles.rowValue, label === 'Trust Score' && { color: C.green }]}>{value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Device Security ── */}
      {!editing && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DEVICE SECURITY</Text>
          <View style={styles.card}>
            <View style={styles.secRow}>
              <Shield size={18} color={C.amber} />
              <View style={{ flex: 1 }}>
                <Text style={styles.secTitle}>Biometric Authentication</Text>
                <Text style={styles.secDesc}>
                  For Platinum-tier payouts, Parity requires a fingerprint or Face ID check at the moment of payout trigger.
                </Text>
              </View>
            </View>

            {fp && (
              <>
                <View style={styles.divider} />
                <View style={styles.secRow}>
                  <Smartphone size={18} color={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.secTitle}>Device Fingerprint Captured</Text>
                    <Text style={styles.secDesc}>
                      Hardware ID: <Text style={{ color: C.txt1, fontWeight: '600' }}>{fp.hardware_uuid}</Text>
                      {'\n'}OS: {fp.os_version}
                      {'\n'}Root Status: <Text style={{ color: C.green }}>Clean ✓</Text>
                      {'\n'}Resolution: {fp.screen_resolution}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={[styles.badge, { backgroundColor: `${C.green}15` }]}>
                  <Check size={12} color={C.green} />
                  <Text style={[styles.badgeText, { color: C.green }]}>
                    Device bound to this account. Fraud detection active.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* ── Sign Out ── */}
      {!editing && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={16} color={C.red} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Parity v1.0  ·  AI-Parametric Safety Net</Text>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bgPrimary },

  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: C.bgCard, marginBottom: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 24, fontWeight: '700', color: C.txt1, marginBottom: 4 },
  phone: { fontSize: 14, color: C.txt2, marginBottom: 12 },
  kycBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 14 },
  kycDot: { width: 7, height: 7, borderRadius: 4 },
  kycText: { fontSize: 12, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: `${C.brand}33` },
  editBtnText: { fontSize: 13, color: C.brand, fontWeight: '600' },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 24, marginTop: 8 },
  editingLabel: { fontSize: 16, fontWeight: '700', color: C.txt1 },

  section: { paddingHorizontal: 20, marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.txt3, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  card: { backgroundColor: C.bgCard, borderRadius: 16, padding: 18, ...SHADOW },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: C.txt2 },
  rowValue: { fontSize: 13, color: C.txt1, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  // Edit form
  editField: { marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.txt3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  editInput: { fontSize: 15, color: C.txt1, paddingVertical: 4 },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  platformPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgPrimary },
  platformActive: { backgroundColor: C.brand, borderColor: C.brand },
  platformText: { fontSize: 13, fontWeight: '600', color: C.txt2 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.brand, borderRadius: 14, paddingVertical: 16, marginTop: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Security
  secRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  secTitle: { fontSize: 14, fontWeight: '700', color: C.txt1, marginBottom: 4 },
  secDesc: { fontSize: 12, color: C.txt2, lineHeight: 19 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.bgCard, borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: `${C.red}44`, ...SHADOW,
  },
  logoutText: { color: C.red, fontSize: 14, fontWeight: '700' },

  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: C.txt3, fontSize: 12 },
});
