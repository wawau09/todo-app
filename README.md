# 친구 공유형 To-Do & 목표 관리 앱 (Expo + Supabase)

웹과 안드로이드에서 모두 실행 가능한 친구 공유형 목표 및 할 일 관리(To-Do) 크로스플랫폼 애플리케이션입니다.

## 🚀 주요 기능
1. **할 일(To-Do) 관리**: 특정 날짜 지정 할 일 및 요일별 반복 할 일 지원
2. **이달의 목표(Monthly Goal)**: YYYY-MM 단위 메인 목표 등록 및 관리
3. **일일 달성률(%) 자동 계산**: 요일 반복 및 단일 할 일을 종합하여 완료율(%) 산출
4. **친구 현황판**: 수락된 친구들의 이달의 목표 및 오늘 할 일 달성률(%) 실시간 동기화

## 🛠 기술 스택
- **프론트엔드**: React Native, Expo SDK 51, TypeScript
- **백엔드/DB**: Supabase (PostgreSQL, Row Level Security, Realtime)
- **아이콘**: `@expo/vector-icons`

## 📦 시작하기

### 1. 패키지 설치
```bash
npm install
```

### 2. Supabase 설정
1. Supabase 프로젝트를 생성합니다.
2. `supabase/schema.sql` 내용을 Supabase 콘솔의 SQL Editor에 붙여넣고 실행합니다.
3. `src/lib/supabase.ts`에 Supabase Project URL과 Anon Key를 입력합니다 (또는 `.env` 파일에 지정).

### 3. 앱 실행
```bash
# 로컬 개발 서버 실행
npx expo start

# Android 실행
npx expo start --android

# Web 브라우저 실행
npx expo start --web
```
