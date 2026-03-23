import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import { Colors } from '../../constants/colors'
import { clearOnboardingData, getOnboardingData, toMonthly } from '../../lib/store'
import { supabase } from '../../lib/supabase'

const PRIORITY_ITEMS = [
  { id: 'rrsp', label: 'RRSP', icon: '📈' },
  { id: 'tfsa', label: 'TFSA', icon: '🛡️' },
  { id: 'fhsa', label: 'FHSA', icon: '🏠' },
  { id: 'emergency_fund', label: 'Emergency fund', icon: '🆘' },
  { id: 'mortgage_extra', label: 'Mortgage overpayment', icon: '🏦' },
  { id: 'investments', label: 'Investments', icon: '💰' },
]

const EXPENSE_CATEGORIES = [
  { id: 'groceries', label: 'Groceries', icon: '🛒', category_type: 'variable' },
  { id: 'transport', label: 'Transport', icon: '🚗', category_type: 'variable' },
  { id: 'utilities', label: 'Utilities', icon: '💡', category_type: 'fixed' },
  { id: 'internet', label: 'Internet', icon: '📶', category_type: 'fixed' },
  { id: 'phone', label: 'Phone', icon: '📱', category_type: 'fixed' },
  { id: 'home_insurance', label: 'Home insurance', icon: '🏡', category_type: 'fixed' },
  { id: 'fuel', label: 'Fuel', icon: '⛽', category_type: 'variable' },
  { id: 'auto_insurance', label: 'Auto insurance', icon: '🚘', category_type: 'fixed' },
  { id: 'vehicle_maintenance', label: 'Vehicle maintenance', icon: '🔧', category_type: 'variable' },
  { id: 'property_tax', label: 'Property tax', icon: '🏛️', category_type: 'fixed' },
  { id: 'water_sewer', label: 'Water & sewer', icon: '💧', category_type: 'fixed' },
  { id: 'car_loan', label: 'Car loan', icon: '🔑', category_type: 'fixed' },
  { id: 'mortgage', label: 'Mortgage/Rent', icon: '🏠', category_type: 'fixed' },
  { id: 'dining', label: 'Dining out', icon: '🍽️', category_type: 'variable' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺', category_type: 'fixed' },
  { id: 'health', label: 'Health', icon: '💊', category_type: 'variable' },
  { id: 'fitness', label: 'Fitness', icon: '💪', category_type: 'fixed' },
  { id: 'clothing', label: 'Clothing', icon: '👕', category_type: 'variable' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', category_type: 'variable' },
  { id: 'savings', label: 'Savings', icon: '💰', category_type: 'priority' },
  { id: 'education', label: 'Education', icon: '📚', category_type: 'variable' },
  { id: 'childcare', label: 'Childcare', icon: '👶', category_type: 'fixed' },
  { id: 'cable_tv', label: 'Cable TV', icon: '📡', category_type: 'fixed' },
  { id: 'life_insurance', label: 'Life insurance', icon: '🛡️', category_type: 'fixed' },
  { id: 'other', label: 'Other', icon: '➕', category_type: 'variable' },
]

type Expense = {
  id: string
  label: string
  icon: string
  amount: string
  frequency: 'monthly' | 'biweekly'
  category_type: 'priority' | 'fixed' | 'variable'
}

export default function AssignScreen() {
  const data = getOnboardingData()
  const [expenses, setExpenses] = useState<Expense[]>(
    (data.expenses as Expense[]).map(e => ({
      ...e,
      category_type: e.category_type || 'variable'
    }))
  )
  const [saving, setSaving] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState<'fixed' | 'variable' | 'priority' | null>(null)
  const [error, setError] = useState('')

  const totalMonthlyIncome = data.incomeSources.reduce(
    (sum, s) => sum + toMonthly(s.amount, s.frequency), 0
  )
  const totalMonthlyExpenses = expenses.reduce(
    (sum, e) => sum + toMonthly(e.amount, e.frequency), 0
  )
  const remaining = totalMonthlyIncome - totalMonthlyExpenses
  const isZero = Math.abs(remaining) < 0.5
  const isOver = remaining < -0.5

  const priorityExpenses = expenses.filter(e => e.category_type === 'priority')
  const fixedExpenses = expenses.filter(e => e.category_type === 'fixed')
  const variableExpenses = expenses.filter(e => e.category_type === 'variable')

  function getStatusColor() {
    if (isOver) return Colors.danger
    if (isZero) return Colors.success
    return '#4FC3F7'
  }

  function updateAmount(id: string, amount: string) {
    setExpenses(expenses.map(e => e.id === id ? { ...e, amount } : e))
  }

  function updateFrequency(id: string, frequency: 'monthly' | 'biweekly') {
    setExpenses(expenses.map(e => e.id === id ? { ...e, frequency } : e))
  }

  function moveTo(id: string, category_type: 'priority' | 'fixed' | 'variable') {
    setExpenses(expenses.map(e => e.id === id ? { ...e, category_type } : e))
  }

  async function handleFinish() {
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const onboarding = getOnboardingData()

      await supabase.from('profiles').upsert({
        id: user.id,
        tracking_method: onboarding.trackingMethod,
      })

      await supabase.from('budget_categories').delete().eq('user_id', user.id)
      await supabase.from('income_sources').delete().eq('user_id', user.id)
      await supabase.from('accounts').delete().eq('user_id', user.id)

      if (onboarding.accounts.length > 0) {
        await supabase.from('accounts').insert(
          onboarding.accounts.map(a => ({
            user_id: user.id,
            label: a.label,
            type: a.type,
            balance: parseFloat(a.balance) || 0,
          }))
        )
      }

      if (onboarding.incomeSources.length > 0) {
        await supabase.from('income_sources').insert(
          onboarding.incomeSources.map(s => ({
            user_id: user.id,
            label: s.label,
            amount: parseFloat(s.amount) || 0,
            frequency: s.frequency,
            type: s.type,
          }))
        )
      }

      if (expenses.length > 0) {
        await supabase.from('budget_categories').insert(
          expenses.map(e => ({
            user_id: user.id,
            label: e.label,
            icon: e.icon,
            budgeted_amount: parseFloat(e.amount) || 0,
            frequency: e.frequency,
            category_type: e.category_type || 'variable',
          }))
        )
      }

      clearOnboardingData()
      router.replace('/dashboard')

    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    }

    setSaving(false)
  }

  function renderExpenseRow(expense: Expense) {
    return (
      <View key={expense.id} style={styles.expenseRow}>
        <View style={styles.expenseLeft}>
          <Text style={styles.expenseIcon}>{expense.icon}</Text>
          <Text style={styles.expenseLabel}>{expense.label}</Text>
        </View>
        <View style={styles.expenseRight}>
          <View style={styles.freqToggle}>
            <TouchableOpacity
              style={[styles.freqChip, expense.frequency === 'monthly' && styles.freqChipActive]}
              onPress={() => updateFrequency(expense.id, 'monthly')}
            >
              <Text style={[styles.freqChipText, expense.frequency === 'monthly' && styles.freqChipTextActive]}>Mo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.freqChip, expense.frequency === 'biweekly' && styles.freqChipActive]}
              onPress={() => updateFrequency(expense.id, 'biweekly')}
            >
              <Text style={[styles.freqChipText, expense.frequency === 'biweekly' && styles.freqChipTextActive]}>BiW</Text>
            </TouchableOpacity>
          </View>
          <CurrencyInput
            style={styles.amountInput}
            placeholder="$0"
            value={expense.amount}
            onChangeText={(val) => updateAmount(expense.id, val)}
          />
          <Text style={styles.expenseMonthly}>
            ${toMonthly(expense.amount, expense.frequency).toFixed(0)}/mo
          </Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.step}>Step 5 of 5</Text>
      <Text style={styles.title}>Assign every dollar</Text>
      <Text style={styles.subtitle}>Every dollar needs a job — start with fixed bills, then variable spending, then invest the rest</Text>

      <View style={[styles.statusCard, {
        borderColor: getStatusColor(),
        backgroundColor: isZero ? Colors.success + '22' : isOver ? Colors.danger + '22' : Colors.card,
      }]}>
        <Text style={styles.statusLabel}>Remaining to assign</Text>
        <Text style={[styles.statusAmount, { color: getStatusColor() }]}>
          {isZero ? '🎉 $0' : '$' + Math.abs(remaining).toFixed(0) + '/mo'}
        </Text>
        <Text style={[styles.statusBiweekly, { color: getStatusColor() }]}>
          {isZero ? 'Every dollar assigned!' : isOver ? 'Over budget by $' + Math.abs(remaining / 2).toFixed(0) + ' per paycheque' : '$' + Math.abs(remaining / 2).toFixed(0) + ' per paycheque'}
        </Text>
        <Text style={styles.statusIncome}>
          Income: ${totalMonthlyIncome.toFixed(0)}/mo · ${(totalMonthlyIncome / 2).toFixed(0)} per paycheque
        </Text>
      </View>

      {fixedExpenses.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔒 Fixed expenses</Text>
            <Text style={styles.sectionTotal}>
              -${fixedExpenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0).toFixed(0)}/mo
            </Text>
          </View>
          {fixedExpenses.map(e => renderExpenseRow(e))}
          <TouchableOpacity
            style={styles.addCategoryBtn}
            onPress={() => setShowAddCategory(showAddCategory === 'fixed' ? null : 'fixed')}
          >
            <Text style={styles.addCategoryBtnText}>+ Add fixed expense</Text>
          </TouchableOpacity>
          {showAddCategory === 'fixed' && (
            <View style={styles.addCategoryChips}>
              {EXPENSE_CATEGORIES.filter(c => c.category_type === 'fixed' && !expenses.find(e => e.id === c.id)).map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.addChip}
                  onPress={() => {
                    setExpenses([...expenses, {
                      id: cat.id,
                      label: cat.label,
                      icon: cat.icon,
                      amount: '',
                      frequency: 'monthly',
                      category_type: 'fixed',
                    }])
                    setShowAddCategory(null)
                  }}
                >
                  <Text style={styles.addChipIcon}>{cat.icon}</Text>
                  <Text style={styles.addChipText}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {variableExpenses.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💳 Variable expenses</Text>
            <Text style={styles.sectionTotal}>
              -${variableExpenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0).toFixed(0)}/mo
            </Text>
          </View>
          {variableExpenses.map(e => renderExpenseRow(e))}
        </View>
      )}

      {priorityExpenses.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⭐ Priority — pay yourself first</Text>
            <Text style={styles.sectionTotal}>
              -${priorityExpenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0).toFixed(0)}/mo
            </Text>
          </View>
          {priorityExpenses.map(e => renderExpenseRow(e))}
        </View>
      )}

      {remaining > 0 && (
        <View style={styles.remainingBox}>
          <Text style={styles.remainingTitle}>💡 You have ${remaining.toFixed(0)}/mo unassigned</Text>
          <Text style={styles.remainingSubtitle}>
            Add priority items below to put this money to work
          </Text>
          <View style={styles.priorityChips}>
            {PRIORITY_ITEMS.filter(p => !expenses.find(e => e.id === p.id)).map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.priorityChip}
                onPress={() => setExpenses([...expenses, {
                  id: item.id,
                  label: item.label,
                  icon: item.icon,
                  amount: '',
                  frequency: 'monthly',
                  category_type: 'priority',
                }])}
              >
                <Text style={styles.priorityChipIcon}>{item.icon}</Text>
                <Text style={styles.priorityChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, (isOver || saving) && styles.disabled]}
        onPress={handleFinish}
        disabled={isOver || saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.primaryButtonText}>
              {isZero ? '🎉 Start budgeting!' : 'Continue to dashboard'}
            </Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 60,
    maxWidth: 500,
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
  step: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  statusCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  statusLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  statusAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBiweekly: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  statusIncome: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionTotal: {
    fontSize: 14,
    color: Colors.danger,
    fontWeight: '500',
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  expenseIcon: {
    fontSize: 16,
  },
  expenseLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  freqToggle: {
    flexDirection: 'row',
    gap: 3,
  },
  freqChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  freqChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  freqChipText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  freqChipTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  amountInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: Colors.text,
    width: 80,
    textAlign: 'right',
  },
  expenseMonthly: {
    fontSize: 11,
    color: Colors.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
  remainingBox: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: '#4FC3F7',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  remainingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  remainingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
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
  },
  disabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  priorityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  priorityChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: '#4FC3F7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityChipIcon: {
    fontSize: 14,
  },
  priorityChipText: {
    fontSize: 13,
    color: '#4FC3F7',
    fontWeight: '500',
  },
})