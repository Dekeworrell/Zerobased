import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'
import CurrencyInput from './CurrencyInput'

type Account = {
  id: string
  label: string
  type: string
}

type Category = {
  id: string
  label: string
  icon: string
}

type Props = {
  visible: boolean
  category: Category | null
  accounts: Account[]
  categoryDefaults: { [categoryId: string]: string }
  globalDefaultAccountId: string | null
  onClose: () => void
  onSaved: () => void
}

export default function QuickAddSheet({ visible, category, accounts, categoryDefaults, globalDefaultAccountId, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(false)

  const getDefaultAccount = () => {
    if (!category) return null
    const catDefaultId = categoryDefaults[category.id]
    if (catDefaultId) {
      const acc = accounts.find(a => a.id === catDefaultId)
      if (acc) return acc
    }
    if (globalDefaultAccountId) {
      const acc = accounts.find(a => a.id === globalDefaultAccountId)
      if (acc) return acc
    }
    return accounts[0] || null
  }

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  function getAccount() {
    return selectedAccount || getDefaultAccount()
  }

  async function handleSave() {
    if (!amount) { setError('Please enter an amount'); return }
    const account = getAccount()
    if (!account) { setError('No account available'); return }
    if (!category) return

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const parsedAmount = parseFloat(amount)
      const today = new Date()
      const offset = today.getTimezoneOffset()
      const local = new Date(today.getTime() - offset * 60 * 1000)
      const dateStr = local.toISOString().split('T')[0]

      await supabase.from('transactions').insert({
        user_id: user.id,
        category_id: category.id,
        account_id: account.id,
        label: category.label,
        amount: parsedAmount,
        date: dateStr,
        type: 'expense',
        is_unexpected: false,
      })

      const { data: currentAccount } = await supabase
        .from('accounts').select('balance').eq('id', account.id).single()
      if (currentAccount) {
        const newBalance = (parseFloat(currentAccount.balance) || 0) - parsedAmount
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', account.id)
      }

      if (setAsDefault) {
        await supabase.from('category_account_defaults').upsert({
          user_id: user.id,
          category_id: category.id,
          account_id: account.id,
        }, { onConflict: 'user_id,category_id' })
      }

      setAmount('')
      setSelectedAccount(null)
      setSetAsDefault(false)
      onSaved()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  const ACCOUNT_ORDER: { [key: string]: number } = {
    chequing: 0,
    savings: 1,
    creditcard: 2, credit_card: 2, credit: 2,
    heloc: 3,
    loc: 3, line_of_credit: 3,
    carloan: 4, car_loan: 4,
    studentloan: 5, student_loan: 5,
    mortgage: 6,
    other_liability: 7,
    rrsp: 8,
    tfsa: 9,
    fhsa: 10,
    resp: 11,
    pension: 12,
    other: 13,
  }

  function getAccountOrder(type: string): number {
    const t = type.toLowerCase()
    for (const key of Object.keys(ACCOUNT_ORDER)) {
      if (t === key || t.startsWith(key) || t.includes(key)) return ACCOUNT_ORDER[key]
    }
    return 99
  }

  const sortedAccounts = [...accounts].sort((a, b) =>
    getAccountOrder(a.type) - getAccountOrder(b.type)
  )

  const currentAccount = getAccount()

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.categoryLabel}>
            {category?.icon} {category?.label}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Amount</Text>
        <CurrencyInput
          style={styles.amountInput}
          placeholder="$0.00"
          value={amount}
          onChangeText={setAmount}
          autoFocus
        />

        <Text style={styles.fieldLabel}>Account</Text>
        <View style={styles.accountRow}>
          {sortedAccounts.map(acc => (
            <TouchableOpacity
              key={acc.id}
              style={[styles.accountChip, (selectedAccount?.id === acc.id || (!selectedAccount && currentAccount?.id === acc.id)) && styles.accountChipActive]}
              onPress={() => setSelectedAccount(acc)}
            >
              <Text style={[styles.accountChipText, (selectedAccount?.id === acc.id || (!selectedAccount && currentAccount?.id === acc.id)) && styles.accountChipTextActive]}>
                {acc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {currentAccount && (
          <TouchableOpacity style={styles.defaultToggle} onPress={() => setSetAsDefault(!setAsDefault)}>
            <View style={[styles.checkbox, setAsDefault && styles.checkboxActive]}>
              {setAsDefault && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.defaultToggleText}>
              Always use {currentAccount.label} for {category?.label}
            </Text>
          </TouchableOpacity>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moreOptionsBtn}
          onPress={() => {
            onClose()
            router.push({ pathname: '/add-transaction', params: { categoryId: category?.id, categoryLabel: category?.label, categoryIcon: category?.icon } })
          }}
        >
          <Text style={styles.moreOptionsBtnText}>Need more options? Open full form →</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    gap: 12,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryLabel: { fontSize: 20, fontWeight: '700', color: Colors.text },
  closeBtn: { fontSize: 18, color: Colors.textSecondary, padding: 4 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary },
  amountInput: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', paddingVertical: 16 },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card },
  accountChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  accountChipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  accountChipTextActive: { color: Colors.text },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxCheck: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  defaultToggleText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  disabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  moreOptionsBtn: { alignItems: 'center', paddingVertical: 8 },
  moreOptionsBtnText: { color: Colors.primary, fontSize: 14 },
})
