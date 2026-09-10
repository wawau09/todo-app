import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ljopueoxjwvalndhpory.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_bblgkq2CwbrHYZ-97YIf_g_GmEL_ui-';

export const isSupabaseConfigured =
  Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL) &&
  !SUPABASE_URL.includes('https://ljopueoxjwvalndhpory.supabase.co');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: isSupabaseConfigured
    ? {}
    : {
      params: {
        eventsPerSecond: 0,
      },
    },
});
