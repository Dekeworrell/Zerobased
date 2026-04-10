import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { registerForPushNotifications } from '../lib/notifications'
import { clearOnboardingData } from '../lib/store'
import { supabase } from '../lib/supabase'

export default function SettingsScreen() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notifyAt1, setNotifyAt1] = useState(80)
  const [notifyAt2, setNotifyAt2] = useState(90)
  const [paychequeReminders, setPaychequeReminders] = useState(true)
  const [trackingMethod, setTrackingMethod] = useState('manual')
  const [budgetCycleLocal, setBudgetCycleLocal] = useState<'monthly' | 'paycycle'>('monthly')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }

    setEmail(user.email || '')

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      setName(profile.name || '')
      setTrackingMethod(profile.tracking_method || 'manual')
      setBudgetCycleLocal(profile.budget_cycle || 'monthly')
      setNotificationsEnabled(profile.notifications_enabled ?? true)
      setNotifyAt1(profile.notify_at_percent_1 ?? 80)
      setNotifyAt2(profile.notify_at_percent_2 ?? 90)
    }

    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      await supabase.from('profiles').upsert({
        id: user.id,
        name,
        tracking_method: trackingMethod,
        budget_cycle: budgetCycleLocal,
        notifications_enabled: notificationsEnabled,
        notify_at_percent_1: notifyAt1,
        notify_at_percent_2: notifyAt2,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    clearOnboardingData()
    router.replace('/')
  }

  async function handleDeleteAccount() {
    const confirm1 = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete your account? This cannot be undone.')
      : await new Promise<boolean>(resolve => Alert.alert(
          'Delete account', 'Are you sure? This cannot be undone.',
          [{ text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
           { text: 'Yes, delete everything', onPress: () => resolve(true), style: 'destructive' }]
        ))

    if (!confirm1) return

    const confirm2 = Platform.OS === 'web'
      ? window.confirm('Final confirmation — all your data will be permanently deleted.')
      : await new Promise<boolean>(resolve => Alert.alert(
          'Final confirmation', 'All your data will be permanently deleted.',
          [{ text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
           { text: 'DELETE my account', onPress: () => resolve(true), style: 'destructive' }]
        ))

    if (!confirm2) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.rpc('delete_user_account')
      clearOnboardingData()
      await supabase.auth.signOut()
      router.replace('/')
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.push('/dashboard')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={Colors.textSecondary}
            value={name}
            onChangeText={setName}
            selectTextOnFocus
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email}
            editable={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tracking method</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.methodBtn, trackingMethod === 'manual' && styles.methodBtnActive]}
            onPress={() => setTrackingMethod('manual')}
          >
            <Text style={[styles.methodBtnText, trackingMethod === 'manual' && styles.methodBtnTextActive]}>
              ✏️ Manual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodBtn, trackingMethod === 'bank' && styles.methodBtnActive]}
            onPress={() => setTrackingMethod('bank')}
          >
            <Text style={[styles.methodBtnText, trackingMethod === 'bank' && styles.methodBtnTextActive]}>
              🏦 Bank connected
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Budget cycle</Text>
        <Text style={styles.switchSubLabel}>How should your budget reset?</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.methodBtn, budgetCycleLocal === 'monthly' && styles.methodBtnActive]}
            onPress={() => setBudgetCycleLocal('monthly')}
          >
            <Text style={[styles.methodBtnText, budgetCycleLocal === 'monthly' && styles.methodBtnTextActive]}>
              📅 Calendar month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodBtn, budgetCycleLocal === 'paycycle' && styles.methodBtnActive]}
            onPress={() => setBudgetCycleLocal('paycycle')}
          >
            <Text style={[styles.methodBtnText, budgetCycleLocal === 'paycycle' && styles.methodBtnTextActive]}>
              💰 Pay cycle
            </Text>
          </TouchableOpacity>
        </View>
        {trackingMethod === 'bank' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🔗 Bank connection via Flinks coming soon. You'll be able to automatically import transactions from your Canadian bank accounts.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchLeft}>
            <Text style={styles.switchLabel}>Enable notifications</Text>
            <Text style={styles.switchSubLabel}>Receive budget alerts and reminders</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={async (val) => {
              setNotificationsEnabled(val)
              if (val) await registerForPushNotifications()
            }}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>
        {notificationsEnabled && (
          <>
            <Text style={styles.switchSubLabel}>
              Set up to 2 warning thresholds for variable expense categories (e.g. warn me at 80% and 90%)
            </Text>
            <View style={styles.thresholdRow}>
              <Text style={styles.switchLabel}>Warning 1</Text>
              <View style={styles.thresholdBtns}>
                {[50, 60, 70, 75, 80, 85, 90, 95].map(pct => (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.thresholdBtn, notifyAt1 === pct && styles.thresholdBtnActive]}
                    onPress={() => setNotifyAt1(notifyAt1 === pct ? 0 : pct)}
                  >
                    <Text style={[styles.thresholdBtnText, notifyAt1 === pct && styles.thresholdBtnTextActive]}>
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.thresholdRow}>
              <Text style={styles.switchLabel}>Warning 2</Text>
              <View style={styles.thresholdBtns}>
                {[50, 60, 70, 75, 80, 85, 90, 95].map(pct => (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.thresholdBtn, notifyAt2 === pct && styles.thresholdBtnActive]}
                    onPress={() => setNotifyAt2(notifyAt2 === pct ? 0 : pct)}
                  >
                    <Text style={[styles.thresholdBtnText, notifyAt2 === pct && styles.thresholdBtnTextActive]}>
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Text style={styles.switchLabel}>Paycheque reminders</Text>
                <Text style={styles.switchSubLabel}>Remind me to update balances on payday</Text>
              </View>
              <Switch
                value={paychequeReminders}
                onValueChange={setPaychequeReminders}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.text}
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Budget</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/budget')}>
          <Text style={styles.linkRowText}>Edit budget categories</Text>
          <Text style={styles.linkRowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/accounts')}>
          <Text style={styles.linkRowText}>Manage accounts</Text>
          <Text style={styles.linkRowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/onboarding/tracking-method')}>
          <Text style={styles.linkRowText}>Redo budget setup</Text>
          <Text style={styles.linkRowChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.planCard}>
          <Text style={styles.planName}>Free plan</Text>
          <Text style={styles.planDesc}>Upgrade to Zerobased Pro for advanced features</Text>
          <TouchableOpacity style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>✅ Settings saved!</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={saveProfile}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.primaryButtonText}>Save settings</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete account</Text>
      </TouchableOpacity>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f2f4f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f2f4f2',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    gap: 20,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  section: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodBtn: {
    flex: 1,
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  methodBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodBtnText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  methodBtnTextActive: {
    color: Colors.text,
  },
  infoBox: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 10,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLeft: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  switchSubLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkRowText: {
    fontSize: 15,
    color: Colors.text,
  },
  linkRowChevron: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  planCard: {
    gap: 8,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  planDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  upgradeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    color: Colors.success,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    opacity: 0.6,
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: 16,
  },
  thresholdRow: {
    gap: 8,
  },
  thresholdBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thresholdBtn: {
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f2f4f2',
  },
  thresholdBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  thresholdBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  thresholdBtnTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
})