import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../components/CurrencyInput'
import { ASSET_TYPE_OPTIONS, LIABILITY_ACCOUNTS as LIABILITY_TYPE_OPTIONS, getAccountIcon } from '../constants/accounts'
import { isLiabilityAccount } from '../constants/categories'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'


type Account = {
  id: string
  label: string
  type: string
  balance: number

}


export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddType, setShowAddType] = useState<'asset' | 'liability' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      loadAccounts()
    }, [])
  )
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

  function updateBalance(id: string, balance: string) {
    setAccounts(accounts.map(a => a.id === id ? { ...a, balance: balance as any } : a))
  }

  function updateLabel(id: string, label: string) {
    setAccounts(accounts.map(a => a.id === id ? { ...a, label } : a))
  }

  async function saveBalances() {
    setSaving(true)
    setError('')
    setSuccess(false)
    setEditingId(null)

    try {
      for (const account of accounts) {
        await supabase
          .from('accounts')
          .update({ 
            balance: account.balance,
            label: account.label,
          })
          .eq('id', account.id)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function addAccount(type: string, label: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, label, type, balance: 0 })
      .select()
      .single()

    if (data) {
      setAccounts([...accounts, data])
      setShowAddType(null)
    }
  }

  async function deleteAccount(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  function isLiability(type: string) {
    return isLiabilityAccount(type)
  }

  const assets = accounts.filter(a => !isLiability(a.type))
  const liabilities = accounts.filter(a => isLiability(a.type))
  const totalAssets = assets.reduce((sum, a) => sum + (parseFloat(a.balance.toString()) || 0), 0)
  const totalLiabilities = liabilities.reduce((sum, a) => sum + (parseFloat(a.balance.toString()) || 0), 0)
  const netWorth = totalAssets - totalLiabilities

  function getIcon(type: string) {
    return getAccountIcon(type)
  }
  
  function renderAccount(account: Account) {
    const isEditing = editingId === account.id
    return (
      <View key={account.id} style={styles.accountRow}>
        <View style={styles.accountLeft}>
          <Text style={styles.accountIcon}>
            {getIcon(account.type)}
          </Text>
          {isEditing ? (
            <TextInput
              style={styles.accountLabelInput}
              value={account.label}
              onChangeText={(val) => updateLabel(account.id, val)}
              autoFocus
              onBlur={() => setEditingId(null)}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingId(account.id)} style={{ flex: 1 }}>
              <Text style={styles.accountLabel}>{account.label}</Text>
              <Text style={styles.accountLabelHint}>tap to rename</Text>
            </TouchableOpacity>
          )}
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
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Accounts</Text>

      <Text style={styles.sectionTitle}>Assets</Text>
      {assets.length > 0 && (
        <View style={styles.accountList}>
          {assets.map(account => renderAccount(account))}
        </View>
      )}
      <TouchableOpacity
        style={styles.addSmallBtn}
        onPress={() => setShowAddType(showAddType === 'asset' ? null : 'asset')}
      >
        <Text style={styles.addSmallBtnText}>
          {showAddType === 'asset' ? '− Cancel' : '+ Add asset'}
        </Text>
      </TouchableOpacity>
      {showAddType === 'asset' && (
        <View style={styles.typeGrid}>
          {[...ASSET_TYPE_OPTIONS].sort((a, b) => a.label.localeCompare(b.label)).map(type => (
            <TouchableOpacity
              key={type.id}
              style={styles.typeChip}
              onPress={() => addAccount(type.id, type.label)}
            >
              <Text style={styles.typeChipIcon}>{type.icon}</Text>
              <Text style={styles.typeChipLabel}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Liabilities</Text>
      {liabilities.length > 0 && (
        <View style={styles.accountList}>
          {liabilities.map(account => renderAccount(account))}
        </View>
      )}
      <TouchableOpacity
        style={styles.addSmallBtn}
        onPress={() => setShowAddType(showAddType === 'liability' ? null : 'liability')}
      >
        <Text style={styles.addSmallBtnText}>
          {showAddType === 'liability' ? '− Cancel' : '+ Add liability'}
        </Text>
      </TouchableOpacity>
      {showAddType === 'liability' && (
        <View style={styles.typeGrid}>
          {[...LIABILITY_TYPE_OPTIONS].sort((a, b) => a.label.localeCompare(b.label)).map(type => (
            <TouchableOpacity
              key={type.id}
              style={styles.typeChip}
              onPress={() => addAccount(type.id, type.label)}
            >
              <Text style={styles.typeChipIcon}>{type.icon}</Text>
              <Text style={styles.typeChipLabel}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
    </KeyboardAvoidingView>
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
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  netWorthCard: {
    backgroundColor: '#edf7f1',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#b6dfc0',
  },
  netWorthLabel: {
    fontSize: 14,
    color: '#1f7a45',
    fontWeight: '600',
  },
  netWorthAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#0A2A1A',
  },
  netWorthRow: {
    flexDirection: 'row',
    gap: 24,
  },
  netWorthSub: {
    fontSize: 13,
    color: '#1f7a45',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
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
  accountLabelInput: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 2,
  },
  accountLabelHint: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceInput: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
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
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  addSmallBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addSmallBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
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
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  interestLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  interestInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    color: Colors.text,
    width: 70,
    textAlign: 'right',
  },
})