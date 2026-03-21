import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../components/CurrencyInput'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

type Account = {
  id: string
  label: string
  type: string
  balance: number
  isEditing?: boolean
}

const ACCOUNT_ICONS: { [key: string]: string } = {
  chequing: '💳',
  savings: '🏦',
  rrsp: '📈',
  tfsa: '🛡️',
  fhsa: '🏠',
  resp: '🎓',
  mortgage: '🏠',
  heloc: '🏦',
  loc: '💳',
  credit: '💰',
  loan: '📋',
  other: '➕',
}

const ACCOUNT_TYPES = [
  { id: 'chequing', label: 'Chequing', icon: '💳' },
  { id: 'savings', label: 'Savings', icon: '🏦' },
  { id: 'rrsp', label: 'RRSP', icon: '📈' },
  { id: 'tfsa', label: 'TFSA', icon: '🛡️' },
  { id: 'fhsa', label: 'FHSA', icon: '🏠' },
  { id: 'resp', label: 'RESP', icon: '🎓' },
  { id: 'mortgage', label: 'Mortgage', icon: '🏠' },
  { id: 'heloc', label: 'HELOC', icon: '🏦' },
  { id: 'loc', label: 'Line of credit', icon: '💳' },
  { id: 'credit', label: 'Credit Card', icon: '💰' },
  { id: 'loan', label: 'Loan', icon: '📋' },
  { id: 'other', label: 'Other', icon: '➕' },
]

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }

    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (data) setAccounts(data)
    setLoading(false)
  }

  async function updateBalance(id: string, balance: string) {
    setAccounts(accounts.map(a => a.id === id ? { ...a, balance: parseFloat(balance) || 0 } : a))
  }

  async function saveBalances() {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      for (const account of accounts) {
        await supabase
          .from('accounts')
          .update({ balance: account.balance })
          .eq('id', account.id)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function addAccount(type: string, label: string, icon: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, label, type, balance: 0 })
      .select()
      .single()

    if (data) {
      setAccounts([...accounts, data])
      setShowAddAccount(false)
    }
  }

  async function deleteAccount(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(accounts.filter(a => a.id !== id))
  }

  const assets = accounts.filter(a => !['mortgage', 'heloc', 'loc', 'credit', 'loan'].includes(a.type))
  const liabilities = accounts.filter(a => ['mortgage', 'heloc', 'loc', 'credit', 'loan'].includes(a.type))
  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0)
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0)
  const netWorth = totalAssets - totalLiabilities

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Accounts</Text>

      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Net worth</Text>
        <Text style={styles.netWorthAmount}>
          ${netWorth.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </Text>
        <View style={styles.netWorthRow}>
          <Text style={styles.netWorthSub}>
            Assets: ${totalAssets.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.netWorthSub}>
            Liabilities: ${totalLiabilities.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
        </View>
      </View>

      {assets.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Assets</Text>
          <View style={styles.accountList}>
            {assets.map(account => (
              <View key={account.id} style={styles.accountRow}>
                <View style={styles.accountLeft}>
                  <Text style={styles.accountIcon}>
                    {ACCOUNT_ICONS[account.type] || '💳'}
                  </Text>
                  <Text style={styles.accountLabel}>{account.label}</Text>
                </View>
                <View style={styles.accountRight}>
                  <CurrencyInput
                    style={styles.balanceInput}
                    placeholder="$0.00"
                    value={account.balance}
                    onChangeText={(val) => updateBalance(index, val)}
                    tabIndex={index + 1}
                  />
                  <TouchableOpacity onPress={() => deleteAccount(account.id)}>
                    <Text style={styles.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {liabilities.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Liabilities</Text>
          <View style={styles.accountList}>
            {liabilities.map(account => (
              <View key={account.id} style={styles.accountRow}>
                <View style={styles.accountLeft}>
                  <Text style={styles.accountIcon}>
                    {ACCOUNT_ICONS[account.type] || '💳'}
                  </Text>
                  <Text style={styles.accountLabel}>{account.label}</Text>
                </View>
                <View style={styles.accountRight}>
                  <CurrencyInput
                    style={styles.balanceInput}
                    value={account.balance.toString()}
                    onChangeText={(val) => updateBalance(account.id, val)}
                    placeholder="$0"
                  />
                  <TouchableOpacity onPress={() => deleteAccount(account.id)}>
                    <Text style={styles.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {showAddAccount && (
        <>
          <Text style={styles.sectionTitle}>Add account</Text>
          <View style={styles.typeGrid}>
            {ACCOUNT_TYPES.filter(t => !accounts.find(a => a.type === t.id)).map(type => (
              <TouchableOpacity
                key={type.id}
                style={styles.typeChip}
                onPress={() => addAccount(type.id, type.label, type.icon)}
              >
                <Text style={styles.typeChipIcon}>{type.icon}</Text>
                <Text style={styles.typeChipLabel}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddAccount(!showAddAccount)}
      >
        <Text style={styles.addButtonText}>
          {showAddAccount ? '− Cancel' : '+ Add account'}
        </Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>✅ Balances saved!</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={saveBalances}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.primaryButtonText}>Save balances</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    gap: 16,
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
  netWorthCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  netWorthLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  netWorthAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.text,
  },
  netWorthRow: {
    flexDirection: 'row',
    gap: 24,
  },
  netWorthSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  accountList: {
    gap: 10,
  },
  accountRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accountIcon: {
    fontSize: 22,
  },
  accountLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: Colors.text,
    width: 110,
    textAlign: 'right',
  },
  deleteBtn: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeChipIcon: {
    fontSize: 14,
  },
  typeChipLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  addButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '500',
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
    marginTop: 8,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
})