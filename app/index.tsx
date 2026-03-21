import { router } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

export default function WelcomeScreen() {
  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      router.replace('/dashboard')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>Zerobased</Text>
        <Text style={styles.tagline}>Budget every dollar.{'\n'}Build real wealth.</Text>
      </View>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/signup')}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.secondaryButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 28,
    color: Colors.text,
    lineHeight: 38,
    textAlign: 'center',
  },
  buttons: {
    gap: 12,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
})