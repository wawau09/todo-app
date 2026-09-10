import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// .env 로부터 읽어오며, .env 가 없을 경우 오류를 내도록 함
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: isSupabaseConfigured ? {} : { params: { eventsPerSecond: 0 } },
});
