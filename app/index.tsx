import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { supabase } from '../lib/supabase'

export default function WelcomeScreen() {
  const { ref } = useLocalSearchParams<{ ref?: string }>()

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Pending household invite? Skip onboarding — go to the invite pop-up
    const { data: pendingInvite } = await supabase.rpc('get_pending_invite')
    if (pendingInvite) {
      router.replace('/dashboard?invite=1')
      return
    }

    // Check if onboarding is complete — if not, resume from welcome
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', session.user.id)
      .maybeSingle()

    if (profile?.onboarding_complete) {
      router.replace('/dashboard')
    } else {
      // Onboarding not finished — send back to welcome so they can continue
      router.replace('/welcome')
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <View style={styles.logoInner}>
            <View style={[styles.bar, { height: 10, opacity: 0.45 }]} />
            <View style={[styles.bar, { height: 18, opacity: 0.7 }]} />
            <View style={[styles.bar, { height: 26 }]} />
          </View>
        </View>
        <Text style={styles.wordmark} maxFontSizeMultiplier={1.4}>
          Zero<Text style={styles.wordmarkAccent}>based</Text>
        </Text>
        <Text style={styles.tagline}>Budget every dollar.{'\n'}Build real wealth.</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartLine}>
            {[60,52,46,38,20].map((top, i) => (
              <View key={i} style={[styles.chartDot, { marginTop: top, opacity: 0.3 }]} />
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View style={[styles.chartDot, { opacity: 1 }]} />
              <View style={styles.chartBadge}>
                <Text style={styles.chartBadgeText}>+$48,210</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push(ref ? `/signup?ref=${ref}` : '/signup')}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.secondaryButtonText}>Log In</Text>
        </TouchableOpacity>
        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f2f4f2',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoMark: {
    width: 72,
    height: 72,
    backgroundColor: '#edf7f1',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#b6dfc0',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 5,
    marginBottom: 20,
  },
  logoInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  bar: {
    width: 8,
    backgroundColor: '#3db870',
    borderRadius: 3,
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1a1f1a',
    letterSpacing: -1.5,
    marginBottom: 10,
  },
  wordmarkAccent: {
    color: '#3db870',
  },
  tagline: {
    fontSize: 18,
    color: '#6b7a6b',
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 32,
  },
  chartContainer: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  chartLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 28,
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  chartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3db870',
  },
  chartBadge: {
    backgroundColor: '#edf7f1',
    borderWidth: 1,
    borderColor: '#b6dfc0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chartBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f7a45',
  },
  buttons: {
    gap: 10,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  primaryButton: {
    backgroundColor: '#3db870',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e3e8e3',
  },
  secondaryButtonText: {
    color: '#1a1f1a',
    fontSize: 16,
    fontWeight: '600',
  },
  legal: {
    fontSize: 11,
    color: '#aab8aa',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
})