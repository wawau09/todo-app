import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// .env 로부터 읽어오며, 값이 없을 경우 Expo Constants에서 가져옵니다.
import Constants from 'expo-constants';
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants?.manifest?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
  '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants?.manifest?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// If env vars are missing, warn but still create a client with placeholder values to avoid null reference.
export const supabase = (() => {
  if (!isSupabaseConfigured) {
    console.warn('Supabase environment variables are not set. Using placeholder values.');
    const placeholderUrl = 'https://example.supabase.co';
    const placeholderKey = 'public-anon-key';
    return createClient(placeholderUrl, placeholderKey, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      realtime: {},
    });
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
    realtime: {},
  });
})();
