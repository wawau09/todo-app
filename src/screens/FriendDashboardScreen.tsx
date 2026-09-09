import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FriendDashboardItem } from '../types/database';
import { ProgressBar } from '../components/ProgressBar';

const DEMO_FRIENDS: FriendDashboardItem[] = [
  {
    friend_id: 'demo-1',
    username: 'jiwon_runner',
    full_name: '이지원',
    avatar_url: null,
    monthly_goal_title: '매일 5km 러닝 & 마라톤 완주',
    total_todos: 5,
    completed_todos: 4,
    progress_percentage: 80.0,
  },
  {
    friend_id: 'demo-2',
    username: 'coder_minsu',
    full_name: '김민수',
    avatar_url: null,
    monthly_goal_title: '알고리즘 100제 & 사이드 프로젝트 런칭',
    total_todos: 4,
    completed_todos: 4,
    progress_percentage: 100.0,
  },
  {
    friend_id: 'demo-3',
    username: 'study_sujin',
    full_name: '박수진',
    avatar_url: null,
    monthly_goal_title: '토익 900점 달성 및 영단어 암기',
    total_todos: 6,
    completed_todos: 2,
    progress_percentage: 33.3,
  },
];

export const FriendDashboardScreen: React.FC = () => {
  const [friendsData, setFriendsData] = useState<FriendDashboardItem[]>(
    isSupabaseConfigured ? [] : DEMO_FRIENDS
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);

  // Today's date string: YYYY-MM-DD
  const todayDate = new Date().toISOString().split('T')[0];

  // Fetch Friend Dashboard via RPC
  const fetchDashboard = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_friends_dashboard', {
        p_target_date: todayDate,
      });

      if (error) {
        console.error('Error fetching friends dashboard:', error.message);
        return;
      }

      if (data) {
        setFriendsData(data as FriendDashboardItem[]);
      }
    } catch (err: any) {
      console.error('Unexpected error in fetchDashboard:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [todayDate]);

  useEffect(() => {
    fetchDashboard();

    if (!isSupabaseConfigured) return;

    // 친구들의 To-Do 변경 또는 완료 상태 변경 시 실시간 반영
    const todosChannel = supabase
      .channel('friends_realtime_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        () => fetchDashboard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todo_completions' },
        () => fetchDashboard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monthly_goals' },
        () => fetchDashboard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => fetchDashboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(todosChannel);
    };
  }, [fetchDashboard]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDashboard();
  };

  const renderFriendCard = ({ item }: { item: FriendDashboardItem }) => {
    // 달성률에 따른 동적 색상
    const getProgressColor = (pct: number) => {
      if (pct >= 80) return '#10B981'; // 초록
      if (pct >= 40) return '#6366F1'; // 인디고
      if (pct > 0) return '#F59E0B'; // 주황
      return '#94A3B8'; // 회색
    };

    const color = getProgressColor(item.progress_percentage);

    return (
      <View style={styles.card}>
        {/* 상단: 프로필 정보 및 달성률 퍼센트 */}
        <View style={styles.cardHeader}>
          <View style={styles.profileRow}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(item.full_name || item.username || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.friendName}>{item.full_name || item.username}</Text>
              <Text style={styles.friendUsername}>@{item.username}</Text>
            </View>
          </View>

          <View style={[styles.percentBadge, { backgroundColor: `${color}15` }]}>
            <Text style={[styles.percentText, { color }]}>{item.progress_percentage}%</Text>
          </View>
        </View>

        {/* 중단: 이달의 목표 표시 */}
        <View style={styles.goalSection}>
          <Feather name="flag" size={13} color="#6366F1" />
          <Text style={styles.goalText} numberOfLines={1}>
            {item.monthly_goal_title || '이번 달 등록된 목표가 없습니다.'}
          </Text>
        </View>

        {/* 하단: 프로그레스 바 & 완료 카운트 */}
        <View style={styles.progressSection}>
          <ProgressBar
            percentage={item.progress_percentage}
            height={10}
            color={color}
          />
          <View style={styles.progressFooter}>
            <Text style={styles.progressFooterText}>
              오늘 완료 {item.completed_todos} / 전체 {item.total_todos}
            </Text>
            {item.progress_percentage === 100 && item.total_todos > 0 && (
              <View style={styles.completePill}>
                <Ionicons name="sparkles" size={12} color="#10B981" />
                <Text style={styles.completePillText}>올클리어!</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.screenSubtitle}>친구들과 함께 달리는 목표</Text>
          <Text style={styles.screenTitle}>친구 현황판</Text>
        </View>
        <TouchableOpacity style={styles.syncBtn} onPress={onRefresh}>
          <Ionicons name="reload" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={friendsData}
        keyExtractor={(item) => item.friend_id}
        renderItem={renderFriendCard}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#6366F1']} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>아직 등록된 친구가 없습니다.</Text>
              <Text style={styles.emptySubtitle}>
                친구를 추가하고 서로의 일일 달성률을 응원해보세요!
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  syncBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  listContainer: {
    padding: 20,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
  },
  friendName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  friendUsername: {
    fontSize: 12,
    color: '#64748B',
  },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentText: {
    fontSize: 16,
    fontWeight: '800',
  },
  goalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
  },
  goalText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  progressSection: {
    gap: 6,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressFooterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  completePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completePillText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
