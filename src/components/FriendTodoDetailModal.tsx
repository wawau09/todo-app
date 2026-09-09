import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { FriendDashboardItem, Todo } from '../types/database';
import { ProgressBar } from './ProgressBar';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface FriendTodoDetailModalProps {
  visible: boolean;
  friend: FriendDashboardItem | null;
  onClose: () => void;
}

// 친구별 데모 To-Do 리스트 매핑
const DEMO_FRIEND_TODOS: Record<string, Todo[]> = {
  'demo-1': [
    {
      id: 'd1-1',
      user_id: 'demo-1',
      title: '아침 조깅 5km 달리기',
      is_recurring: true,
      due_date: null,
      recurring_days: [1, 2, 3, 4, 5],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd1-2',
      user_id: 'demo-1',
      title: '폼롤러 하체 스트레칭 20분',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: true,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd1-3',
      user_id: 'demo-1',
      title: '러닝 기록 인스타 스토리 인증',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: true,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd1-4',
      user_id: 'demo-1',
      title: '단백질 쉐이크 & 비타민 챙겨먹기',
      is_recurring: true,
      due_date: null,
      recurring_days: [0, 1, 2, 3, 4, 5, 6],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd1-5',
      user_id: 'demo-1',
      title: '마라톤 신청 사이트 확인하기',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: false,
    },
  ],
  'demo-2': [
    {
      id: 'd2-1',
      user_id: 'demo-2',
      title: '백준 골드 문제 1개 풀이',
      is_recurring: true,
      due_date: null,
      recurring_days: [1, 2, 3, 4, 5],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd2-2',
      user_id: 'demo-2',
      title: 'React Native 코드 리팩토링',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: true,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd2-3',
      user_id: 'demo-2',
      title: 'GitHub 커밋 및 잔디 심기',
      is_recurring: true,
      due_date: null,
      recurring_days: [0, 1, 2, 3, 4, 5, 6],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd2-4',
      user_id: 'demo-2',
      title: '기술 블로그 포스팅 초안 작성',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: true,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
  ],
  'demo-3': [
    {
      id: 'd3-1',
      user_id: 'demo-3',
      title: '해커스 노랭이 단어 Day 14 암기',
      is_recurring: true,
      due_date: null,
      recurring_days: [1, 2, 3, 4, 5],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd3-2',
      user_id: 'demo-3',
      title: '토익 RC 파트 5 오답노트 정리',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: true,
      created_at: '',
      updated_at: '',
      is_done_today: true,
    },
    {
      id: 'd3-3',
      user_id: 'demo-3',
      title: 'LC 파트 3 쉐도잉 30분',
      is_recurring: true,
      due_date: null,
      recurring_days: [1, 3, 5],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: false,
    },
    {
      id: 'd3-4',
      user_id: 'demo-3',
      title: '실전 모의고사 1회분 풀기',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: false,
    },
    {
      id: 'd3-5',
      user_id: 'demo-3',
      title: '스터디 과제 카페 업로드',
      is_recurring: false,
      due_date: '2026-09-10',
      recurring_days: [],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: false,
    },
    {
      id: 'd3-6',
      user_id: 'demo-3',
      title: '취침 전 단어 복습 10분',
      is_recurring: true,
      due_date: null,
      recurring_days: [0, 1, 2, 3, 4, 5, 6],
      is_completed: false,
      created_at: '',
      updated_at: '',
      is_done_today: false,
    },
  ],
};

export const FriendTodoDetailModal: React.FC<FriendTodoDetailModalProps> = ({
  visible,
  friend,
  onClose,
}) => {
  const [friendTodos, setFriendTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [cheered, setCheered] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !friend) return;
    setCheered(null);

    const fetchFriendTodos = async () => {
      if (!isSupabaseConfigured || friend.friend_id.startsWith('demo-')) {
        setFriendTodos(DEMO_FRIEND_TODOS[friend.friend_id] || []);
        return;
      }

      setLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();

        // 친구의 오늘 할 일 조회 (RLS 허용)
        const { data: todos, error } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', friend.friend_id)
          .or(`due_date.eq.${today},is_recurring.eq.true`);

        if (error) throw error;

        const filtered = (todos || []).filter((t: Todo) => {
          if (!t.is_recurring) return t.due_date === today;
          return Array.isArray(t.recurring_days) && t.recurring_days.includes(dayOfWeek);
        });

        const recIds = filtered.filter((t) => t.is_recurring).map((t) => t.id);
        let completedSet = new Set<string>();

        if (recIds.length > 0) {
          const { data: completions } = await supabase
            .from('todo_completions')
            .select('todo_id')
            .eq('user_id', friend.friend_id)
            .eq('completed_date', today)
            .in('todo_id', recIds);

          if (completions) {
            completedSet = new Set(completions.map((c) => c.todo_id));
          }
        }

        const resolved: Todo[] = filtered.map((item) => ({
          ...item,
          is_done_today: item.is_recurring ? completedSet.has(item.id) : item.is_completed,
        }));

        setFriendTodos(resolved);
      } catch (err: any) {
        console.error('Error fetching friend todos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFriendTodos();
  }, [visible, friend]);

  if (!friend) return null;

  const handleCheer = (emoji: string, text: string) => {
    setCheered(`${emoji} ${text}`);
    setTimeout(() => setCheered(null), 3000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* 상단 헤더 */}
          <View style={styles.header}>
            <View style={styles.friendProfileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(friend.full_name || friend.username || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.friendName}>{friend.full_name || friend.username}</Text>
                <Text style={styles.friendHandle}>@{friend.username}님의 오늘 할 일</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* 이달의 목표 */}
            <View style={styles.goalBox}>
              <Feather name="flag" size={14} color="#6366F1" />
              <Text style={styles.goalText}>
                {friend.monthly_goal_title || '등록된 이번 달 목표가 없습니다.'}
              </Text>
            </View>

            {/* 오늘 달성률 바 */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>오늘 달성률</Text>
                <Text style={styles.progressPercent}>{friend.progress_percentage}%</Text>
              </View>
              <ProgressBar percentage={friend.progress_percentage} height={10} color="#6366F1" />
              <Text style={styles.progressSub}>
                {friend.completed_todos}개 완료 / 총 {friend.total_todos}개
              </Text>
            </View>

            {/* 응원 배너 */}
            {cheered && (
              <View style={styles.cheerToast}>
                <Text style={styles.cheerToastText}>{friend.username}님에게 {cheered} 보냈어요!</Text>
              </View>
            )}

            {/* 친구의 오늘 할 일 목록 */}
            <Text style={styles.listTitle}>체크리스트 상세 내역</Text>

            {loading ? (
              <ActivityIndicator style={{ marginVertical: 30 }} color="#6366F1" />
            ) : friendTodos.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="inbox" size={32} color="#CBD5E1" />
                <Text style={styles.emptyText}>오늘 계획된 할 일이 없습니다.</Text>
              </View>
            ) : (
              friendTodos.map((todo) => (
                <View
                  key={todo.id}
                  style={[styles.todoItem, todo.is_done_today && styles.todoItemDone]}
                >
                  <Ionicons
                    name={todo.is_done_today ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={todo.is_done_today ? '#10B981' : '#CBD5E1'}
                  />
                  <View style={styles.todoTextCol}>
                    <Text
                      style={[styles.todoTitle, todo.is_done_today && styles.todoTitleDone]}
                    >
                      {todo.title}
                    </Text>
                    <View style={styles.badgeRow}>
                      {todo.is_recurring ? (
                        <Text style={styles.recurringTag}>반복 습관</Text>
                      ) : (
                        <Text style={styles.singleTag}>오늘 할 일</Text>
                      )}
                      {todo.is_done_today && (
                        <Text style={styles.doneTag}>달성 완료</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* 친구 응원하기 리액션 버튼 바 */}
            <View style={styles.cheerSection}>
              <Text style={styles.cheerLabel}>친구 응원하기</Text>
              <View style={styles.cheerBtnRow}>
                <TouchableOpacity
                  style={styles.cheerBtn}
                  onPress={() => handleCheer('👏', '박수 응원을')}
                >
                  <Text style={styles.cheerEmoji}>👏</Text>
                  <Text style={styles.cheerBtnLabel}>대단해요</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cheerBtn}
                  onPress={() => handleCheer('🔥', '열정 응원을')}
                >
                  <Text style={styles.cheerEmoji}>🔥</Text>
                  <Text style={styles.cheerBtnLabel}>화이팅</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cheerBtn}
                  onPress={() => handleCheer('❤️', '따뜻한 응원을')}
                >
                  <Text style={styles.cheerEmoji}>❤️</Text>
                  <Text style={styles.cheerBtnLabel}>응원해요</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  friendProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  friendHandle: {
    fontSize: 12,
    color: '#64748B',
  },
  closeBtn: {
    padding: 4,
  },
  scrollArea: {
    maxHeight: 520,
  },
  goalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6366F1',
  },
  progressSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'right',
  },
  cheerToast: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  cheerToastText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  todoItemDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  todoTextCol: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  todoTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  recurringTag: {
    fontSize: 10,
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '500',
  },
  singleTag: {
    fontSize: 10,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '500',
  },
  doneTag: {
    fontSize: 10,
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '600',
  },
  cheerSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cheerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  cheerBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cheerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  cheerEmoji: {
    fontSize: 16,
  },
  cheerBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
});
