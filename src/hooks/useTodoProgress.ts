import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TodoProgress } from '../types/database';

interface UseTodoProgressOptions {
  userId?: string;
  targetDate?: string; // YYYY-MM-DD format (defaults to current local date)
  enableRealtime?: boolean;
}

export function useTodoProgress({
  userId,
  targetDate,
  enableRealtime = true,
}: UseTodoProgressOptions = {}) {
  const [progress, setProgress] = useState<TodoProgress>({
    totalCount: 0,
    completedCount: 0,
    percentage: 0,
    loading: true,
  });

  const getEffectiveDate = useCallback(() => {
    if (targetDate) return targetDate;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [targetDate]);

  const fetchProgress = useCallback(async () => {
    try {
      // If userId is not provided, use the currently logged-in user
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: authData } = await supabase.auth.getUser();
        targetUserId = authData?.user?.id;
      }

      if (!targetUserId) {
        setProgress((prev) => ({ ...prev, loading: false }));
        return;
      }

      const dateStr = getEffectiveDate();

      // RPC 호출: DB 내부에서 반복 요일 및 단일 날짜 완료 내역을 종합 계산
      const { data, error } = await supabase.rpc('calculate_daily_progress', {
        p_user_id: targetUserId,
        p_target_date: dateStr,
      });

      if (error) {
        console.warn('RPC calculate_daily_progress error, calculating fallback:', error.message);
        // Fallback: 직접 테이블 쿼리로 계산
        await calculateFallbackProgress(targetUserId, dateStr);
        return;
      }

      if (data) {
        const total = Number(data.total_count) || 0;
        const completed = Number(data.completed_count) || 0;
        const percentage = Number(data.percentage) || 0;

        setProgress({
          totalCount: total,
          completedCount: completed,
          percentage: total === 0 ? 0 : percentage,
          loading: false,
        });
      }
    } catch (err) {
      console.error('Error fetching todo progress:', err);
      setProgress((prev) => ({ ...prev, loading: false }));
    }
  }, [userId, getEffectiveDate]);

  // Fallback client-side calculation
  const calculateFallbackProgress = async (uid: string, dateStr: string) => {
    const dayOfWeek = new Date(dateStr).getDay(); // 0: Sun ~ 6: Sat

    // 1. Fetch todos (single date matching OR recurring days containing today's DOW)
    const { data: todos, error: todosErr } = await supabase
      .from('todos')
      .select('id, is_recurring, is_completed, recurring_days, due_date')
      .eq('user_id', uid)
      .or(`due_date.eq.${dateStr},is_recurring.eq.true`);

    if (todosErr || !todos) {
      setProgress({ totalCount: 0, completedCount: 0, percentage: 0, loading: false });
      return;
    }

    // Filter relevant todos for dateStr
    const relevantTodos = todos.filter((t) => {
      if (!t.is_recurring) return t.due_date === dateStr;
      return Array.isArray(t.recurring_days) && t.recurring_days.includes(dayOfWeek);
    });

    if (relevantTodos.length === 0) {
      setProgress({ totalCount: 0, completedCount: 0, percentage: 0, loading: false });
      return;
    }

    // 2. Fetch recurring completions for today
    const recurringTodoIds = relevantTodos.filter((t) => t.is_recurring).map((t) => t.id);
    let completedRecurringIds = new Set<string>();

    if (recurringTodoIds.length > 0) {
      const { data: completions } = await supabase
        .from('todo_completions')
        .select('todo_id')
        .eq('user_id', uid)
        .eq('completed_date', dateStr)
        .in('todo_id', recurringTodoIds);

      if (completions) {
        completedRecurringIds = new Set(completions.map((c) => c.todo_id));
      }
    }

    let completedCount = 0;
    relevantTodos.forEach((t) => {
      if (!t.is_recurring && t.is_completed) completedCount++;
      else if (t.is_recurring && completedRecurringIds.has(t.id)) completedCount++;
    });

    const totalCount = relevantTodos.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 1000) / 10 : 0;

    setProgress({
      totalCount,
      completedCount,
      percentage,
      loading: false,
    });
  };

  useEffect(() => {
    fetchProgress();

    if (!enableRealtime) return;

    // Realtime 구독: todos 또는 todo_completions에 변경 발생 시 즉각 재산출
    const channel = supabase
      .channel(`todo_progress_${userId || 'current'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        () => fetchProgress()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todo_completions' },
        () => fetchProgress()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProgress, enableRealtime, userId]);

  return { ...progress, refetch: fetchProgress };
}
