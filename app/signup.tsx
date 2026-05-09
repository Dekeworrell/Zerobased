import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { setCountry } from '../lib/store'
import { supabase } from '../lib/supabase'

export default function SignUpScreen() {
  // Capture ?ref=CODE from affiliate referral links (e.g. zerobased.app/signup?ref=DEKE20)
  const { ref } = useLocalSearchParams<{ ref?: string }>()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [discountCode, setDiscountCode] = useState(ref ? ref.toUpperCase() : '')
  const [codeValid, setCodeValid] = useState<boolean | null>(ref ? null : null)
  const [codeChecking, setCodeChecking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [country, setCountryState] = useState<'CA' | 'US'>('CA')
  const [showPassword, setShowPassword] = useState(false)

  async function validateCode(code: string) {
    if (!code.trim()) { setCodeValid(null); return }
    setCodeChecking(true)
    const { data } = await supabase
      .from('affiliates')
      .select('referral_code')
      .eq('referral_code', code.trim().toUpperCase())
      .eq('status', 'approved')
      .maybeSingle()
    setCodeValid(!!data)
    setCodeChecking(false)
  }

  // If a ref code came in via URL, validate it on mount
  useEffect(() => { if (ref) validateCode(ref) }, [])

  async function handleSignUp() {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address')
      return
    }
    if (discountCode.trim() && codeValid === false) {
      setError('Discount code not found. Remove it or check the spelling.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } }
    })
    if (error) {
      setError(error.message)
    } else if (data.session) {
      const user = data.session.user
      if (user) {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: user.id,
          name: name.trim(),
          country,
          ...(discountCode.trim() ? { referred_by: discountCode.trim().toUpperCase() } : {}),
        })
        if (upsertErr) { setError(upsertErr.message); setLoading(false); return }
      }
      setCountry(country)
      router.replace({ pathname: '/welcome', params: { country } })
    } else {
      if (data.user) {
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: data.user.id,
          name: name.trim(),
          country,
          ...(discountCode.trim() ? { referred_by: discountCode.trim().toUpperCase() } : {}),
        })
        if (upsertErr) { setError(upsertErr.message); setLoading(false); return }
        setCountry(country)
      }
      setEmailSent(true)
    }
    setLoading(false)
  }

  if (emailSent) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Check your email 📬</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {email}. Click it to activate your account, then come back and log in.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.primaryButtonText}>Go to Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 16 }}
            onPress={async () => {
              await supabase.auth.resend({ type: 'signup', email })
              setError('Verification email resent!')
            }}
          >
            <Text style={{ color: Colors.primary, fontSize: 14 }}>Resend verification email</Text>
          </TouchableOpacity>
          {error ? <Text style={[styles.error, { textAlign: 'center', marginTop: 12 }]}>{error}</Text> : null}
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} onScrollBeginDrag={Keyboard.dismiss}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start budgeting in minutes</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.form}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your first name"
            placeholderTextColor={Colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@email.com"
            placeholderTextColor={Colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Country</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
            <TouchableOpacity
              style={[styles.input, { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: country === 'CA' ? Colors.primary : Colors.card }]}
              onPress={() => setCountryState('CA')}
            >
              <Image source={{ uri: 'https://flagcdn.com/w40/ca.png' }} style={{ width: 24, height: 16, borderRadius: 2 }} />
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '500' }}>Canada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.input, { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: country === 'US' ? Colors.primary : Colors.card }]}
              onPress={() => setCountryState('US')}
            >
              <Image source={{ uri: 'https://flagcdn.com/w40/us.png' }} style={{ width: 24, height: 16, borderRadius: 2 }} />
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '500' }}>United States</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Min. 8 characters"
              placeholderTextColor={Colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCorrect={false}
              contextMenuHidden={false}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Discount code <Text style={{ color: Colors.textSecondary, fontWeight: '400' }}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, codeValid === true ? styles.inputActive : codeValid === false ? styles.inputError : null]}
            placeholder="e.g. SARAH20"
            placeholderTextColor={Colors.textSecondary}
            value={discountCode}
            onChangeText={v => { setDiscountCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCodeValid(null) }}
            onBlur={() => validateCode(discountCode)}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
          />
          {codeChecking ? (
            <Text style={styles.codeChecking}>Checking code...</Text>
          ) : codeValid === true ? (
            <View style={styles.refBanner}>
              <Text style={styles.refBannerText}>🏷️ Discount code <Text style={styles.refBannerCode}>{discountCode}</Text> applied!</Text>
              <Text style={styles.refBannerSub}>You'll get your first month free when you upgrade to Pro.</Text>
            </View>
          ) : codeValid === false ? (
            <Text style={styles.codeError}>Code not found. Check the spelling or leave it blank.</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Already have an account?{' '}
          <Text style={styles.link} onPress={() => router.push('/login')}>
            Log In
          </Text>
        </Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 60,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    marginBottom: 32,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  form: {
    gap: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    marginBottom: 16,
  },
  inputActive: {
    borderColor: '#86efac',
    borderWidth: 2,
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  codeChecking: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  codeError: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  refBanner: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 2,
  },
  refBannerText: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
  },
  refBannerCode: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  refBannerSub: {
    fontSize: 12,
    color: '#16a34a',
  },
  footer: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 14,
  },
  link: {
    color: Colors.primary,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  eyeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyeText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
})