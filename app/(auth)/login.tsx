import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, Phone, Lock } from 'lucide-react-native';
import { ApiService } from '@/services/api';

const C = {
  bgPrimary: '#F5F5F7', bgCard: '#FFFFFF',
  txt1: '#1C1C1E', txt2: '#6E6E73', txt3: '#AEAEB2',
  green: '#22C55E', border: '#E5E5EA',
};

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      Alert.alert('Missing Info', 'Please fill in your phone number and password.');
      return;
    }
    setLoading(true);
    try {
      await ApiService.login(phoneNumber, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bgPrimary }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoWrap}>
            <Shield size={30} color={C.green} />
          </View>
          <Text style={styles.wordmark}>Parity</Text>
          <Text style={styles.tagline}>AI-Parametric Safety Net for Riders</Text>
        </View>

        {/* Form card */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSubtitle}>Sign in to your account</Text>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrap}>
              <Phone size={16} color={C.txt3} />
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+91 98765 43210"
                placeholderTextColor={C.txt3}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Lock size={16} color={C.txt3} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={C.txt3}
                secureTextEntry
              />
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.cta}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.link}>
            <Text style={styles.linkText}>
              New rider?{'  '}<Text style={styles.linkBold}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          By signing in you agree to Parity's income-protection terms
        </Text>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  brand: { alignItems: 'center', marginBottom: 36 },
  logoWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  wordmark: { fontSize: 36, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: '#6E6E73', marginTop: 4 },

  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  formSubtitle: { fontSize: 14, color: '#6E6E73', marginBottom: 24 },

  fieldGroup: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5F5F7', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  input: { flex: 1, fontSize: 15, color: '#1C1C1E' },

  cta: {
    backgroundColor: '#1C1C1E', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  link: { alignItems: 'center' },
  linkText: { color: '#6E6E73', fontSize: 14 },
  linkBold: { color: '#22C55E', fontWeight: '700' },

  disclaimer: { color: '#AEAEB2', fontSize: 11, textAlign: 'center', marginTop: 28 },
});
