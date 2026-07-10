import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist'
import { GestureHandlerRootView, Pressable as GHPressable } from 'react-native-gesture-handler'
import CurrencyInput from '../../components/CurrencyInput'
import { getAccountIcon, getAssetTypeOptions, LIABILITY_ACCOUNTS as LIABILITY_TYPE_OPTIONS } from '../../constants/accounts'
import { isLiabilityAccount } from '../../constants/categories'
import { Colors } from '../../constants/colors'
import { getSubscriptionTier } from '../../lib/purchases'
import { supabase } from '../../lib/supabase'
import { getCachedHouseholdIds, getCachedUserId } from '../../lib/userCache'

type Account = {
  id: string
  label: string
  type: string
  balance: number
  sort_order: number
}

type ListItem =
  | (Account & { kind: 'account' })
  | { kind: 'divider'; id: string; label: string }

export default function AccountsScreen() {
  const [listData, setListData] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | null>(null)
  const [country, setCountry] = useState<string>('CA')
  const [saving, setSaving] = useState(false)
  const [showAddType, setShowAddType] = useState<'asset' | 'liability' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function buildList(assets: Account[], liabilities: Account[]): ListItem[] {
    return [
      { kind: 'divider', id: 'divider-assets', label: 'Assets' },
      ...assets.map(a => ({ ...a, kind: 'account' as const })),
      { kind: 'divider', id: 'divider-liabilities', label: 'Liabilities' },
      ...liabilities.map(a => ({ ...a, kind: 'account' as const })),
    ]
  }

  useFocusEffect(
    useCallback(() => {
      loadAccounts()
    }, [])
  )

  async function loadAccounts() {
    const userId = await getCachedUserId()
    if (!userId) { router.replace('/'); return }

    const [{ data: profile }, rcTier, userIds] = await Promise.all([
      supabase.from('profiles').select('subscription_tier, country').eq('id', userId).single(),
      getSubscriptionTier(),
      getCachedHouseholdIds(userId),
    ])
    const dbTier = (profile?.subscription_tier as 'free' | 'pro') ?? 'free'
    setSubscriptionTier(dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free')
    setCountry((profile?.country as string) ?? 'CA')

    const { data } = await supabase
      .from('accounts')
      .select('id, label, type, balance, sort_order, user_id')
      .in('user_id', userIds)
      .order('sort_order', { ascending: true })

    if (data) {
      const all = data.map((a: any, i: number) => ({ ...a, sort_order: a.sort_order ?? i }))
      setListData(buildList(
        all.filter((a: Account) => !isLiabilityAccount(a.type)),
        all.filter((a: Account) => isLiabilityAccount(a.type)),
      ))
    }
    setLoading(false)
  }

  function getAccountItems() {
    return listData.filter(i => i.kind === 'account') as (Account & { kind: 'account' })[]
  }

  function updateBalance(id: string, balance: string) {
    setListData(prev => prev.map(i => i.kind === 'account' && i.id === id ? { ...i, balance: balance as any } : i))
  }

  function updateLabel(id: string, label: string) {
    setListData(prev => prev.map(i => i.kind === 'account' && i.id === id ? { ...i, label } : i))
  }

  async function saveSortOrder(accounts: Account[]) {
    try {
      for (let i = 0; i < accounts.length; i++) {
        await supabase.from('accounts').update({ sort_order: i }).eq('id', accounts[i].id)
      }
    } catch (err) {
      console.warn('Sort order save failed:', err)
    }
  }

  async function saveBalances() {
    setSaving(true)
    setError('')
    setSuccess(false)
    setEditingId(null)
    try {
      for (const account of getAccountItems()) {
        await supabase.from('accounts').update({ balance: account.balance, label: account.label }).eq('id', account.id)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function addAccount(type: string, label: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const isLiability = isLiabilityAccount(type)
    const existing = getAccountItems().filter(a => isLiabilityAccount(a.type) === isLiability)
    const { data } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, label, type, balance: 0, sort_order: existing.length })
      .select().single()
    if (data) {
      const newItem: ListItem = { ...data, kind: 'account' }
      setListData(prev => {
        if (isLiability) return [...prev, newItem]
        const divIdx = prev.findIndex(i => i.id === 'divider-liabilities')
        return divIdx === -1 ? [...prev, newItem] : [...prev.slice(0, divIdx), newItem, ...prev.slice(divIdx)]
      })
    }
  }

  async function deleteAccount(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    setListData(prev => prev.filter(i => i.id !== id))
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<ListItem>) {
    if (item.kind === 'divider') {
      return <Text style={styles.sectionTitle}>{item.label}</Text>
    }
    const account = item
    const isEditing = editingId === account.id
    return (
      <ScaleDecorator>
        <View style={[styles.accountRow, isActive && styles.accountRowActive]}>
          <View style={styles.accountLeft}>
            {Platform.OS === 'web' ? (
              <span
                onPointerDown={(e: any) => {
                  e.preventDefault()
                  e.currentTarget.releasePointerCapture(e.pointerId)
                  drag()
                }}
                style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', fontSize: 18, color: Colors.textSecondary, padding: 4 } as any}
              >☰</span>
            ) : (
              <GHPressable onLongPress={drag} delayLongPress={150} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.dragHandle}>☰</Text>
              </GHPressable>
            )}
            <Text style={styles.accountIcon}>{getAccountIcon(account.type)}</Text>
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
      </ScaleDecorator>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (subscriptionTier === 'free') {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeCardTitle}>Track your accounts, debts and net worth.</Text>
          <Text style={styles.upgradeCardBody}>Available on Zerobased Pro.</Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={() => router.push('/upgrade')}>
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const headerComponent = (
    <View style={styles.headerContent}>
      <Text style={styles.title}>Accounts</Text>
      <Text style={styles.dragHint}>Hold ☰ to drag and reorder</Text>
    </View>
  )

  const footerComponent = (
    <View style={styles.footerContent}>
      <TouchableOpacity
        style={styles.addSmallBtn}
        onPress={() => setShowAddType(showAddType === 'asset' ? null : 'asset')}
      >
        <Text style={styles.addSmallBtnText}>{showAddType === 'asset' ? '− Hide' : '+ Add asset'}</Text>
      </TouchableOpacity>
      {showAddType === 'asset' && (
        <View style={styles.typeGrid}>
          {[...getAssetTypeOptions(country)].sort((a, b) => a.label.localeCompare(b.label)).map(type => (
            <TouchableOpacity key={type.id} style={styles.typeChip} onPress={() => addAccount(type.id, type.label)}>
              <Text style={styles.typeChipIcon}>{type.icon}</Text>
              <Text style={styles.typeChipLabel}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={styles.addSmallBtn}
        onPress={() => setShowAddType(showAddType === 'liability' ? null : 'liability')}
      >
        <Text style={styles.addSmallBtnText}>{showAddType === 'liability' ? '− Hide' : '+ Add liability'}</Text>
      </TouchableOpacity>
      {showAddType === 'liability' && (
        <View style={styles.typeGrid}>
          {[...LIABILITY_TYPE_OPTIONS].sort((a, b) => a.label.localeCompare(b.label)).map(type => (
            <TouchableOpacity key={type.id} style={styles.typeChip} onPress={() => addAccount(type.id, type.label)}>
              <Text style={styles.typeChipIcon}>{type.icon}</Text>
              <Text style={styles.typeChipLabel}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>✅ Balances saved!</Text> : null}
      <View style={{ height: 100 }} />
    </View>
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DraggableFlatList
        data={listData}
        onDragEnd={({ data }) => {
          // Re-separate by type after every drag to prevent cross-section reordering.
          // Relative order within each section is preserved from the drag result.
          const newAssets = data.filter(i => i.kind === 'account' && !isLiabilityAccount((i as Account).type)) as Account[]
          const newLiabilities = data.filter(i => i.kind === 'account' && isLiabilityAccount((i as Account).type)) as Account[]
          setListData(buildList(newAssets, newLiabilities))
          saveSortOrder([...newAssets, ...newLiabilities])
        }}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={headerComponent}
        ListFooterComponent={footerComponent}
        containerStyle={styles.container}
        contentContainerStyle={styles.content}
      />
      <View style={styles.floatingButton}>
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
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f2f4f2' },
  content: { paddingHorizontal: 24, paddingBottom: 100, maxWidth: 600, alignSelf: 'center', width: '100%' },
  headerContent: { paddingTop: 60, gap: 16, marginBottom: 10 },
  footerContent: { gap: 16, marginTop: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.text },
  dragHint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4, marginTop: 8 },
  accountRow: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  accountRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '11',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dragHandle: { fontSize: 18, color: Colors.textSecondary },
  accountIcon: { fontSize: 22 },
  accountLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  accountLabelInput: {
    fontSize: 15, color: Colors.text, fontWeight: '500', flex: 1,
    borderBottomWidth: 1, borderBottomColor: Colors.primary, paddingVertical: 2,
  },
  accountLabelHint: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  accountRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceInput: {
    backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: '#e3e8e3',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 15, color: Colors.text, width: 110, textAlign: 'right',
  },
  deleteBtn: { color: Colors.textSecondary, fontSize: 16, paddingHorizontal: 4, paddingVertical: 4 },
  addSmallBtn: {
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, borderStyle: 'dashed',
  },
  addSmallBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: {
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  typeChipIcon: { fontSize: 14 },
  typeChipLabel: { fontSize: 14, color: Colors.text },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  successText: { color: Colors.success, fontSize: 15, textAlign: 'center', fontWeight: '500' },
  floatingButton: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#f2f4f2', paddingHorizontal: 24,
    paddingVertical: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#e3e8e3', alignItems: 'center',
  },
  primaryButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', width: '100%', maxWidth: 500 },
  disabled: { opacity: 0.4 },
  primaryButtonText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  lockedContainer: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center', padding: 24 },
  upgradeCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, width: '100%', maxWidth: 400 },
  upgradeCardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  upgradeCardBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  upgradeButton: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, marginTop: 8 },
  upgradeButtonText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
})
