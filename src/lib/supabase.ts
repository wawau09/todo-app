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

// Validate Supabase URL and Key
const isValidUrl = (url: string) => /^https?:\/\/[^\s]+$/.test(url);
if (!isValidUrl(SUPABASE_URL) || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL 또는 ANON KEY가 누락되었거나 올바르지 않습니다. .env 파일에 EXPO_PUBLIC_SUPABASE_URL 및 EXPO_PUBLIC_SUPABASE_ANON_KEY 를 설정해주세요.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: {},
});
