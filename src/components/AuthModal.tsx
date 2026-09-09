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
  onAuthSuccess: (user: { id: string; email: string; username: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuth = async () => {
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    if (isSignUp && !username.trim()) {
      setErrorMsg('친구들이 알아볼 수 있는 닉네임을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        // 데모 모드일 경우 가상 로그인 처리
        const demoUser = {
          id: 'demo-user-' + Date.now(),
          email: email.trim(),
          username: isSignUp ? username.trim() : email.split('@')[0],
        };
        Alert.alert('로그인 완료 (체험 모드)', `${demoUser.username}님 환영합니다!`);
        onAuthSuccess(demoUser);
        onClose();
        return;
      }

      if (isSignUp) {
        // 1. 회원가입
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              username: username.trim(),
              full_name: username.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          Alert.alert('회원가입 성공', '회원가입 및 로그인이 완료되었습니다!');
          onAuthSuccess({
            id: data.user.id,
            email: data.user.email || email,
            username: username.trim(),
          });
          onClose();
        }
      } else {
        // 2. 로그인
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) throw error;

        if (data.user) {
          // 프로필 정보 조회
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.user.id)
            .maybeSingle();

          const resolvedUsername = profile?.username || data.user.email?.split('@')[0] || 'user';
          Alert.alert('로그인 성공', `${resolvedUsername}님 환영합니다!`);
          onAuthSuccess({
            id: data.user.id,
            email: data.user.email || email,
            username: resolvedUsername,
          });
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || '인증 처리에 실패했습니다.');
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

          {/* 닉네임 필드 (회원가입 시에만) */}
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>닉네임 (친구 추가용 아이디)</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 민수_달리자"
                placeholderTextColor="#94A3B8"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* 이메일 필드 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>이메일 주소</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
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
