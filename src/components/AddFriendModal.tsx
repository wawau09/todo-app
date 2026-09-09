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
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FriendDashboardItem } from '../types/database';

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onFriendAdded: (newFriend: FriendDashboardItem) => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  visible,
  onClose,
  onFriendAdded,
}) => {
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const handleAddFriend = async () => {
    setStatusMsg(null);
    const targetUsername = usernameInput.trim();

    if (!targetUsername) {
      setStatusMsg({ text: '친구의 닉네임(아이디)을 입력해주세요.', isError: true });
      return;
    }

    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        // 데모 모드: 가상의 친구 카드 즉시 생성
        const newFriend: FriendDashboardItem = {
          friend_id: 'demo-friend-' + Date.now(),
          username: targetUsername,
          full_name: targetUsername,
          avatar_url: null,
          monthly_goal_title: '새로 연결된 친구의 첫 번째 목표 🔥',
          total_todos: 3,
          completed_todos: 1,
          progress_percentage: 33.3,
        };

        Alert.alert('친구 추가 완료', `@${targetUsername}님과 친구가 되었습니다!`);
        onFriendAdded(newFriend);
        setUsernameInput('');
        onClose();
        return;
      }

      // 1. 현재 로그인 사용자 확인
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      if (!currentUserId) {
        setStatusMsg({ text: '친구를 추가하려면 먼저 로그인이 필요합니다.', isError: true });
        return;
      }

      // 2. 입력된 username으로 대상 프로필 검색
      const { data: targetProfile, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', targetUsername)
        .maybeSingle();

      if (searchError) throw searchError;

      if (!targetProfile) {
        setStatusMsg({
          text: `'@${targetUsername}' 유저를 찾을 수 없습니다. 닉네임을 확인해주세요.`,
          isError: true,
        });
        return;
      }

      if (targetProfile.id === currentUserId) {
        setStatusMsg({ text: '자기 자신은 친구로 추가할 수 없습니다.', isError: true });
        return;
      }

      // 3. friendships 관계 등록 (즉시 accepted 또는 pending)
      const { error: insertError } = await supabase.from('friendships').upsert(
        {
          requester_id: currentUserId,
          receiver_id: targetProfile.id,
          status: 'accepted', // 함께 사용하는 목적이므로 원클릭 수락 처리
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'requester_id,receiver_id' }
      );

      if (insertError) throw insertError;

      Alert.alert('친구 연결 성공', `@${targetProfile.username}님과 친구가 되었습니다!`);
      
      onFriendAdded({
        friend_id: targetProfile.id,
        username: targetProfile.username,
        full_name: targetProfile.full_name,
        avatar_url: targetProfile.avatar_url,
        monthly_goal_title: null,
        total_todos: 0,
        completed_todos: 0,
        progress_percentage: 0,
      });

      setUsernameInput('');
      onClose();
    } catch (err: any) {
      setStatusMsg({ text: err.message || '친구 추가에 실패했습니다.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Feather name="user-plus" size={20} color="#6366F1" />
              <Text style={styles.title}>친구 추가하기</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            친구의 닉네임(아이디)을 입력하여 친구를 맺고, 서로의 실시간 일일 달성률을 확인해보세요!
          </Text>

          {statusMsg && (
            <View style={[styles.msgBox, statusMsg.isError ? styles.errorBox : styles.successBox]}>
              <Text style={[styles.msgText, statusMsg.isError ? styles.errorText : styles.successText]}>
                {statusMsg.text}
              </Text>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Text style={styles.inputPrefix}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="친구 닉네임 입력 (예: 태렬_목표달성)"
              placeholderTextColor="#94A3B8"
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleAddFriend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>친구 추가</Text>
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
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  msgBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  msgText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    color: '#B91C1C',
  },
  successText: {
    color: '#15803D',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  submitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
