import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, LogOut, Save, Shield } from 'lucide-react-native';
import { ApiService, User } from '@/services/api';

const C = {
  bgPrimary: '#F5F5F7', bgCard: '#FFFFFF',
  txt1: '#1C1C1E', txt2: '#6E6E73', txt3: '#AEAEB2',
  green: '#22C55E', amber: '#F59E0B', red: '#EF4444', border: '#E5E5EA',
};
const SHADOW = { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 };

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [workZone, setWorkZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const d = await ApiService.getProfile();
      setUser(d.user);
      setWorkZone(d.user.work_zone || '');
    } catch { Alert.alert('Error', 'Failed to load profile'); }
    finally { setLoading(false); }
  };

  const handleSaveZone = async () => {
    if (!workZone.trim()) { Alert.alert('Error', 'Please enter a zone.'); return; }
    setSaving(true);
    try {
      await ApiService.updateProfile({ work_zone: workZone });
      Alert.alert('Zone Updated', 'Parity is now monitoring your zone.');
      fetchProfile();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { ApiService.clearToken(); router.replace('/(auth)/login'); } },
    ]);

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={C.green} />
    </View>
  );

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'R';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Avatar hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.phone}>{user?.phone_number}</Text>
        <View style={[styles.kyc, { backgroundColor: user?.is_verified ? C.green + '18' : C.amber + '18' }]}>
          <View style={[styles.kycDot, { backgroundColor: user?.is_verified ? C.green : C.amber }]} />
          <Text style={[styles.kycText, { color: user?.is_verified ? C.green : C.amber }]}>
            {user?.is_verified ? 'KYC Verified' : 'Verification Pending'}
          </Text>
        </View>
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          {[
            ['Platform', user?.platform ?? '—'],
            ['Work City', user?.work_city ?? '—'],
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

      {/* Work Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>WORK ZONE</Text>
        <Text style={styles.sectionDesc}>
          Set your 3–5 km primary area. Parity monitors parametric triggers only in your zone.
        </Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <MapPin size={16} color={C.txt3} />
            <TextInput
              style={styles.input}
              value={workZone}
              onChangeText={setWorkZone}
              placeholder="e.g., Malviya Nagar, Delhi"
              placeholderTextColor={C.txt3}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveZone} disabled={saving}>
            {saving ? <ActivityIndicator color={C.green} size="small" /> : (
              <>
                <Save size={16} color={C.green} />
                <Text style={styles.saveBtnText}>Save Zone</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Security */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View style={styles.card}>
          <View style={styles.secRow}>
            <Shield size={18} color={C.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.secTitle}>Biometric Authentication</Text>
              <Text style={styles.secDesc}>During payout release, Parity requires fingerprint or FaceID to confirm you are holding the device.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sign out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={16} color={C.red} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

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

  hero: { alignItems: 'center', paddingTop: 64, paddingBottom: 32, backgroundColor: C.bgCard, marginBottom: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.txt1, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 24, fontWeight: '700', color: C.txt1, marginBottom: 4 },
  phone: { fontSize: 14, color: C.txt2, marginBottom: 14 },
  kyc: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  kycDot: { width: 7, height: 7, borderRadius: 4 },
  kycText: { fontSize: 12, fontWeight: '700' },

  section: { paddingHorizontal: 20, marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.txt3, letterSpacing: 1, marginBottom: 10 },
  sectionDesc: { fontSize: 12, color: C.txt2, marginBottom: 12, lineHeight: 18 },
  card: { backgroundColor: C.bgCard, borderRadius: 16, padding: 18, ...SHADOW },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { fontSize: 13, color: C.txt2 },
  rowValue: { fontSize: 13, color: C.txt1, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontSize: 14, color: C.txt1 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: C.green },

  secRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  secTitle: { fontSize: 14, fontWeight: '700', color: C.txt1, marginBottom: 4 },
  secDesc: { fontSize: 12, color: C.txt2, lineHeight: 18 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.bgCard, borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: C.red + '44', ...SHADOW,
  },
  logoutText: { color: C.red, fontSize: 14, fontWeight: '700' },

  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: C.txt3, fontSize: 12 },
});
