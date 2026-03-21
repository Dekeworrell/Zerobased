import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import { Colors } from '../../constants/colors'
import { clearOnboardingData, getOnboardingData, toMonthly } from '../../lib/store'
import { supabase } from '../../lib/supabase'

export default function AssignScreen() {
  const data = getOnboardingData()
  const [expenses, setExpenses] = useState(data.expenses)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totalMonthlyIncome = data.incomeSources.reduce(
    (sum, s) => sum + toMonthly(s.amount, s.frequency), 0
  )
  const totalMonthlyExpenses = expenses.reduce(
    (sum, e) => sum + toMonthly(e.amount, e.frequency), 0
  )
  const remaining = totalMonthlyIncome - totalMonthlyExpenses
  const isZero = Math.abs(remaining) < 0.01
  const isOver = remaining < 0

  function getStatusColor() {
    if (isOver) return Colors.danger
    if (isZero) return Colors.success
    return '#4FC3F7'
  }

  function getStatusMessage() {
    if (isOver) return `$${Math.abs(remaining).toFixed(2)} over budget — reduce some expenses`
    if (isZero) return 'Every dollar is assigned!'
    return `$${remaining.toFixed(2)} left to assign`
  }

  function updateAmount(id: string, amount: string) {
    setExpenses(expenses.map(e => e.id === id ? { ...e, amount } : e))
  }

  function updateFrequency(id: string, frequency: 'monthly' | 'biweekly') {
    setExpenses(expenses.map(e => e.id === id ? { ...e, frequency } : e))
  }

  async function handleFinish() {
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Accounts to save:', JSON.stringify(getOnboardingData().accounts))
      if (!user) throw new Error('Not logged in')

      const onboarding = getOnboardingData()

      await supabase.from('profiles').upsert({
        id: user.id,
        tracking_method: onboarding.trackingMethod,
      })

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.step}>Step 5 of 5</Text>
      <Text style={styles.title}>Assign every dollar</Text>
      <Text style={styles.subtitle}>Zero-based budgeting means every dollar has a job</Text>

      <View style={[styles.statusCard, { borderColor: getStatusColor() }]}>
        <Text style={styles.statusLabel}>Remaining to assign</Text>
        <Text style={[styles.statusAmount, { color: getStatusColor() }]}>
          ${Math.abs(remaining).toFixed(2)}
        </Text>
        <Text style={[styles.statusMessage, { color: getStatusColor() }]}>
          {getStatusMessage()}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Monthly income</Text>
          <Text style={styles.summaryValue}>${totalMonthlyIncome.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />

        {expenses.map((expense) => (
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
                placeholder="$0.00"
                value={expense.amount}
                onChangeText={(val) => updateAmount(expense.id, val)}
              />
              <Text style={styles.expenseMonthly}>
                ${toMonthly(expense.amount, expense.frequency).toFixed(0)}/mo
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total expenses</Text>
          <Text style={[styles.summaryValue, { color: Colors.danger }]}>
            -${totalMonthlyExpenses.toFixed(2)}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 All amounts are converted to monthly. Bi-weekly amounts use 26 pay periods per year.
        </Text>
      </View>

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
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  step: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  statusCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: Colors.card,
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  statusAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusMessage: {
    fontSize: 15,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
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
    gap: 10,
    flex: 1,
  },
  expenseIcon: {
    fontSize: 16,
  },
  expenseLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freqToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  freqChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
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
    fontSize: 14,
    color: Colors.text,
    width: 70,
    textAlign: 'right',
  },
  expenseMonthly: {
    fontSize: 12,
    color: Colors.textSecondary,
    minWidth: 55,
    textAlign: 'right',
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
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
})