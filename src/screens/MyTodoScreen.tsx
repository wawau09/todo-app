import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTodoProgress } from '../hooks/useTodoProgress';
import { ProgressBar } from '../components/ProgressBar';
import { Todo, MonthlyGoal } from '../types/database';

const DAYS_OF_WEEK = [
  { id: 0, label: '일' },
  { id: 1, label: '월' },
  { id: 2, label: '화' },
  { id: 3, label: '수' },
  { id: 4, label: '목' },
  { id: 5, label: '금' },
  { id: 6, label: '토' },
];

export const MyTodoScreen: React.FC = () => {
  // Current user info & selected date
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const currentYearMonth = selectedDate.substring(0, 7); // 'YYYY-MM'

  // Progress Hook
  const { totalCount, completedCount, percentage, refetch: refetchProgress } = useTodoProgress({
    userId: userId ?? undefined,
    targetDate: selectedDate,
  });

  // State
  const [monthlyGoal, setMonthlyGoal] = useState<MonthlyGoal | null>(null);
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [goalInput, setGoalInput] = useState<string>('');

  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State for Adding To-Do
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [todoTitle, setTodoTitle] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // 1. Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  // 2. Fetch Monthly Goal
  const fetchMonthlyGoal = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('monthly_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('year_month', currentYearMonth)
      .maybeSingle();

    if (!error && data) {
      setMonthlyGoal(data);
      setGoalInput(data.title);
    } else {
      setMonthlyGoal(null);
      setGoalInput('');
    }
  }, [userId, currentYearMonth]);

  // 3. Fetch Todos for selected date (both specific date and recurring)
  const fetchTodos = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const dayOfWeek = new Date(selectedDate).getDay();

      // 특정 날짜 할 일 OR 반복 할 일 조회
      const { data: todosData, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .or(`due_date.eq.${selectedDate},is_recurring.eq.true`);

      if (error) throw error;

      // 필터: 오늘에 해당하는 요일을 포함한 반복 할 일 + 오늘 특정 할 일
      const filtered = (todosData || []).filter((item: Todo) => {
        if (!item.is_recurring) return item.due_date === selectedDate;
        return Array.isArray(item.recurring_days) && item.recurring_days.includes(dayOfWeek);
      });

      // 반복 할 일의 오늘 완료 여부 파악 (todo_completions 조회)
      const recurringIds = filtered.filter((t) => t.is_recurring).map((t) => t.id);
      let completedSet = new Set<string>();

      if (recurringIds.length > 0) {
        const { data: completions } = await supabase
          .from('todo_completions')
          .select('todo_id')
          .eq('user_id', userId)
          .eq('completed_date', selectedDate)
          .in('todo_id', recurringIds);

        if (completions) {
          completedSet = new Set(completions.map((c) => c.todo_id));
        }
      }

      // 최종 UI 모델 매핑
      const resolvedTodos: Todo[] = filtered.map((item) => ({
        ...item,
        is_done_today: item.is_recurring ? completedSet.has(item.id) : item.is_completed,
      }));

      setTodos(resolvedTodos);
    } catch (err: any) {
      console.error('Error fetching todos:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedDate]);

  useEffect(() => {
    if (userId) {
      fetchMonthlyGoal();
      fetchTodos();
    }
  }, [userId, selectedDate, fetchMonthlyGoal, fetchTodos]);

  // 이달의 목표 저장 / 수정
  const handleSaveMonthlyGoal = async () => {
    if (!userId || !goalInput.trim()) return;
    try {
      const { data, error } = await supabase
        .from('monthly_goals')
        .upsert(
          {
            user_id: userId,
            year_month: currentYearMonth,
            title: goalInput.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,year_month' }
        )
        .select()
        .single();

      if (error) throw error;
      setMonthlyGoal(data);
      setIsEditingGoal(false);
    } catch (err: any) {
      Alert.alert('오류', '목표 저장 실패: ' + err.message);
    }
  };

  // 할 일 추가
  const handleCreateTodo = async () => {
    if (!userId) {
      Alert.alert('로그인 필요', '할 일을 추가하려면 로그인이 필요합니다.');
      return;
    }
    if (!todoTitle.trim()) {
      Alert.alert('입력 확인', '할 일 내용을 입력해주세요.');
      return;
    }
    if (isRecurring && selectedDays.length === 0) {
      Alert.alert('요일 선택', '반복할 요일을 하나 이상 선택해주세요.');
      return;
    }

    try {
      const newTodoPayload = {
        user_id: userId,
        title: todoTitle.trim(),
        is_recurring: isRecurring,
        due_date: isRecurring ? null : selectedDate,
        recurring_days: isRecurring ? selectedDays : [],
        is_completed: false,
      };

      const { error } = await supabase.from('todos').insert(newTodoPayload);
      if (error) throw error;

      // Reset Modal Form
      setTodoTitle('');
      setIsRecurring(false);
      setSelectedDays([]);
      setIsModalOpen(false);

      fetchTodos();
      refetchProgress();
    } catch (err: any) {
      Alert.alert('오류', '할 일 생성 실패: ' + err.message);
    }
  };

  // 할 일 토글 (체크 / 해제)
  const handleToggleTodo = async (todo: Todo) => {
    if (!userId) return;

    const willBeDone = !todo.is_done_today;

    // 낙관적 UI 업데이트
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, is_done_today: willBeDone } : t))
    );

    try {
      if (todo.is_recurring) {
        // 반복 할 일: todo_completions 테이블 레코드 생성/삭제
        if (willBeDone) {
          await supabase.from('todo_completions').insert({
            todo_id: todo.id,
            user_id: userId,
            completed_date: selectedDate,
          });
        } else {
          await supabase
            .from('todo_completions')
            .delete()
            .eq('todo_id', todo.id)
            .eq('completed_date', selectedDate);
        }
      } else {
        // 단일 날짜 할 일: todos 테이블의 is_completed 컬럼 업데이트
        await supabase
          .from('todos')
          .update({ is_completed: willBeDone, updated_at: new Date().toISOString() })
          .eq('id', todo.id);
      }

      refetchProgress();
    } catch (err: any) {
      console.error('Toggle failed:', err);
      // 롤백
      fetchTodos();
      refetchProgress();
    }
  };

  // 요일 선택 토글
  const toggleDaySelection = (dayId: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 상단 헤더 및 날짜 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>나의 일일 달성도</Text>
            <Text style={styles.headerTitle}>{selectedDate}</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
            <Text style={styles.addButtonText}>할 일 추가</Text>
          </TouchableOpacity>
        </View>

        {/* 1. 이달의 메인 목표 카드 */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeaderRow}>
            <View style={styles.goalBadge}>
              <Feather name="target" size={14} color="#6366F1" />
              <Text style={styles.goalBadgeText}>{currentYearMonth} 메인 목표</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsEditingGoal((prev) => !prev)}
              style={styles.editGoalBtn}
            >
              <Text style={styles.editGoalBtnText}>
                {isEditingGoal ? '닫기' : monthlyGoal ? '수정' : '등록'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingGoal ? (
            <View style={styles.goalInputRow}>
              <TextInput
                style={styles.goalTextInput}
                placeholder="이번 달 달성하고 싶은 핵심 목표를 적으세요"
                placeholderTextColor="#94A3B8"
                value={goalInput}
                onChangeText={setGoalInput}
              />
              <TouchableOpacity style={styles.goalSaveBtn} onPress={handleSaveMonthlyGoal}>
                <Text style={styles.goalSaveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.goalTitleText}>
              {monthlyGoal ? monthlyGoal.title : '아직 설정된 이번 달 목표가 없습니다.'}
            </Text>
          )}
        </View>

        {/* 2. 오늘 달성률 (%) 카드 */}
        <View style={styles.progressCard}>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressTitle}>오늘의 달성률</Text>
            <Text style={styles.progressPercent}>{percentage}%</Text>
          </View>
          <ProgressBar percentage={percentage} height={12} color="#6366F1" />
          <Text style={styles.progressSubtext}>
            총 {totalCount}개 중 {completedCount}개 완료
          </Text>
        </View>

        {/* 3. 할 일 목록 리스트 */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>오늘의 체크리스트</Text>
          {todos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="check-circle" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>오늘 계획된 할 일이 없습니다.</Text>
            </View>
          ) : (
            todos.map((todo) => (
              <TouchableOpacity
                key={todo.id}
                style={[styles.todoItem, todo.is_done_today && styles.todoItemCompleted]}
                onPress={() => handleToggleTodo(todo)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={todo.is_done_today ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={todo.is_done_today ? '#6366F1' : '#94A3B8'}
                />
                <View style={styles.todoDetails}>
                  <Text
                    style={[
                      styles.todoTitle,
                      todo.is_done_today && styles.todoTitleCompleted,
                    ]}
                  >
                    {todo.title}
                  </Text>
                  <View style={styles.tagRow}>
                    {todo.is_recurring ? (
                      <View style={styles.repeatBadge}>
                        <Feather name="repeat" size={11} color="#3B82F6" />
                        <Text style={styles.repeatBadgeText}>
                          매주 {todo.recurring_days.map((d) => DAYS_OF_WEEK[d]?.label).join(', ')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.singleDateBadge}>
                        <Feather name="calendar" size={11} color="#64748B" />
                        <Text style={styles.singleDateText}>{todo.due_date}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* 할 일 추가 모달 */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>새 할 일 등록</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="무엇을 완료할 계획인가요?"
              placeholderTextColor="#94A3B8"
              value={todoTitle}
              onChangeText={setTodoTitle}
            />

            {/* 반복 여부 스위칭 */}
            <View style={styles.recurringOptionRow}>
              <Text style={styles.label}>반복 실행 여부</Text>
              <View style={styles.toggleButtonGroup}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !isRecurring && styles.toggleBtnActive]}
                  onPress={() => setIsRecurring(false)}
                >
                  <Text style={[styles.toggleBtnText, !isRecurring && styles.toggleBtnTextActive]}>
                    특정 날짜
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, isRecurring && styles.toggleBtnActive]}
                  onPress={() => setIsRecurring(true)}
                >
                  <Text style={[styles.toggleBtnText, isRecurring && styles.toggleBtnTextActive]}>
                    요일 반복
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 요일 선택 버튼 그룹 (반복인 경우에만 노출) */}
            {isRecurring && (
              <View style={styles.daysSelector}>
                <Text style={styles.label}>반복 요일 선택</Text>
                <View style={styles.daysGrid}>
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <TouchableOpacity
                        key={day.id}
                        style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
                        onPress={() => toggleDaySelection(day.id)}
                      >
                        <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateTodo}>
              <Text style={styles.submitBtnText}>할 일 등록 완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  editGoalBtn: {
    padding: 4,
  },
  editGoalBtnText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },
  goalTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 4,
  },
  goalInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  goalTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  goalSaveBtn: {
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  goalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  progressPercent: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6366F1',
  },
  progressSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
  },
  listSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  todoItemCompleted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  todoDetails: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  todoTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 6,
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  repeatBadgeText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '500',
  },
  singleDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  singleDateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
    color: '#0F172A',
  },
  recurringOptionRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  toggleButtonGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
  },
  toggleBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#6366F1',
  },
  daysSelector: {
    marginBottom: 20,
  },
  daysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
