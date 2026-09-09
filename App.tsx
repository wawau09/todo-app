import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MyTodoScreen } from './src/screens/MyTodoScreen';
import { FriendDashboardScreen } from './src/screens/FriendDashboardScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'my_todos' | 'friends'>('my_todos');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Screen Body */}
      <View style={styles.content}>
        {activeTab === 'my_todos' ? <MyTodoScreen /> : <FriendDashboardScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('my_todos')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'my_todos' ? 'checkbox' : 'checkbox-outline'}
            size={24}
            color={activeTab === 'my_todos' ? '#6366F1' : '#94A3B8'}
          />
          <Text style={[styles.navText, activeTab === 'my_todos' && styles.navTextActive]}>
            내 할 일
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'friends' ? 'people' : 'people-outline'}
            size={24}
            color={activeTab === 'friends' ? '#6366F1' : '#94A3B8'}
          />
          <Text style={[styles.navText, activeTab === 'friends' && styles.navTextActive]}>
            친구 현황판
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 74 : 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  navText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  navTextActive: {
    color: '#6366F1',
  },
});
