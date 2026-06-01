import { Tabs } from 'expo-router'
import { Platform, Text } from 'react-native'
import { Colors } from '../../constants/colors'

export default function TabsLayout() {
  const tabBarHeight = Platform.OS === 'web' ? 54 : 68

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'web' ? 8 : 16,
          paddingTop: 4,
          height: tabBarHeight,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 0,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="budget"
        options={{
          title: 'Budget',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>💳</Text>,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>💰</Text>,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🏦</Text>,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📊</Text>,
        }}
      />
    </Tabs>
  )
}
