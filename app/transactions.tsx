import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import TransactionEditSheet from '../components/TransactionEditSheet'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

type Transaction = {
  id: string
  label: string
  amount: number
  date: string
  type: string
  is_unexpected: boolean
  category_id: string | null
  account_id: string | null
  from_account_id: string | null
  to_account_id: string | null
  category: { label: string; icon: string } | null
  from_account: { label: string } | null
  to_account: { label: string } | null
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filtered, setFiltered] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'unexpected'>('all')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [allCategories, setAllCategories] = useState<{ id: string; label: string; icon: string }[]>([])
  const scrollRef = useRef<ScrollView>(null)

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      loadTransactions()
    }, [])
  )

  useEffect(() => {
    applyFilter()
  }, [transactions, search, filter, startDate, endDate])

  async function loadTransactions() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: householdIds } = await supabase.rpc('get_household_user_ids')
    const userIds: string[] = householdIds || [user.id]

    const [{ data }, { data: cats }] = await Promise.all([
      supabase
        .from('transactions')
        .select(`
          id,
          label,
          amount,
          date,
          type,
          is_unexpected,
          category_id,
          account_id
        `)
        .in('user_id', userIds)
        .order('date', { ascending: false })
        .limit(500),
      supabase.from('budget_categories').select('id, label, icon').in('user_id', userIds),
    ])

    if (data) {
      const txnsWithCategories = (data as any[]).map(t => ({
        ...t,
        category: cats?.find((c: any) => c.id === t.category_id) || null
      }))
      setTransactions(txnsWithCategories as any)
    }
    if (cats) setAllCategories(cats)
    setLoading(false)
  }

  function applyFilter() {
    let result = [...transactions]

    if (search) {
      result = result.filter(t =>
        t.label.toLowerCase().includes(search.toLowerCase()) ||
        t.category?.label.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (filter === 'expense') result = result.filter(t => t.type === 'expense' && !t.is_unexpected)
    if (filter === 'income') result = result.filter(t => t.type === 'income')
    if (filter === 'unexpected') result = result.filter(t => t.is_unexpected)

    if (startDate) {
      result = result.filter(t => new Date(t.date + 'T00:00:00') >= startDate)
    }
    if (endDate) {
      result = result.filter(t => new Date(t.date + 'T00:00:00') <= endDate)
    }

    setFiltered(result)
  }

  function groupByDate(transactions: Transaction[]) {
    const groups: { [key: string]: Transaction[] } = {}
    transactions.forEach(t => {
      if (!groups[t.date]) groups[t.date] = []
      groups[t.date].push(t)
    })
    return groups
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function getDailyTotal(transactions: Transaction[]) {
    return transactions.reduce((sum, t) => {
      return t.type === 'income' ? sum + t.amount : sum - t.amount
    }, 0)
  }

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const unexpectedTotal = transactions
    .filter(t => t.is_unexpected)
    .reduce((sum, t) => sum + t.amount, 0)

  const groups = groupByDate(filtered)

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <>
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.headerRow}>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/add-transaction')}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={[styles.summaryValue, { color: Colors.danger }]}>
            -${totalExpenses.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>
            +${totalIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Unexpected</Text>
          <Text style={[styles.summaryValue, { color: Colors.warning }]}>
            -${unexpectedTotal.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search transactions..."
        placeholderTextColor={Colors.textSecondary}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowStartPicker(!showStartPicker)}
        >
          <Text style={styles.dateBtnText}>
            {startDate ? startDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '📅 From'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.dateSeparator}>→</Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowEndPicker(!showEndPicker)}
        >
          <Text style={styles.dateBtnText}>
            {endDate ? endDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '📅 To'}
          </Text>
        </TouchableOpacity>
        {(startDate || endDate) && (
          <TouchableOpacity
            style={styles.dateClearBtn}
            onPress={() => { setStartDate(null); setEndDate(null) }}
          >
            <Text style={styles.dateClearBtnText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {showStartPicker && (
        Platform.OS === 'web' ? (
          <input
            type="date"
            value={startDate ? startDate.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              if (e.target.value) setStartDate(new Date(e.target.value + 'T12:00:00'))
              setShowStartPicker(false)
            }}
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #e3e8e3',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 16,
              color: '#1a1a1a',
              width: '100%',
              boxSizing: 'border-box' as any,
              cursor: 'pointer',
            }}
          />
        ) : (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden' }}>
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display="spinner"
              themeVariant="light"
              onChange={(event, date) => {
                if (date) setStartDate(date)
              }}
            />
            <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowStartPicker(false)}>
              <Text style={styles.datePickerDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {showEndPicker && (
        Platform.OS === 'web' ? (
          <input
            type="date"
            value={endDate ? endDate.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              if (e.target.value) setEndDate(new Date(e.target.value + 'T12:00:00'))
              setShowEndPicker(false)
            }}
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #e3e8e3',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 16,
              color: '#1a1a1a',
              width: '100%',
              boxSizing: 'border-box' as any,
              cursor: 'pointer',
            }}
          />
        ) : (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden' }}>
            <DateTimePicker
              value={endDate || new Date()}
              mode="date"
              display="spinner"
              themeVariant="light"
              onChange={(event, date) => {
                if (date) setEndDate(date)
              }}
            />
            <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowEndPicker(false)}>
              <Text style={styles.datePickerDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      <View style={styles.filterRow}>
        {(['all', 'expense', 'income', 'unexpected'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {Object.keys(groups).length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySubtitle}>Tap + Add to log your first transaction</Text>
        </View>
      )}

      {Object.entries(groups).map(([date, dayTransactions]) => (
        <View key={date}>
          <View style={styles.dateHeader}>
            <Text style={styles.dateLabel}>{formatDate(date)}</Text>
            <Text style={[
              styles.dateDailyTotal,
              { color: getDailyTotal(dayTransactions) >= 0 ? Colors.success : Colors.danger }
            ]}>
              {getDailyTotal(dayTransactions) >= 0 ? '+' : ''}
              ${getDailyTotal(dayTransactions).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
            </Text>
          </View>

          <View style={styles.transactionGroup}>
            {dayTransactions.map(transaction => (
              <TouchableOpacity key={transaction.id} style={styles.transactionRow} onPress={() => setSelectedTransaction(transaction)}>
                <View style={styles.transactionIcon}>
                  <Text style={styles.transactionIconText}>
                    {transaction.type === 'transfer' ? '⇄' : transaction.is_unexpected ? '⚠️' : transaction.category?.icon || '💳'}
                  </Text>
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionLabel}>{transaction.label}</Text>
                  <Text style={styles.transactionCategory}>
                    {transaction.type === 'transfer'
                      ? 'Transfer'
                      : transaction.is_unexpected
                        ? 'Unexpected expense'
                        : transaction.category?.label || 'Uncategorized'}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: transaction.type === 'income' ? Colors.success : Colors.danger }
                ]}>
                  {transaction.type === 'income' ? '+' : '-'}
                  ${transaction.amount.toLocaleString('en-CA', { maximumFractionDigits: 2 })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
    {!!selectedTransaction && (
      <TransactionEditSheet
        visible={!!selectedTransaction}
        transaction={selectedTransaction}
        categories={allCategories}
        onClose={() => setSelectedTransaction(null)}
        onSaved={() => { setSelectedTransaction(null); loadTransactions() }}
        onDeleted={() => { setSelectedTransaction(null); loadTransactions() }}
      />
    )}
    </>
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
  backButton: {
    marginBottom: 8,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dateDailyTotal: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionGroup: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 16,
    overflow: 'hidden',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2f4f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconText: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  transactionCategory: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateBtnText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  dateSeparator: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  dateClearBtn: {
    backgroundColor: Colors.danger + '22',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateClearBtnText: {
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '500',
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
})