import { Stack } from 'expo-router'
import { useEffect } from 'react'
import 'react-native-url-polyfill/auto'
import { registerForPushNotifications } from '../lib/notifications'
import { initRevenueCat } from '../lib/purchases'
import { initStore } from '../lib/store'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  useEffect(() => {
    initStore()
    registerForPushNotifications()
    supabase.auth.getSession().then(({ data: { session } }) => {
      initRevenueCat(session?.user?.id)
    })
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="upgrade" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="claim-income" />
      <Stack.Screen name="add-transaction" />
      <Stack.Screen name="budget-adjust" />
      <Stack.Screen name="connect-bank" />
      <Stack.Screen name="partner" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
    </Stack>
  )
}
