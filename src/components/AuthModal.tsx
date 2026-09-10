import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthSuccess: (user: { id: string; email?: string; username: string }) => void;
}

// 아이디(닉네임)를 Supabase 내부 인증용 이메일로 안전하게 매핑하는 헬퍼 함수
const usernameToInternalEmail = (input: string): string => {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  // 영문 소문자, 숫자, 마침표, 밑줄, 하이픈만으로 이루어진 경우 바로 사용
  if (/^[a-z0-9_.-]+$/.test(trimmed)) {
    return `${trimmed}@togetherdo.app`;
  }
  // 한글 등 유니코드 문자가 포함된 경우 안전한 16진수(hex) 문자열로 변환하여 RFC 호환 이메일 생성
  let hex = '';
  for (let i = 0; i < trimmed.length; i++) {
    hex += trimmed.charCodeAt(i).toString(16).padStart(4, '0');
  }
  return `u_${hex}@togetherdo.app`;
};

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuth = async () => {
    setErrorMsg(null);
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMsg('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    if (isSignUp && cleanUsername.length < 2) {
      setErrorMsg('아이디(닉네임)는 2글자 이상 입력해주세요.');
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorMsg('비밀번호는 6자리 이상 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const internalEmail = usernameToInternalEmail(cleanUsername);

      if (!isSupabaseConfigured) {
        // 데모 모드일 경우 가상 로그인 처리
        const demoUser = {
          id: 'demo-user-' + Date.now(),
          email: internalEmail,
          username: cleanUsername,
        };
        Alert.alert(
          isSignUp ? '가입 완료 (체험 모드)' : '로그인 완료 (체험 모드)',
          `${demoUser.username}님 환영합니다!`
        );
        onAuthSuccess(demoUser);
        onClose();
        return;
      }

      if (isSignUp) {
        // 1. 회원가입
        const { data, error } = await supabase.auth.signUp({
          email: internalEmail,
          password: cleanPassword,
          options: {
            data: {
              username: cleanUsername,
              full_name: cleanUsername,
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          Alert.alert('회원가입 성공', `${cleanUsername}님 환영합니다!`);
          onAuthSuccess({
            id: data.user.id,
            email: data.user.email || internalEmail,
            username: cleanUsername,
          });
          onClose();
        }
      } else {
        // 2. 로그인
        const { data, error } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password: cleanPassword,
        });

        if (error) throw error;

        if (data.user) {
          // 프로필 정보 조회
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.user.id)
            .maybeSingle();

          const resolvedUsername = profile?.username || cleanUsername;
          Alert.alert('로그인 성공', `${resolvedUsername}님 환영합니다!`);
          onAuthSuccess({
            id: data.user.id,
            email: data.user.email || internalEmail,
            username: resolvedUsername,
          });
          onClose();
        }
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setErrorMsg('이미 존재하는 아이디입니다. 다른 아이디를 사용해주세요.');
      } else if (msg.includes('Invalid login credentials')) {
        setErrorMsg('아이디 또는 비밀번호가 일치하지 않습니다.');
      } else {
        setErrorMsg(err.message || '인증 처리에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 닫기 버튼 */}
          <View style={styles.header}>
            <Text style={styles.title}>{isSignUp ? '계정 만들기' : '로그인'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            {isSignUp
              ? '친구와 함께 목표를 관리하고 달성률을 공유해보세요!'
              : '로그인하여 친구들의 실시간 목표를 확인하세요.'}
          </Text>

          {/* 에러 메시지 배너 */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* 탭 전환 */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, !isSignUp && styles.tabActive]}
              onPress={() => {
                setIsSignUp(false);
                setErrorMsg(null);
              }}
            >
              <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, isSignUp && styles.tabActive]}
              onPress={() => {
                setIsSignUp(true);
                setErrorMsg(null);
              }}
            >
              <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>회원가입</Text>
            </TouchableOpacity>
          </View>

          {/* 아이디 필드 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {isSignUp ? '아이디 (친구 추가용 닉네임)' : '아이디 (닉네임)'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={isSignUp ? '예: minsu 또는 민수' : '아이디 또는 닉네임 입력'}
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* 비밀번호 필드 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>비밀번호</Text>
            <TextInput
              style={styles.input}
              placeholder="6자리 이상 비밀번호"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* 제출 버튼 */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>{isSignUp ? '가입하기' : '로그인'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginBottom: 14,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#6366F1',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366F1',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
