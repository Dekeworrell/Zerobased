import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../components/CurrencyInput'
import { Colors } from '../constants/colors'
import { checkBudgetAndNotify, schedulePaydayReminder } from '../lib/notifications'
import { supabase } from '../lib/supabase'

type Category = {
  id: string
  label: string
  icon: string
}

type Account = {
  id: string
  label: string
  type: string
}

export default function AddTransactionScreen() {
  const { categoryId, categoryLabel, categoryIcon } = useLocalSearchParams<{ categoryId?: string, categoryLabel?: string, categoryIcon?: string }>()
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    categoryId && categoryLabel && categoryIcon ? { id: categoryId, label: categoryLabel, icon: categoryIcon } : null
  )
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(() => {
    const now = new Date()
    const offset = now.getTimezoneOffset()
    return new Date(now.getTime() - offset * 60 * 1000)
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [type, setType] = useState<'expense' | 'income' | 'unexpected'>('expense')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [accountsExpanded, setAccountsExpanded] = useState(true)
  const [categoriesExpanded, setCategoriesExpanded] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: cats } = await supabase
      .from('budget_categories')
      .select('id, label, icon')
      .eq('user_id', user.id)

    if (cats) setCategories(cats)

    const { data: accs } = await supabase
      .from('accounts')
      .select('id, label, type')
      .eq('user_id', user.id)

    if (accs) setAccounts(accs)

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_account_id')
      .eq('id', user.id)
      .single()

    if (profile?.default_account_id) {
      setDefaultAccountId(profile.default_account_id)
      const defaultAcc = accs?.find((a: Account) => a.id === profile.default_account_id)
      if (defaultAcc) setSelectedAccount(defaultAcc)
    }

    setLoading(false)
  }

  function formatDateDisplay(d: Date) {
    return d.toLocaleDateString('en-CA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function formatDateForDB(d: Date) {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  async function handleSave() {
    if (!amount) {
      Alert.alert('Missing amount', 'Please enter a transaction amount before saving.')
      return
    }
    if (!selectedAccount) {
      Alert.alert('No account selected', 'Please select an account to log this transaction against.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const parsedAmount = parseFloat(amount)

      await supabase.from('transactions').insert({
        user_id: user.id,
        category_id: type === 'unexpected' ? null : selectedCategory?.id || null,
        account_id: selectedAccount.id,
        label: label || selectedCategory?.label || 'Transaction',
        amount: parsedAmount,
        date: formatDateForDB(date),
        type: type === 'unexpected' ? 'expense' : type,
        is_unexpected: type === 'unexpected',
      })

      const { data: currentAccount } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', selectedAccount.id)
        .single()

      if (currentAccount) {
        const currentBalance = parseFloat(currentAccount.balance) || 0
        let newBalance = currentBalance

        if (type === 'income') {
          newBalance = currentBalance + parsedAmount
        } else {
          newBalance = currentBalance - parsedAmount
        }

        await supabase
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', selectedAccount.id)
      }

      if (setAsDefault) {
        await supabase
          .from('profiles')
          .update({ default_account_id: selectedAccount.id })
          .eq('id', user.id)
      }
        const { data: profile } = await supabase
        .from('profiles')
        .select('notifications_enabled, notify_at_percent_1, notify_at_percent_2')
        .eq('id', user.id)
        .single()

      if (profile?.notifications_enabled && type !== 'income') {
        const { data: cats } = await supabase
          .from('budget_categories')
          .select('*')
          .eq('user_id', user.id)

        const { data: txns } = await supabase
          .from('transactions')
          .select('category_id, amount, type')
          .eq('user_id', user.id)
          .eq('type', 'expense')

        if (cats && txns) {
          await checkBudgetAndNotify(
            cats,
            txns,
            profile.notify_at_percent_1 || 80,
            profile.notify_at_percent_2 || 90,
            true
          )
        }
      }

      if ((type as string) === 'income' && profile?.notifications_enabled) {
        const { data: incomeData } = await supabase
          .from('income_sources')
          .select('next_payday, frequency')
          .eq('user_id', user.id)
          .single()

        if (incomeData?.next_payday) {
          await schedulePaydayReminder(incomeData.next_payday)
        }
      }
      router.replace('/dashboard')

    } catch (err: any) {
      setError(err.message)
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.push('/dashboard')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Add transaction</Text>

      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]}
          onPress={() => { setType('expense'); setSelectedCategory(null) }}
        >
          <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>
            Expense
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'income' && styles.typeBtnActive]}
          onPress={() => { setType('income'); setSelectedCategory(null) }}
        >
          <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>
            Income
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'unexpected' && styles.typeBtnUnexpectedActive]}
          onPress={() => { setType('unexpected'); setSelectedCategory(null) }}
        >
          <Text style={[styles.typeBtnText, type === 'unexpected' && styles.typeBtnTextActive]}>
            ⚠️ Unexpected
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Amount</Text>
      <CurrencyInput
        style={styles.amountInput}
        placeholder="$0.00"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.fieldLabel}>Description (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="What was this for?"
        placeholderTextColor={Colors.textSecondary}
        value={label}
        onChangeText={setLabel}
        selectTextOnFocus
      />

      <Text style={styles.fieldLabel}>Date</Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={formatDateForDB(date)}
          max={formatDateForDB(new Date())}
          onChange={(e) => {
            if (e.target.value) setDate(new Date(e.target.value + 'T12:00:00'))
          }}
          style={{
            backgroundColor: '#1c1c1e',
            border: '1px solid #3a3a3c',
            borderRadius: 12,
            padding: '14px 16px',
            fontSize: 16,
            color: '#ffffff',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>📅  {formatDateDisplay(date)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setDate(selectedDate)
                  if (Platform.OS === 'android') setShowDatePicker(false)
                }}
                maximumDate={new Date()}
              />
              <TouchableOpacity
                style={styles.datePickerDoneBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {(type === 'expense' || type === 'unexpected') && (
        <>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setCategoriesExpanded(!categoriesExpanded)}
          >
            <Text style={styles.fieldLabel}>
              {type === 'unexpected' ? 'Unexpected expense for' : 'Category'}
              {selectedCategory ? ` — ${selectedCategory.label}` : ''}
            </Text>
            <Text style={styles.sectionChevron}>{categoriesExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {type === 'unexpected' && (
            <View style={styles.unexpectedInfo}>
              <Text style={styles.unexpectedInfoText}>
                ⚠️ Unexpected expenses are tracked separately to help identify patterns and improve future budget suggestions.
              </Text>
            </View>
          )}
          {categoriesExpanded && <View style={styles.categoryList}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryRow,
                  selectedCategory?.id === cat.id && styles.categoryRowActive
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <View style={styles.categoryRowLeft}>
                  <Text style={styles.categoryRowIcon}>{cat.icon}</Text>
                  <Text style={[
                    styles.categoryRowText,
                    selectedCategory?.id === cat.id && styles.categoryRowTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </View>
                {selectedCategory?.id === cat.id && (
                  <Text style={styles.categoryRowCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>}
        </>
      )}

      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setAccountsExpanded(!accountsExpanded)}
      >
        <Text style={styles.fieldLabel}>
          Account {selectedAccount ? `— ${selectedAccount.label}` : ''}
        </Text>
        <Text style={styles.sectionChevron}>{accountsExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {accountsExpanded && <View style={styles.accountList}>
        {accounts.map(acc => (
          <TouchableOpacity
            key={acc.id}
            style={[
              styles.accountRow,
              selectedAccount?.id === acc.id && styles.accountRowActive
            ]}
            onPress={() => setSelectedAccount(acc)}
          >
            <Text style={[
              styles.accountRowText,
              selectedAccount?.id === acc.id && styles.accountRowTextActive
            ]}>
              🏦 {acc.label}
            </Text>
            {selectedAccount?.id === acc.id && (
              <Text style={styles.accountRowCheck}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>}

      {selectedAccount && selectedAccount.id !== defaultAccountId && (
        <TouchableOpacity
          style={styles.defaultToggle}
          onPress={() => setSetAsDefault(!setAsDefault)}
        >
          <View style={[styles.checkbox, setAsDefault && styles.checkboxActive]}>
            {setAsDefault && <Text style={styles.checkboxCheck}>✓</Text>}
          </View>
          <Text style={styles.defaultToggleText}>Set as default account</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ height: 80 }} />
    </ScrollView>

    <View style={styles.floatingButton}>
      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.primaryButtonText}>Save transaction</Text>
        }
      </TouchableOpacity>
    </View>
    </KeyboardAvoidingView>
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
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    gap: 12,
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
    marginBottom: 8,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
  },
  typeBtnUnexpectedActive: {
    backgroundColor: Colors.warning,
  },
  typeBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: Colors.text,
  },
  fieldLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 20,
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
  dateButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.text,
  },
  datePickerDoneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  datePickerDoneBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  accountList: {
    gap: 8,
  },
  accountRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '22',
  },
  accountRowText: {
    fontSize: 15,
    color: Colors.text,
  },
  accountRowTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  accountRowCheck: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxCheck: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  defaultToggleText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  unexpectedInfo: {
    backgroundColor: Colors.warning + '22',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 12,
    padding: 12,
  },
  unexpectedInfoText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  categoryList: {
    gap: 8,
  },
  categoryRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '22',
  },
  categoryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryRowIcon: {
    fontSize: 20,
  },
  categoryRowText: {
    fontSize: 15,
    color: Colors.text,
  },
  categoryRowTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  categoryRowCheck: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
    maxWidth: 500,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionChevron: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
})