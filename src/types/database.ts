export interface Profile {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyGoal {
  id: string;
  user_id: string;
  year_month: string; // YYYY-MM
  title: string;
  description: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  is_recurring: boolean;
  due_date: string | null; // YYYY-MM-DD
  recurring_days: number[]; // 0 (Sun) ~ 6 (Sat)
  is_completed: boolean; // For non-recurring todos
  created_at: string;
  updated_at: string;
  // Runtime augmented fields
  is_done_today?: boolean;
}

export interface TodoCompletion {
  id: string;
  todo_id: string;
  user_id: string;
  completed_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface FriendDashboardItem {
  friend_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  monthly_goal_title: string | null;
  total_todos: number;
  completed_todos: number;
  progress_percentage: number;
}

export interface TodoProgress {
  totalCount: number;
  completedCount: number;
  percentage: number;
  loading: boolean;
}
