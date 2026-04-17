import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// Keys are confirmed valid (sb_publishable_... format is correct for supabase-js v2.39+)
// Note: Realtime triggers only fire for inserts into THIS Supabase project's tables.
// The backend uses a separate PostgreSQL on Render, so Realtime is used for
// manual event triggers only. Use "Simulate Disruption" for the demo.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
