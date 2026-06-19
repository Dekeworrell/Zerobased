import { router, useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Colors } from '../constants/colors'
import { getSubscriptionTier } from '../lib/purchases'
import { supabase } from '../lib/supabase'

type ConnectedBank = {
  id: string
  institution_name: string | null
  account_count: number
  last_synced_at: string | null
}

type PlaidAccount = {
  id: string
  name: string
  official_name: string | null
  type: string
  subtype: string | null
  balance_current: number | null
  balance_available: number | null
  currency_code: string
  mask: string | null
  institution_name: string | null
}

export default function ConnectBankScreen() {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free')
  const [banks, setBanks] = useState<ConnectedBank[]>([])
  const [accounts, setAccounts] = useState<PlaidAccount[]>([])
  const [error, setError] = useState('')
  const [syncResult, setSyncResult] = useState('')

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.replace('/'); return }

      const [{ data: profile }, rcTier] = await Promise.all([
        supabase.from('profiles').select('subscription_tier').eq('id', user.id).single(),
        getSubscriptionTier(),
      ])
      const dbTier = (profile?.subscription_tier as 'free' | 'pro') ?? 'free'
      const tier = dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free'
      setSubscriptionTier(tier)

      if (tier !== 'pro') { setLoading(false); return }

      // Load connected banks
      const { data: bankData } = await supabase
        .from('plaid_items')
        .select('id, institution_name, last_synced_at')
        .eq('user_id', user.id)

      // Load plaid accounts with institution name
      const { data: accountData } = await supabase
        .from('plaid_accounts')
        .select(`
          id, name, official_name, type, subtype,
          balance_current, balance_available, currency_code, mask,
          plaid_items!inner(institution_name, user_id)
        `)
        .eq('plaid_items.user_id', user.id)

      if (bankData) {
        setBanks(bankData.map((b: any) => ({
          id: b.id,
          institution_name: b.institution_name,
          last_synced_at: b.last_synced_at,
          account_count: (accountData ?? []).filter((a: any) => a.item_id === b.id).length,
        })))
      }

      if (accountData) {
        setAccounts(accountData.map((a: any) => ({
          ...a,
          institution_name: a.plaid_items?.institution_name ?? null,
        })))
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleConnectBank() {
    if (Platform.OS === 'web') {
      Alert.alert('Mobile only', 'Bank connections are available in the Zerobased mobile app.')
      return
    }

    setConnecting(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      // 1. Get a link token from our edge function
      const { data: linkData, error: linkError } = await supabase.functions.invoke(
        'plaid-create-link-token'
      )
      if (linkError || !linkData?.link_token) {
        const detail = linkData?.error ?? linkError?.message ?? 'Could not start bank connection'
        throw new Error(detail)
      }

      // 2. Open Plaid Link hosted flow in the browser
      //    Plaid sandbox: use https://sandbox.plaid.com/oauth/callback as redirect
      const plaidUrl = `https://cdn.plaid.com/link/v2/stable/link.html?token=${linkData.link_token}`
      const result = await WebBrowser.openAuthSessionAsync(
        plaidUrl,
        'https://zerobased.ca/connect-bank' // universal link redirect URI
      )

      if (result.type !== 'success') {
        setConnecting(false)
        return // user cancelled or dismissed
      }

      // 3. Extract public_token from redirect URL
      const url = new URL(result.url)
      const publicToken = url.searchParams.get('public_token')
      const institutionId = url.searchParams.get('institution_id')
      const institutionName = url.searchParams.get('institution_name')

      if (!publicToken) {
        throw new Error('Bank connection incomplete — please try again.')
      }

      // 4. Exchange with our edge function (stores access_token server-side)
      const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke(
        'plaid-exchange-token',
        { body: { public_token: publicToken, institution_id: institutionId, institution_name: institutionName } }
      )
      if (exchangeError) throw new Error(exchangeError.message)

      // 5. Reload data
      await loadData()

    } catch (err: any) {
      setError(err.message)
    }
    setConnecting(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult('')
    setError('')
    try {
      const { data, error: syncError } = await supabase.functions.invoke('plaid-sync-transactions')
      if (syncError) throw new Error(syncError.message)
      setSyncResult(`✅ ${data?.synced ?? 0} new transactions imported`)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
    setSyncing(false)
  }

  function formatBalance(amount: number | null, currency: string) {
    if (amount == null) return '—'
    return amount.toLocaleString('en-CA', { style: 'currency', currency: currency || 'CAD', maximumFractionDigits: 2 })
  }

  function formatSynced(iso: string | null) {
    if (!iso) return 'Never synced'
    const d = new Date(iso)
    return `Last synced ${d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`
  }

  function accountTypeIcon(type: string, subtype: string | null) {
    if (type === 'credit') return '💳'
    if (subtype === 'savings') return '🏦'
    if (subtype === 'checking') return '💵'
    if (type === 'investment') return '📈'
    if (type === 'loan') return '📋'
    return '🏦'
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  // Free tier wall
  if (subscriptionTier !== 'pro') {
    return (
      <View style={styles.center}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedIcon}>🏦</Text>
          <Text style={styles.lockedTitle}>Bank connections are Pro</Text>
          <Text style={styles.lockedBody}>
            Connect your Canadian bank and automatically import and categorize transactions.
          </Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={() => router.push('/upgrade')}>
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Connected banks</Text>
      <Text style={styles.subtitle}>
        Import transactions automatically from your bank.
      </Text>

      {/* Connect button */}
      <TouchableOpacity
        style={[styles.connectButton, connecting && styles.buttonDisabled]}
        onPress={handleConnectBank}
        disabled={connecting}
      >
        {connecting
          ? <ActivityIndicator color={Colors.text} />
          : <>
              <Text style={styles.connectButtonIcon}>🔗</Text>
              <Text style={styles.connectButtonText}>Connect a bank</Text>
            </>
        }
      </TouchableOpacity>

      {Platform.OS === 'web' && (
        <View style={styles.webNotice}>
          <Text style={styles.webNoticeText}>
            🏦 Bank connections are available in the Zerobased mobile app.
          </Text>
        </View>
      )}

      {/* Connected institutions */}
      {banks.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Connected institutions</Text>
            <TouchableOpacity
              style={[styles.syncButton, syncing && styles.buttonDisabled]}
              onPress={handleSync}
              disabled={syncing}
            >
              {syncing
                ? <ActivityIndicator size="small" color={Colors.text} />
                : <Text style={styles.syncButtonText}>Sync now</Text>
              }
            </TouchableOpacity>
          </View>
          {syncResult ? <Text style={styles.syncResult}>{syncResult}</Text> : null}
          {banks.map(bank => (
            <View key={bank.id} style={styles.bankCard}>
              <Text style={styles.bankIcon}>🏛️</Text>
              <View style={styles.bankInfo}>
                <Text style={styles.bankName}>{bank.institution_name ?? 'Connected bank'}</Text>
                <Text style={styles.bankMeta}>{formatSynced(bank.last_synced_at)}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Account list */}
      {accounts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Accounts</Text>
          {accounts.map(acct => (
            <View key={acct.id} style={styles.accountCard}>
              <Text style={styles.accountIcon}>{accountTypeIcon(acct.type, acct.subtype)}</Text>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>
                  {acct.name}{acct.mask ? ` ····${acct.mask}` : ''}
                </Text>
                {acct.official_name && acct.official_name !== acct.name && (
                  <Text style={styles.accountOfficial}>{acct.official_name}</Text>
                )}
                <Text style={styles.accountType}>
                  {acct.type}{acct.subtype ? ` · ${acct.subtype}` : ''}
                </Text>
              </View>
              <View style={styles.accountBalance}>
                <Text style={styles.accountBalanceAmount}>
                  {formatBalance(acct.balance_current, acct.currency_code)}
                </Text>
                {acct.balance_available != null && acct.balance_available !== acct.balance_current && (
                  <Text style={styles.accountBalanceAvail}>
                    {formatBalance(acct.balance_available, acct.currency_code)} avail.
                  </Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Empty state */}
      {banks.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏦</Text>
          <Text style={styles.emptyTitle}>No banks connected yet</Text>
          <Text style={styles.emptyBody}>
            Tap "Connect a bank" to securely link your Canadian bank accounts and start importing transactions automatically.
          </Text>
          <View style={styles.institutionGrid}>
            {['TD', 'RBC', 'BMO', 'Scotiabank', 'CIBC', 'EQ Bank'].map(name => (
              <View key={name} style={styles.institutionChip}>
                <Text style={styles.institutionChipText}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#f2f4f2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#f2f4f2',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    gap: 16,
  },
  backButton: {
    marginBottom: 4,
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
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 4,
  },

  // Connect button
  connectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButtonIcon: {
    fontSize: 18,
  },
  connectButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },

  webNotice: {
    backgroundColor: Colors.info + '18',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.info + '44',
  },
  webNoticeText: {
    fontSize: 13,
    color: Colors.info,
    textAlign: 'center',
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  syncButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  syncButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  syncResult: {
    fontSize: 14,
    color: Colors.success,
    textAlign: 'center',
  },

  // Bank card
  bankCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bankIcon: {
    fontSize: 28,
  },
  bankInfo: {
    flex: 1,
    gap: 4,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  bankMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Account card
  accountCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountIcon: {
    fontSize: 22,
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  accountOfficial: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  accountType: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  accountBalance: {
    alignItems: 'flex-end',
    gap: 2,
  },
  accountBalanceAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  accountBalanceAvail: {
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Empty state
  emptyState: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  institutionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  institutionChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#f2f4f2',
  },
  institutionChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Locked state
  lockedContainer: {
    alignItems: 'center',
    gap: 16,
    maxWidth: 340,
  },
  lockedIcon: {
    fontSize: 56,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  lockedBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  upgradeButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },

  error: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
})
