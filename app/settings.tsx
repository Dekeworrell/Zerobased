import { router } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { registerForPushNotifications } from '../lib/notifications'
import { getSubscriptionTier } from '../lib/purchases'
import { clearOnboardingData } from '../lib/store'
import { supabase } from '../lib/supabase'
import { invalidateUserCache } from '../lib/userCache'

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
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [pendingInvite, setPendingInvite] = useState<any>(null)
  const [pendingInviteeEmail, setPendingInviteeEmail] = useState('')
  const [householdLoading, setHouseholdLoading] = useState(false)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free')
  const [showPayCycleLock, setShowPayCycleLock] = useState(false)

  useFocusEffect(
    useCallback(() => {
      loadProfile()
    }, [])
  )

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.replace('/'); return }

    setEmail(user.email || '')
    setInviteSent(false)
    setInviteCode('')
    setPendingInviteeEmail('')

    const [{ data: profile }, rcTier] = await Promise.all([
      supabase.from('profiles').select('name, tracking_method, budget_cycle, notifications_enabled, notify_at_percent_1, notify_at_percent_2, paycheque_reminders, household_id, subscription_tier').eq('id', user.id).single(),
      getSubscriptionTier(),
    ])

    if (profile) {
      setName(profile.name || '')
      setTrackingMethod(profile.tracking_method || 'manual')
      setBudgetCycleLocal(profile.budget_cycle || 'monthly')
      setNotificationsEnabled(profile.notifications_enabled ?? true)
      setNotifyAt1(profile.notify_at_percent_1 ?? 80)
      setNotifyAt2(profile.notify_at_percent_2 ?? 90)
      setPaychequeReminders(profile.paycheque_reminders ?? true)
      setHouseholdId(profile.household_id || null)
      const dbTier = (profile.subscription_tier as 'free' | 'pro') ?? 'free'
      setSubscriptionTier(dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free')

      if (profile.household_id) {
        const { data: members } = await supabase.rpc('get_household_members')
        if (members && members.length > 0) {
          setPartnerEmail(members[0].name || 'Your partner')
        } else {
          const { data: outgoing } = await supabase
            .from('household_invitations')
            .select('invited_email')
            .eq('household_id', profile.household_id)
            .eq('accepted', false)
            .maybeSingle()
          if (outgoing) setPendingInviteeEmail(outgoing.invited_email)
        }
      } else {
        setPartnerEmail('')
        const { data: invite } = await supabase.rpc('get_pending_invite')
        if (invite) setPendingInvite(invite)
      }
    }

    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not logged in')
      const user = session.user

      await supabase.from('profiles').upsert({
        id: user.id,
        name,
        tracking_method: trackingMethod,
        budget_cycle: budgetCycleLocal,
        notifications_enabled: notificationsEnabled,
        notify_at_percent_1: notifyAt1,
        notify_at_percent_2: notifyAt2,
        paycheque_reminders: paychequeReminders,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleLogout() {
    invalidateUserCache()
    await supabase.auth.signOut()
    clearOnboardingData()
    router.replace('/')
  }

  async function acceptInvite() {
    if (!pendingInvite) return
    setHouseholdLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('accept_household_invite', {
        invite_token: pendingInvite.token
      })
      if (error) throw error
      invalidateUserCache()
      setHouseholdId(data.household_id)
      setPendingInvite(null)
      setPartnerEmail('Your partner')
      supabase.functions.invoke('notify-invite-accepted').catch(() => {})
      // Route the new household member to set up their own income only
      router.push('/onboarding/income?from=household_join')
    } catch (err: any) {
      setError(err.message)
    }
    setHouseholdLoading(false)
  }

  async function leaveHousehold() {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Leave household? You will no longer share this budget.')
      : await new Promise<boolean>(resolve => Alert.alert(
          'Leave household',
          'You will no longer share this budget with your partner.',
          [{ text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
           { text: 'Leave', onPress: () => resolve(true), style: 'destructive' }]
        ))
    if (!confirm) return
    setHouseholdLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      await supabase.from('profiles').update({ household_id: null }).eq('id', user.id)
      invalidateUserCache()
      setHouseholdId(null)
      setPartnerEmail('')
    } catch (err: any) {
      setError(err.message)
    }
    setHouseholdLoading(false)
  }

async function sendInvite() {
    if (!inviteEmail.trim()) return
    setHouseholdLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('create_household_and_invite', {
        invited_email_param: inviteEmail.trim().toLowerCase()
      })

      if (error) throw error

      const sentTo = inviteEmail.trim().toLowerCase()
      setHouseholdId(data.household_id)
      setInviteCode(data.token)
      setInviteSent(true)
      setInviteEmail('')
      setPendingInviteeEmail(sentTo)
      supabase.functions.invoke('send-invite-email', {
        body: { invited_email: sentTo, inviter_name: name || email }
      }).catch(() => {})
    } catch (err: any) {
      setError(err.message)
    }
    setHouseholdLoading(false)
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            onPress={() => {
              setTrackingMethod('bank')
              router.push('/connect-bank')
            }}
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
          {subscriptionTier === 'free' ? (
            <TouchableOpacity
              style={[styles.methodBtn, styles.methodBtnLocked]}
              onPress={() => setShowPayCycleLock(v => !v)}
            >
              <View style={styles.lockedBtnInner}>
                <Text style={styles.methodBtnText}>💰 Pay cycle</Text>
                <View style={styles.lockBadge}>
                  <Text style={styles.lockBadgeText}>🔒 Pro</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.methodBtn, budgetCycleLocal === 'paycycle' && styles.methodBtnActive]}
              onPress={() => setBudgetCycleLocal('paycycle')}
            >
              <Text style={[styles.methodBtnText, budgetCycleLocal === 'paycycle' && styles.methodBtnTextActive]}>
                💰 Pay cycle
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {subscriptionTier === 'free' && showPayCycleLock && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeCardTitle}>Pay cycle budgeting is a Zerobased Pro feature.</Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={() => router.push('/upgrade')}>
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        )}
        {trackingMethod === 'bank' && (
          <TouchableOpacity style={styles.infoBox} onPress={() => router.push('/connect-bank')}>
            <Text style={styles.infoText}>
              🔗 Tap here to manage your connected bank accounts and sync transactions.
            </Text>
          </TouchableOpacity>
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
        {notificationsEnabled && subscriptionTier === 'pro' && (
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
        {notificationsEnabled && subscriptionTier !== 'pro' && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeCardTitle}>Custom notification thresholds are Pro only.</Text>
            <Text style={styles.upgradeCardBody}>Free users get an alert when a category hits 100%. Upgrade to set custom warnings at any percentage.</Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={() => router.push('/upgrade')}>
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
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
        <Text style={styles.sectionTitle}>Household</Text>

        {subscriptionTier === 'free' ? (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeCardTitle}>Share your budget with a partner.</Text>
            <Text style={styles.upgradeCardBody}>Available on Zerobased Pro.</Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={() => router.push('/upgrade')}>
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        ) : householdId && (partnerEmail || pendingInviteeEmail) ? (
          <>
            <View style={styles.partnerCard}>
              <Text style={styles.partnerIcon}>{partnerEmail ? '👫' : '⏳'}</Text>
              <View style={styles.partnerInfo}>
                <Text style={styles.partnerName}>
                  {partnerEmail
                    ? `Sharing with ${partnerEmail}`
                    : `Sharing with ${pendingInviteeEmail}`}
                </Text>
                <Text style={styles.switchSubLabel}>
                  {partnerEmail
                    ? 'You share the same budget and transactions'
                    : 'Invite pending — waiting for them to accept'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.leaveBtn}
              onPress={leaveHousehold}
              disabled={householdLoading}
            >
              <Text style={styles.leaveBtnText}>Leave household</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {pendingInvite && (
              <View style={styles.inviteCard}>
                <Text style={styles.inviteCardTitle}>📬 You have a pending invite!</Text>
                <Text style={styles.switchSubLabel}>
                  Someone invited you to share their budget.
                </Text>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={acceptInvite}
                  disabled={householdLoading}
                >
                  {householdLoading
                    ? <ActivityIndicator color={Colors.text} />
                    : <Text style={styles.acceptBtnText}>Accept Invite</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {!pendingInvite && (
              <>
                <Text style={styles.switchSubLabel}>
                  Invite a partner to share your budget. They'll be able to log transactions and see the same dashboard.
                </Text>
                {inviteSent ? (
                  <View style={styles.inviteCard}>
                    <Text style={styles.inviteCardTitle}>✅ Invite sent!</Text>
                    <Text style={styles.switchSubLabel}>
                      Share this code with your partner:
                    </Text>
                    <Text style={styles.inviteCode}>{inviteCode}</Text>
                    <Text style={styles.switchSubLabel}>
                      They'll see the invite when they open the app on their device.
                    </Text>
                    <TouchableOpacity onPress={() => setInviteSent(false)}>
                      <Text style={[styles.switchSubLabel, { color: Colors.primary, marginTop: 4 }]}>
                        Send another invite
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.inviteRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Partner's email"
                      placeholderTextColor={Colors.textSecondary}
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.sendBtn, householdLoading && styles.disabled]}
                      onPress={sendInvite}
                      disabled={householdLoading}
                    >
                      {householdLoading
                        ? <ActivityIndicator color={Colors.text} size="small" />
                        : <Text style={styles.sendBtnText}>Invite</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        {subscriptionTier === 'pro' ? (
          <View style={styles.planCard}>
            <Text style={styles.planName}>✅ Zerobased Pro</Text>
            <Text style={styles.planDesc}>You have access to all Pro features. Thank you for your support!</Text>
          </View>
        ) : (
          <View style={styles.planCard}>
            <Text style={styles.planName}>Free plan</Text>
            <Text style={styles.planDesc}>Upgrade to Zerobased Pro for unlimited categories, household sharing, reports, and more.</Text>
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/upgrade')}>
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        )}
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

      {/* Affiliate partner portal — visible to all users */}
      <TouchableOpacity style={styles.partnerButton} onPress={() => router.push('/partner')}>
        <Text style={styles.partnerButtonText}>🤝  Partner / Affiliate Program</Text>
      </TouchableOpacity>

      {/* Owner-only admin dashboard */}
      {email.toLowerCase() === 'dekeworrell@shaw.ca' && (
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/admin')}>
          <Text style={styles.adminButtonText}>⚙️  Admin Dashboard</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.privacyButton} onPress={() => router.push('/privacy')}>
        <Text style={styles.privacyButtonText}>🔒  Privacy Policy</Text>
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
  partnerButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  partnerButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  adminButton: {
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  adminButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  privacyButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
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
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  partnerIcon: {
    fontSize: 24,
  },
  partnerInfo: {
    flex: 1,
    gap: 2,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  inviteCard: {
    backgroundColor: '#f2f4f2',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviteCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  inviteCode: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    letterSpacing: 4,
    paddingVertical: 8,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 70,
  },
  sendBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  leaveBtn: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  leaveBtnText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  methodBtnLocked: {
    opacity: 0.7,
  },
  lockedBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockBadge: {
    backgroundColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lockBadgeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  upgradeCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  upgradeCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  upgradeCardBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 8,
  },
  upgradeButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})