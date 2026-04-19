import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../components/CurrencyInput'
import KeyboardScrollView from '../components/KeyboardScrollView'
import TransactionEditSheet from '../components/TransactionEditSheet'
import { balanceChangeOnExpense, balanceChangeOnIncome, balanceChangeOnTransferFrom, balanceChangeOnTransferTo, isAssetAccount, isInvestmentAccount, isPayableFromAccount, isPayToOnlyLiability, isPrimaryPayable } from '../constants/categories'
import { Colors } from '../constants/colors'
import { checkBudgetAndNotify, schedulePaydayReminder } from '../lib/notifications'
import { getPayPeriodDates, toMonthly } from '../lib/store'
import { supabase } from '../lib/supabase'

type Category = { id: string; label: string; icon: string }
type Account = { id: string; label: string; type: string }
type HistoryTransaction = {
  id: string; label: string; amount: number; date: string
  type: string; is_unexpected: boolean; category_id: string | null
  account_id: string | null; category: { label: string; icon: string } | null
}

export default function AddTransactionScreen() {
  const { categoryId, categoryLabel, categoryIcon } = useLocalSearchParams<{ categoryId?: string, categoryLabel?: string, categoryIcon?: string }>()

  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [globalDefaultAccountId, setGlobalDefaultAccountId] = useState<string | null>(null)
  const [categoryDefaults, setCategoryDefaults] = useState<{ [categoryId: string]: string }>({})
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(() => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [type, setType] = useState<'expense' | 'income' | 'unexpected' | 'transfer'>('expense')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [categoriesExpanded, setCategoriesExpanded] = useState(!categoryId)
  const [toAccount, setToAccount] = useState<Account | null>(null)

  // History tab
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log')
  const [historyView, setHistoryView] = useState<'cycle' | 'monthly'>('cycle')
  const [categoryHistory, setCategoryHistory] = useState<HistoryTransaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [budgetedAmount, setBudgetedAmount] = useState(0)
  const [payPeriodStart, setPayPeriodStart] = useState<Date | null>(null)
  const [payPeriodEnd, setPayPeriodEnd] = useState<Date | null>(null)
  const [budgetCycle, setBudgetCycle] = useState<'monthly' | 'paycycle'>('monthly')
  const [payPeriodLabel, setPayPeriodLabel] = useState('')
  const [editingTransaction, setEditingTransaction] = useState<HistoryTransaction | null>(null)
  const scrollRef = useRef<any>(null)
  const [showMoreIncomeAccounts, setShowMoreIncomeAccounts] = useState(false)

  useFocusEffect(
    useCallback(() => {
      const now = new Date()
      setAmount('')
      setLabel('')
      setType('expense')
      setError('')
      setSetAsDefault(false)
      setActiveTab('log')
      setCategoryHistory([])
      setToAccount(null)
      setShowMoreIncomeAccounts(false)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      setDate(new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000))
      if (categoryId && categoryLabel && categoryIcon) {
        setSelectedCategory({ id: categoryId, label: categoryLabel, icon: categoryIcon })
        setCategoriesExpanded(false)
      } else {
        setSelectedCategory(null)
        setCategoriesExpanded(true)
      }
      loadData()
    }, [categoryId])
  )

  useEffect(() => {
    if (activeTab === 'history' && selectedCategory) {
      loadHistory(selectedCategory.id, historyView)
    }
  }, [activeTab, historyView, selectedCategory?.id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: cats }, { data: accs }, { data: profile }, { data: catDefaults }, { data: income }] = await Promise.all([
      supabase.from('budget_categories').select('id, label, icon').eq('user_id', user.id),
      supabase.from('accounts').select('id, label, type').eq('user_id', user.id),
      supabase.from('profiles').select('default_account_id, budget_cycle').eq('id', user.id).single(),
      supabase.from('category_account_defaults').select('category_id, account_id').eq('user_id', user.id),
      supabase.from('income_sources').select('*').eq('user_id', user.id),
    ])

    if (cats) setCategories(cats)
    if (accs) setAccounts(accs)

    const globalDefault = profile?.default_account_id || null
    setGlobalDefaultAccountId(globalDefault)

    const cycle = profile?.budget_cycle || 'monthly'
    setBudgetCycle(cycle)

    // Calculate pay period
    if (income && income.length > 0) {
      const now = new Date()
      if (cycle === 'paycycle') {
        const primary = income.find((s: any) => s.next_payday) || income[0]
        if (primary?.next_payday) {
          const { start, end } = getPayPeriodDates(primary.next_payday, primary.frequency)
          setPayPeriodStart(start)
          setPayPeriodEnd(end)
          const startStr = start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
          const endStr = end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
          setPayPeriodLabel(`${startStr} – ${endStr}`)
        }
      } else {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        setPayPeriodStart(start)
        setPayPeriodEnd(end)
        setPayPeriodLabel(now.toLocaleDateString('en-CA', { month: 'long' }))
      }
    }

    const defaultMap: { [key: string]: string } = {}
    if (catDefaults) catDefaults.forEach((d: any) => { defaultMap[d.category_id] = d.account_id })
    setCategoryDefaults(defaultMap)

    if (categoryId && accs) {
      const catDefault = defaultMap[categoryId]
      if (catDefault) {
        const acc = accs.find((a: Account) => a.id === catDefault)
        if (acc) { setSelectedAccount(acc); setLoading(false); return }
      }
      if (globalDefault) {
        const acc = accs.find((a: Account) => a.id === globalDefault)
        if (acc) setSelectedAccount(acc)
      }
    } else if (globalDefault && accs) {
      const acc = accs.find((a: Account) => a.id === globalDefault)
      if (acc) setSelectedAccount(acc)
    }

    setLoading(false)
  }

  async function loadHistory(catId: string, view: 'cycle' | 'monthly') {
    setHistoryLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date()
      let start: Date, end: Date

      if (view === 'monthly' || budgetCycle === 'monthly' || !payPeriodStart || !payPeriodEnd) {
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      } else {
        start = payPeriodStart
        end = payPeriodEnd
      }

      const [{ data: txns }, { data: cat }] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, label, amount, date, type, is_unexpected, category_id, account_id, category:budget_categories(label, icon)')
          .eq('user_id', user.id)
          .eq('category_id', catId)
          .gte('date', start.toISOString().split('T')[0])
          .lte('date', end.toISOString().split('T')[0])
          .order('date', { ascending: false }),
        supabase.from('budget_categories').select('budgeted_amount, frequency').eq('id', catId).single(),
      ])

      if (txns) setCategoryHistory(txns as any)
      if (cat) {
        const monthly = toMonthly(cat.budgeted_amount.toString(), cat.frequency)
        if (view === 'cycle' && payPeriodStart && payPeriodEnd && budgetCycle === 'paycycle') {
          const days = Math.round((payPeriodEnd.getTime() - payPeriodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
          setBudgetedAmount((monthly / 30) * days)
        } else {
          setBudgetedAmount(monthly)
        }
      }
    } catch (err) { console.error(err) }
    setHistoryLoading(false)
  }

  function handleCategorySelect(cat: Category) {
    setSelectedCategory(cat)
    setCategoriesExpanded(false)
    const catDefault = categoryDefaults[cat.id]
    if (catDefault) {
      const acc = accounts.find(a => a.id === catDefault)
      if (acc) { setSelectedAccount(acc); return }
    }
    if (globalDefaultAccountId) {
      const acc = accounts.find(a => a.id === globalDefaultAccountId)
      if (acc) setSelectedAccount(acc)
    }
  }

  function formatDateDisplay(d: Date) {
    return d.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  }

  function formatDateForDB(d: Date) {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().split('T')[0]
  }

  async function handleSave() {
    if (!amount) { Alert.alert('Missing amount', 'Please enter a transaction amount before saving.'); return }
    if (type === 'transfer') {
      if (!selectedAccount) { Alert.alert('Missing account', 'Please select the From account.'); return }
      if (!toAccount) { Alert.alert('Missing account', 'Please select the To account.'); return }
      if (selectedAccount.id === toAccount.id) { Alert.alert('Same account', 'From and To accounts must be different.'); return }
    } else {
      if (!selectedAccount) { Alert.alert('No account selected', 'Please select an account to log this transaction against.'); return }
    }

    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const parsedAmount = parseFloat(amount)

      if (type === 'transfer') {
          await supabase.from('transactions').insert({
            user_id: user.id,
            account_id: selectedAccount.id,
            from_account_id: selectedAccount.id,
            to_account_id: toAccount!.id,
            label: label || `Transfer → ${toAccount!.label}`,
            amount: parsedAmount,
            date: formatDateForDB(date),
            type: 'transfer',
            is_unexpected: false,
            category_id: null,
          })

          const { data: fromAcc } = await supabase.from('accounts').select('balance').eq('id', selectedAccount.id).single()
          if (fromAcc) {
            const current = parseFloat(fromAcc.balance) || 0
            await supabase.from('accounts').update({ balance: current + balanceChangeOnTransferFrom(selectedAccount.type, parsedAmount) }).eq('id', selectedAccount.id)
          }

          const { data: toAcc } = await supabase.from('accounts').select('balance').eq('id', toAccount!.id).single()
          if (toAcc) {
            const current = parseFloat(toAcc.balance) || 0
            await supabase.from('accounts').update({ balance: current + balanceChangeOnTransferTo(toAccount!.type, parsedAmount) }).eq('id', toAccount!.id)
          }

        } else {
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
            .from('accounts').select('balance').eq('id', selectedAccount.id).single()
          if (currentAccount) {
            const current = parseFloat(currentAccount.balance) || 0
            const delta = type === 'income'
              ? balanceChangeOnIncome(selectedAccount.type, parsedAmount)
              : balanceChangeOnExpense(selectedAccount.type, parsedAmount)
            await supabase.from('accounts').update({ balance: current + delta }).eq('id', selectedAccount.id)
          }
        }

      if (setAsDefault && selectedCategory) {
        await supabase.from('category_account_defaults').upsert({
          user_id: user.id,
          category_id: selectedCategory.id,
          account_id: selectedAccount.id,
        }, { onConflict: 'user_id,category_id' })
        setCategoryDefaults(prev => ({ ...prev, [selectedCategory.id]: selectedAccount.id }))
      }

      const { data: profile } = await supabase
        .from('profiles').select('notifications_enabled, notify_at_percent_1, notify_at_percent_2')
        .eq('id', user.id).single()

      if (profile?.notifications_enabled && type !== 'income') {
        const { data: cats } = await supabase.from('budget_categories').select('*').eq('user_id', user.id)
        const { data: txns } = await supabase.from('transactions').select('category_id, amount, type').eq('user_id', user.id).eq('type', 'expense')
        if (cats && txns) await checkBudgetAndNotify(cats, txns, profile.notify_at_percent_1 || 80, profile.notify_at_percent_2 || 90, true)
      }

      if (type === 'income' && profile?.notifications_enabled) {
        const { data: incomeData } = await supabase.from('income_sources').select('next_payday, frequency').eq('user_id', user.id).single()
        if (incomeData?.next_payday) await schedulePaydayReminder(incomeData.next_payday)
      }

      router.replace('/dashboard')
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  const totalSpent = categoryHistory.reduce((sum, t) => sum + t.amount, 0)
  const spentPercent = budgetedAmount > 0 ? Math.min((totalSpent / budgetedAmount) * 100, 100) : 0

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <>
      <KeyboardScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.push('/dashboard')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Add transaction</Text>

        <View style={styles.typeToggle}>
          <TouchableOpacity style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]} onPress={() => { setType('expense'); setSelectedCategory(null); setCategoriesExpanded(true); setActiveTab('log'); setToAccount(null) }}>
            <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, type === 'income' && styles.typeBtnActive]} onPress={() => { setType('income'); setSelectedCategory(null); setCategoriesExpanded(false); setActiveTab('log'); setToAccount(null) }}>
            <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>Income</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, type === 'unexpected' && styles.typeBtnUnexpectedActive]} onPress={() => { setType('unexpected'); setSelectedCategory(null); setCategoriesExpanded(false); setActiveTab('log'); setToAccount(null) }}>
            <Text style={[styles.typeBtnText, type === 'unexpected' && styles.typeBtnTextActive]}>⚠️ Unexpected</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, type === 'transfer' && styles.typeBtnTransferActive]} onPress={() => { setType('transfer' as any); setSelectedCategory(null); setCategoriesExpanded(false); setActiveTab('log') }}>
            <Text style={[styles.typeBtnText, type === 'transfer' && styles.typeBtnTextActive]}>⇄ Transfer</Text>
          </TouchableOpacity>
        </View>

        {/* Transfer UI */}
        {type === 'transfer' && (
          <View style={styles.accountSection}>
            <Text style={styles.fieldLabel}>From account</Text>
            <View style={styles.accountList}>
              {accounts.filter(a => !isAssetAccount(a.type) && !isInvestmentAccount(a.type) && !isPayToOnlyLiability(a.type)).map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accountRow, selectedAccount?.id === acc.id && styles.accountRowActive]}
                  onPress={() => setSelectedAccount(acc)}
                >
                  <Text style={[styles.accountRowText, selectedAccount?.id === acc.id && styles.accountRowTextActive]}>
                    🏦 {acc.label}
                  </Text>
                  {selectedAccount?.id === acc.id && <Text style={styles.accountRowCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>To account</Text>
            <View style={styles.accountList}>
              {accounts.filter(a => a.id !== selectedAccount?.id && !isAssetAccount(a.type)).map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accountRow, toAccount?.id === acc.id && styles.accountRowActive]}
                  onPress={() => setToAccount(acc)}
                >
                  <Text style={[styles.accountRowText, toAccount?.id === acc.id && styles.accountRowTextActive]}>
                    🏦 {acc.label}
                  </Text>
                  {toAccount?.id === acc.id && <Text style={styles.accountRowCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Log / History tab toggle — only when expense category is selected */}
        {selectedCategory && (type === 'expense') && (
          <View style={styles.tabToggle}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'log' && styles.tabBtnActive]}
              onPress={() => setActiveTab('log')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'log' && styles.tabBtnTextActive]}>Log expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
              onPress={() => setActiveTab('history')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
                {selectedCategory.icon} History
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* History view */}
        {activeTab === 'history' && selectedCategory ? (
          <View style={{ gap: 12 }}>
            {/* Pay cycle / Monthly toggle */}
            <View style={styles.historyViewToggle}>
              <TouchableOpacity
                style={[styles.historyViewBtn, historyView === 'cycle' && styles.historyViewBtnActive]}
                onPress={() => setHistoryView('cycle')}
              >
                <Text style={[styles.historyViewBtnText, historyView === 'cycle' && styles.historyViewBtnTextActive]}>
                  {budgetCycle === 'paycycle' ? 'Pay cycle' : 'This month'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.historyViewBtn, historyView === 'monthly' && styles.historyViewBtnActive]}
                onPress={() => setHistoryView('monthly')}
              >
                <Text style={[styles.historyViewBtnText, historyView === 'monthly' && styles.historyViewBtnTextActive]}>Full month</Text>
              </TouchableOpacity>
            </View>

            {/* Period summary */}
            <View style={styles.historySummary}>
              <View>
                <Text style={styles.historySummaryPeriod}>
                  {historyView === 'cycle' && budgetCycle === 'paycycle' ? payPeriodLabel : payPeriodLabel}
                  {' · '}{categoryHistory.length} transaction{categoryHistory.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.historySummarySpent}>
                  ${totalSpent.toLocaleString('en-CA', { maximumFractionDigits: 2 })} spent
                </Text>
                {budgetedAmount > 0 && (
                  <Text style={styles.historySummaryBudget}>
                    of ${budgetedAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })} budgeted
                  </Text>
                )}
              </View>
            </View>

            {budgetedAmount > 0 && (
              <View style={styles.historyProgressBar}>
                <View style={[styles.historyProgressFill, {
                  width: `${spentPercent}%` as any,
                  backgroundColor: totalSpent > budgetedAmount ? Colors.danger : spentPercent >= 80 ? Colors.warning : Colors.primary,
                }]} />
              </View>
            )}

            {historyLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
            ) : categoryHistory.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyText}>No transactions this period</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {categoryHistory.map(txn => (
                  <TouchableOpacity
                    key={txn.id}
                    style={styles.historyRow}
                    onPress={() => setEditingTransaction(txn)}
                  >
                    <View style={styles.historyRowLeft}>
                      <Text style={styles.historyRowIcon}>{selectedCategory.icon}</Text>
                      <View>
                        <Text style={styles.historyRowLabel}>{txn.label}</Text>
                        <Text style={styles.historyRowDate}>
                          {new Date(txn.date + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyRowRight}>
                      <Text style={styles.historyRowAmount}>
                        -${txn.amount.toLocaleString('en-CA', { maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.historyRowEdit}>Edit</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.fieldLabel}>Amount</Text>
            <CurrencyInput style={styles.amountInput} placeholder="$0.00" value={amount} onChangeText={setAmount} />

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
                onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value + 'T12:00:00')) }}
                style={{
                  backgroundColor: Colors.card,
                  border: `2px solid ${Colors.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontSize: 16,
                  color: Colors.text,
                  width: '100%',
                  boxSizing: 'border-box' as any,
                  cursor: 'pointer',
                }}
              />
            ) : (
              <>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateButtonText}>📅  {formatDateDisplay(date)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden', marginTop: 8 }}>
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="spinner"
                      themeVariant="light"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) setDate(selectedDate)
                        if (Platform.OS === 'android') setShowDatePicker(false)
                      }}
                      maximumDate={new Date()}
                    />
                    <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.datePickerDoneBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {(type === 'expense' || type === 'unexpected') && (
              <>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => setCategoriesExpanded(!categoriesExpanded)}>
                  <Text style={styles.fieldLabel}>
                    {type === 'unexpected' ? 'Unexpected expense for' : 'Category'}
                    {selectedCategory ? ` — ${selectedCategory.icon} ${selectedCategory.label}` : ''}
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
                {categoriesExpanded && (
                  <View style={styles.categoryList}>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryRow, selectedCategory?.id === cat.id && styles.categoryRowActive]}
                        onPress={() => handleCategorySelect(cat)}
                      >
                        <View style={styles.categoryRowLeft}>
                          <Text style={styles.categoryRowIcon}>{cat.icon}</Text>
                          <Text style={[styles.categoryRowText, selectedCategory?.id === cat.id && styles.categoryRowTextActive]}>{cat.label}</Text>
                        </View>
                        {categoryDefaults[cat.id] && <Text style={styles.defaultBadge}>default ✓</Text>}
                        {selectedCategory?.id === cat.id && <Text style={styles.categoryRowCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {selectedCategory && (
              <View style={styles.accountSection}>
                <Text style={styles.fieldLabel}>Account for {selectedCategory.icon} {selectedCategory.label}</Text>
                <View style={styles.accountList}>
                  {accounts.filter(a => isPayableFromAccount(a.type)).map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.accountRow, selectedAccount?.id === acc.id && styles.accountRowActive]}
                      onPress={() => setSelectedAccount(acc)}
                    >
                      <Text style={[styles.accountRowText, selectedAccount?.id === acc.id && styles.accountRowTextActive]}>🏦 {acc.label}</Text>
                      {selectedAccount?.id === acc.id && <Text style={styles.accountRowCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
                {selectedAccount && (
                  <TouchableOpacity style={styles.defaultToggle} onPress={() => setSetAsDefault(!setAsDefault)}>
                    <View style={[styles.checkbox, setAsDefault && styles.checkboxActive]}>
                      {setAsDefault && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                    <Text style={styles.defaultToggleText}>Always use {selectedAccount.label} for {selectedCategory.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {type === 'income' && (
              <View style={styles.accountSection}>
                <Text style={styles.fieldLabel}>Deposit to account</Text>
                <View style={styles.accountList}>
                  {accounts
                    .filter(a => !isAssetAccount(a.type) && isPrimaryPayable(a.type))
                    .filter((a, index, self) => self.findIndex(b => b.id === a.id) === index)
                    .map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.accountRow, selectedAccount?.id === acc.id && styles.accountRowActive]}
                      onPress={() => setSelectedAccount(acc)}
                    >
                      <Text style={[styles.accountRowText, selectedAccount?.id === acc.id && styles.accountRowTextActive]}>🏦 {acc.label}</Text>
                      {selectedAccount?.id === acc.id && <Text style={styles.accountRowCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
                {accounts.filter(a => !isAssetAccount(a.type) && !isPrimaryPayable(a.type)).length > 0 && (
                  <TouchableOpacity
                    style={styles.moreAccountsBtn}
                    onPress={() => setShowMoreIncomeAccounts(!showMoreIncomeAccounts)}
                  >
                    <Text style={styles.moreAccountsBtnText}>
                      {showMoreIncomeAccounts ? '▲ Hide' : '▼ More accounts'}
                    </Text>
                  </TouchableOpacity>
                )}
                {showMoreIncomeAccounts && (
                  <View style={styles.accountList}>
                    {accounts
                      .filter(a => !isAssetAccount(a.type) && !isPrimaryPayable(a.type))
                      .filter((a, index, self) => self.findIndex(b => b.id === a.id) === index)
                      .map(acc => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[styles.accountRow, selectedAccount?.id === acc.id && styles.accountRowActive]}
                        onPress={() => setSelectedAccount(acc)}
                      >
                        <Text style={[styles.accountRowText, selectedAccount?.id === acc.id && styles.accountRowTextActive]}>🏦 {acc.label}</Text>
                        {selectedAccount?.id === acc.id && <Text style={styles.accountRowCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}

        <View style={{ height: 80 }} />
      </KeyboardScrollView>

      {activeTab === 'log' && (
        <View style={styles.floatingButton}>
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.primaryButtonText}>Save transaction</Text>}
          </TouchableOpacity>
        </View>
      )}

      {!!editingTransaction && (
        <TransactionEditSheet
          visible={!!editingTransaction}
          transaction={editingTransaction}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onSaved={() => {
            setEditingTransaction(null)
            if (selectedCategory) loadHistory(selectedCategory.id, historyView)
          }}
          onDeleted={() => {
            setEditingTransaction(null)
            if (selectedCategory) loadHistory(selectedCategory.id, historyView)
          }}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f2f4f2' },
  content: { paddingHorizontal: 24, paddingVertical: 60, maxWidth: 500, alignSelf: 'center', width: '100%', gap: 12 },
  backButton: { marginBottom: 8 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  typeToggle: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 4, gap: 4, borderWidth: 1, borderColor: '#e3e8e3' },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeBtnActive: { backgroundColor: Colors.primary },
  typeBtnUnexpectedActive: { backgroundColor: Colors.warning },
  typeBtnTransferActive: { backgroundColor: Colors.info },
  typeBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  typeBtnTextActive: { color: Colors.text },
  tabToggle: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 4, gap: 4, borderWidth: 1, borderColor: '#e3e8e3' },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  tabBtnTextActive: { color: Colors.text, fontWeight: '600' },
  historyViewToggle: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 10, padding: 3, gap: 3, borderWidth: 1, borderColor: '#e3e8e3' },
  historyViewBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  historyViewBtnActive: { backgroundColor: Colors.primary },
  historyViewBtnText: { fontSize: 13, color: Colors.textSecondary },
  historyViewBtnTextActive: { color: Colors.text, fontWeight: '600' },
  historySummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, padding: 14 },
  historySummaryPeriod: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },
  historySummarySpent: { fontSize: 15, fontWeight: '600', color: Colors.text },
  historySummaryBudget: { fontSize: 12, color: Colors.textSecondary },
  historyProgressBar: { height: 8, backgroundColor: '#e3e8e3', borderRadius: 4, overflow: 'hidden' },
  historyProgressFill: { height: '100%', borderRadius: 4 },
  historyEmpty: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, padding: 24, alignItems: 'center' },
  historyEmptyText: { fontSize: 14, color: Colors.textSecondary },
  historyList: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 16, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e3e8e3' },
  historyRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  historyRowIcon: { fontSize: 20 },
  historyRowLabel: { fontSize: 14, fontWeight: '500', color: Colors.text },
  historyRowDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  historyRowRight: { alignItems: 'flex-end', gap: 4 },
  historyRowAmount: { fontSize: 14, fontWeight: '600', color: Colors.danger },
  historyRowEdit: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  fieldLabel: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  amountInput: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', paddingVertical: 20 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.text },
  dateButton: { backgroundColor: '#edf7f1', borderWidth: 1.5, borderColor: '#b6dfc0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dateButtonText: { fontSize: 16, color: Colors.text },
  datePickerDoneBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  datePickerDoneBtnText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  sectionChevron: { fontSize: 12, color: Colors.textSecondary },
  categoryList: { gap: 8 },
  categoryRow: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  categoryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryRowIcon: { fontSize: 20 },
  categoryRowText: { fontSize: 15, color: Colors.text },
  categoryRowTextActive: { color: Colors.primary, fontWeight: '600' },
  categoryRowCheck: { color: Colors.primary, fontSize: 18, fontWeight: '600' },
  defaultBadge: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginRight: 8 },
  accountSection: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 16, padding: 16, gap: 12 },
  accountList: { gap: 8 },
  accountRow: { backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  accountRowText: { fontSize: 15, color: Colors.text },
  accountRowTextActive: { color: Colors.primary, fontWeight: '600' },
  accountRowCheck: { color: Colors.primary, fontSize: 18, fontWeight: '600' },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxCheck: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  defaultToggleText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  unexpectedInfo: { backgroundColor: Colors.warning + '22', borderWidth: 1, borderColor: Colors.warning, borderRadius: 12, padding: 12 },
  unexpectedInfoText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  primaryButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, width: '100%', maxWidth: 500 },
  disabled: { opacity: 0.4 },
  primaryButtonText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  floatingButton: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#f2f4f2', paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#e3e8e3', alignItems: 'center' },
  moreAccountsBtn: { alignItems: 'center', paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 16 },
  moreAccountsBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
})