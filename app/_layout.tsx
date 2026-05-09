import { Tabs } from 'expo-router'
import { useEffect } from 'react'
import { Platform, Text, View } from 'react-native'
import 'react-native-url-polyfill/auto'
import { Colors } from '../constants/colors'
import { registerForPushNotifications } from '../lib/notifications'
import { initRevenueCat } from '../lib/purchases'
import { initStore } from '../lib/store'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const tabBarHeight = Platform.OS === 'web' ? 54 : 68

  useEffect(() => {
    initStore()
    registerForPushNotifications()
    // Initialize RevenueCat; link to Supabase user ID if already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      initRevenueCat(session?.user?.id)
    })
  }, [])

  return (
    <View style={{ flex: 1 }}>
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
      <Tabs.Screen name="index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="signup" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="login" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="add-transaction" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="budget-adjust" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="welcome" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="settings" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="upgrade" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="connect-bank" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="partner" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="admin" options={{ href: null, tabBarStyle: { display: 'none' } }} />
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
    </View>
  )
}