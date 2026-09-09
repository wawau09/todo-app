import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { MyTodoScreen } from './src/screens/MyTodoScreen';
import { FriendDashboardScreen } from './src/screens/FriendDashboardScreen';
import { AuthModal } from './src/components/AuthModal';
import { supabase, isSupabaseConfigured } from './src/lib/supabase';

interface UserInfo {
  id: string;
  email: string;
  username: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'my_todos' | 'friends'>('my_todos');
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // 세션 복원 및 인증 상태 리스너
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // 1. 기존 세션 확인
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .maybeSingle();

        setCurrentUser({
          id: data.user.id,
          email: data.user.email || '',
          username: profile?.username || data.user.email?.split('@')[0] || 'user',
        });
      }
    });

    // 2. 인증 상태 변화 구독
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle();

        setCurrentUser({
          id: session.user.id,
          email: session.user.email || '',
          username: profile?.username || session.user.email?.split('@')[0] || 'user',
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    Alert.alert('로그아웃', '정상적으로 로그아웃되었습니다.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 최상단 글로벌 앱 바 (브랜드 + 인증 상태) */}
      <View style={styles.topAppBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoIcon}>
            <Ionicons name="checkbox" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.brandText}>Together Do</Text>
        </View>

        {currentUser ? (
          <View style={styles.userProfileRow}>
            <View style={styles.userBadge}>
              <Feather name="user" size={12} color="#6366F1" />
              <Text style={styles.usernameText}>@{currentUser.username}</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="log-out" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => setIsAuthModalOpen(true)}
            activeOpacity={0.8}
          >
            <Feather name="log-in" size={14} color="#FFFFFF" />
            <Text style={styles.loginBtnText}>로그인 / 회원가입</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Screen Body */}
      <View style={styles.content}>
        {activeTab === 'my_todos' ? <MyTodoScreen /> : <FriendDashboardScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('my_todos')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'my_todos' ? 'checkbox' : 'checkbox-outline'}
            size={24}
            color={activeTab === 'my_todos' ? '#6366F1' : '#94A3B8'}
          />
          <Text style={[styles.navText, activeTab === 'my_todos' && styles.navTextActive]}>
            내 할 일
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'friends' ? 'people' : 'people-outline'}
            size={24}
            color={activeTab === 'friends' ? '#6366F1' : '#94A3B8'}
          />
          <Text style={[styles.navText, activeTab === 'friends' && styles.navTextActive]}>
            친구 현황판
          </Text>
        </TouchableOpacity>
      </View>

      {/* 인증 모달 */}
      <AuthModal
        visible={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  usernameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  logoutBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 74 : 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  navText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  navTextActive: {
    color: '#6366F1',
  },
});
