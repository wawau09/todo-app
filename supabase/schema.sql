-- ==============================================================================
-- 1. EXTENSIONS & SETUP
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. USERS (PROFILES)
-- auth.users와 1:1 매핑되는 사용자 프로필 테이블
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- auth.users 가입 시 자동으로 profiles 레코드를 생성하는 트리거 (500 에러 방지 처리)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
BEGIN
    -- 기본 사용자명 추출
    base_username := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
        'user'
    );
    
    final_username := base_username;

    -- 중복 방지: 동일 username이 이미 존재하는 경우 랜덤 해시 접미사 부착
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) THEN
        final_username := base_username || '_' || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 4);
    END IF;

    INSERT INTO public.profiles (id, email, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.id::TEXT || '@no-email.internal'),
        final_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', final_username),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = TIMEZONE('utc', NOW());

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- DB 트리거 오류로 인해 회원가입 자체가 500(Database error saving new user)으로 중단되는 것 방지
        RAISE WARNING 'handle_new_user trigger error: %', SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. MONTHLY GOALS (이달의 목표)
-- YYYY-MM 단위로 메인 목표 등록 및 관리
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.monthly_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- e.g. '2026-09'
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT uq_user_monthly_goal UNIQUE (user_id, year_month)
);

-- ==============================================================================
-- 4. TODOS (할 일 - 특정 날짜 및 반복 요일)
-- recurring_days: [0, 1, 2, 3, 4, 5, 6] (0: 일요일 ~ 6: 토요일)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    due_date DATE, -- 특정 날짜 할 일일 경우 지정 (is_recurring = false)
    recurring_days INTEGER[] DEFAULT '{}', -- 반복 요일 (0: 일요일, 1: 월요일, ..., 6: 토요일)
    is_completed BOOLEAN DEFAULT FALSE, -- 비반복 할 일용 완료 여부
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT check_todo_type CHECK (
        (is_recurring = TRUE AND array_length(recurring_days, 1) > 0) OR
        (is_recurring = FALSE AND due_date IS NOT NULL)
    )
);

-- ==============================================================================
-- 5. TODO_COMPLETIONS (반복 할 일 완료 기록)
-- 반복 할 일은 날짜마다 완료 상태가 다르므로 별도 테이블로 관리하여 정확한 히스토리 보존
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.todo_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT uq_todo_date_completion UNIQUE (todo_id, completed_date)
);

-- ==============================================================================
-- 6. FRIENDSHIPS (친구 관계 관리)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT check_different_friends CHECK (requester_id <> receiver_id),
    CONSTRAINT uq_friend_pair UNIQUE (requester_id, receiver_id)
);

-- 친구 확인 헬퍼 함수
CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND ((requester_id = user_a AND receiver_id = user_b)
            OR (requester_id = user_b AND receiver_id = user_a))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Profiles: 누구나 읽을 수 있거나 친구/자신만 읽기 가능 (앱 내 유저 검색 및 친구 프로필 표시용)
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Monthly Goals: 본인 및 수락된 친구가 조회 가능, 수정/삭제는 본인만
CREATE POLICY "Users and friends can view monthly goals"
    ON public.monthly_goals FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR public.are_friends(auth.uid(), user_id)
    );

CREATE POLICY "Users can insert their own monthly goals"
    ON public.monthly_goals FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly goals"
    ON public.monthly_goals FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly goals"
    ON public.monthly_goals FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Todos: 본인 및 수락된 친구가 조회 가능, 등록/수정/삭제는 본인만
CREATE POLICY "Users and friends can view todos"
    ON public.todos FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR public.are_friends(auth.uid(), user_id)
    );

CREATE POLICY "Users can manage their own todos"
    ON public.todos FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Todo Completions: 본인 및 수락된 친구 조회 가능
CREATE POLICY "Users and friends can view completions"
    ON public.todo_completions FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR public.are_friends(auth.uid(), user_id)
    );

CREATE POLICY "Users can manage their completions"
    ON public.todo_completions FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Friendships: 요청자 또는 수신자만 접근 가능
CREATE POLICY "Users can view their friendships"
    ON public.friendships FOR SELECT
    TO authenticated
    USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create friend requests"
    ON public.friendships FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Participants can update friend status"
    ON public.friendships FOR UPDATE
    TO authenticated
    USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- ==============================================================================
-- 8. DAL 달성률(%) 계산 SQL FUNCTIONS & REALTIME
-- ==============================================================================

-- 특정 사용자의 특정 날짜(기본 오늘) 달성률 계산 함수
CREATE OR REPLACE FUNCTION public.calculate_daily_progress(
    p_user_id UUID,
    p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    v_day_of_week INTEGER;
    v_total_count INTEGER := 0;
    v_completed_count INTEGER := 0;
    v_percentage NUMERIC := 0.0;
BEGIN
    -- 0: 일요일 ~ 6: 토요일 추출
    v_day_of_week := EXTRACT(DOW FROM p_target_date);

    -- 1. 해당 날짜에 유효한 전체 할 일 집합
    -- (특정 날짜 할 일 OR 해당 요일에 반복되는 할 일)
    WITH target_todos AS (
        SELECT 
            t.id,
            t.is_recurring,
            t.is_completed AS single_completed,
            EXISTS (
                SELECT 1 FROM public.todo_completions tc
                WHERE tc.todo_id = t.id AND tc.completed_date = p_target_date
            ) AS recurring_completed
        FROM public.todos t
        WHERE t.user_id = p_user_id
          AND (
              (t.is_recurring = FALSE AND t.due_date = p_target_date)
              OR
              (t.is_recurring = TRUE AND v_day_of_week = ANY(t.recurring_days))
          )
    )
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (
            WHERE (is_recurring = FALSE AND single_completed = TRUE)
               OR (is_recurring = TRUE AND recurring_completed = TRUE)
        )
    INTO v_total_count, v_completed_count
    FROM target_todos;

    IF v_total_count > 0 THEN
        v_percentage := ROUND((v_completed_count::NUMERIC / v_total_count::NUMERIC) * 100, 1);
    ELSE
        v_percentage := 0.0;
    END IF;

    RETURN json_build_object(
        'target_date', p_target_date,
        'total_count', v_total_count,
        'completed_count', v_completed_count,
        'percentage', v_percentage
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 친구 대시보드 일괄 조회 함수 (친구 프로필 + 이달의 목표 + 오늘 달성률)
CREATE OR REPLACE FUNCTION public.get_friends_dashboard(
    p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    friend_id UUID,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    monthly_goal_title TEXT,
    total_todos BIGINT,
    completed_todos BIGINT,
    progress_percentage NUMERIC
) AS $$
DECLARE
    v_year_month VARCHAR(7);
    v_day_of_week INTEGER;
BEGIN
    v_year_month := TO_CHAR(p_target_date, 'YYYY-MM');
    v_day_of_week := EXTRACT(DOW FROM p_target_date);

    RETURN QUERY
    WITH accepted_friends AS (
        SELECT 
            CASE 
                WHEN requester_id = auth.uid() THEN receiver_id 
                ELSE requester_id 
            END AS friend_user_id
        FROM public.friendships
        WHERE status = 'accepted'
          AND (requester_id = auth.uid() OR receiver_id = auth.uid())
    ),
    friend_todos AS (
        SELECT 
            t.user_id,
            t.id,
            t.is_recurring,
            t.is_completed,
            EXISTS (
                SELECT 1 FROM public.todo_completions tc
                WHERE tc.todo_id = t.id AND tc.completed_date = p_target_date
            ) AS rec_done
        FROM public.todos t
        JOIN accepted_friends af ON af.friend_user_id = t.user_id
        WHERE (t.is_recurring = FALSE AND t.due_date = p_target_date)
           OR (t.is_recurring = TRUE AND v_day_of_week = ANY(t.recurring_days))
    ),
    stats AS (
        SELECT 
            af.friend_user_id,
            COUNT(ft.id) AS total_count,
            COUNT(ft.id) FILTER (
                WHERE (ft.is_recurring = FALSE AND ft.is_completed = TRUE)
                   OR (ft.is_recurring = TRUE AND ft.rec_done = TRUE)
            ) AS done_count
        FROM accepted_friends af
        LEFT JOIN friend_todos ft ON ft.user_id = af.friend_user_id
        GROUP BY af.friend_user_id
    )
    SELECT 
        p.id AS friend_id,
        p.username,
        p.full_name,
        p.avatar_url,
        mg.title AS monthly_goal_title,
        COALESCE(s.total_count, 0) AS total_todos,
        COALESCE(s.done_count, 0) AS completed_todos,
        CASE 
            WHEN COALESCE(s.total_count, 0) > 0 
            THEN ROUND((COALESCE(s.done_count, 0)::NUMERIC / s.total_count::NUMERIC) * 100, 1)
            ELSE 0.0 
        END AS progress_percentage
    FROM accepted_friends af
    JOIN public.profiles p ON p.id = af.friend_user_id
    LEFT JOIN public.monthly_goals mg ON mg.user_id = p.id AND mg.year_month = v_year_month
    LEFT JOIN stats s ON s.friend_user_id = p.id
    ORDER BY progress_percentage DESC, p.username ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Realtime 리플리케이션 발행 등록
ALTER PUBLICATION supabase_realtime ADD TABLE public.todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.todo_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
