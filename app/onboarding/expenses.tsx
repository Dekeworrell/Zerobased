import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setExpenses as saveExpensesToStore } from '../../lib/store'

const EXPENSE_CATEGORIES = [
  { id: 'groceries', label: 'Groceries', icon: '🛒', type: 'variable' },
  { id: 'transport', label: 'Transport', icon: '🚗', type: 'variable' },
  { id: 'utilities', label: 'Utilities', icon: '💡', type: 'fixed' },
  { id: 'internet', label: 'Internet', icon: '📶', type: 'fixed' },
  { id: 'phone', label: 'Phone', icon: '📱', type: 'fixed' },
  { id: 'home_insurance', label: 'Home insurance', icon: '🏡', type: 'fixed' },
  { id: 'fuel', label: 'Fuel', icon: '⛽', type: 'variable' },
  { id: 'auto_insurance', label: 'Auto insurance', icon: '🚘', type: 'fixed' },
  { id: 'vehicle_maintenance', label: 'Vehicle maintenance', icon: '🔧', type: 'variable' },
  { id: 'property_tax', label: 'Property tax', icon: '🏛️', type: 'fixed' },
  { id: 'water_sewer', label: 'Water & sewer', icon: '💧', type: 'fixed' },
  { id: 'car_loan', label: 'Car loan', icon: '🔑', type: 'fixed' },
  { id: 'loc', label: 'Line of credit', icon: '💸', type: 'fixed' },
  { id: 'studentloan', label: 'Student loan', icon: '🎓', type: 'fixed' },
  { id: 'student_loan', label: 'Student loan', icon: '🎓', type: 'fixed' },
  { id: 'loan_repayment', label: 'Loan repayment', icon: '💳', type: 'fixed', permanent: true },
  { id: 'mortgage', label: 'Mortgage/Rent', icon: '🏠', type: 'fixed' },
  { id: 'dining', label: 'Dining out', icon: '🍽️', type: 'variable' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺', type: 'fixed' },
  { id: 'health', label: 'Health', icon: '💊', type: 'variable' },
  { id: 'fitness', label: 'Fitness', icon: '💪', type: 'fixed' },
  { id: 'clothing', label: 'Clothing', icon: '👕', type: 'variable' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', type: 'variable', permanent: true },
  { id: 'savings', label: 'Savings', icon: '💰', type: 'priority' },
  { id: 'investments', label: 'Investments', icon: '📈', type: 'priority' },
  { id: 'education', label: 'Education', icon: '📚', type: 'variable' },
  { id: 'childcare', label: 'Childcare', icon: '👶', type: 'fixed' },
  { id: 'cable_tv', label: 'Cable TV', icon: '📡', type: 'fixed' },
  { id: 'life_insurance', label: 'Life insurance', icon: '🛡️', type: 'fixed' },
  { id: 'rrsp', label: 'RRSP', icon: '📈', type: 'priority' },
  { id: 'tfsa', label: 'TFSA', icon: '🌱', type: 'fixed' },
  { id: 'fhsa', label: 'FHSA', icon: '🏠', type: 'priority' },
  { id: 'mortgage_extra', label: 'Mortgage overpayment', icon: '🏦', type: 'priority' },
  { id: 'emergency_fund', label: 'Emergency fund', icon: '🆘', type: 'priority' },
  { id: 'pets', label: 'Pets', icon: '🐾', type: 'variable' },
  { id: 'sports', label: 'Sports', icon: '⚽', type: 'variable' },
  { id: 'other', label: 'Other', icon: '➕', type: 'variable', permanent: true },
]

type LocalExpense = {
  id: string
  label: string
  icon: string
  amount: string
  frequency: 'monthly' | 'biweekly'
  category_type: 'priority' | 'fixed' | 'variable'
  permanent?: boolean
}

export default function ExpensesScreen() {
  const [masterFrequency, setMasterFrequency] = useState<'monthly' | 'biweekly'>('monthly')
  const [expenses, setExpenses] = useState<LocalExpense[]>(() => {
    const saved = getOnboardingData().expenses
    return saved.length > 0 ? saved as LocalExpense[] : [
      { id: 'mortgage', label: 'Mortgage/Rent', icon: '🏠', amount: '', frequency: 'monthly', category_type: 'fixed' },
      { id: 'utilities', label: 'Utilities', icon: '💡', amount: '', frequency: 'monthly', category_type: 'fixed' },
      { id: 'groceries', label: 'Groceries', icon: '🛒', amount: '', frequency: 'monthly', category_type: 'variable' },
      { id: 'internet', label: 'Internet', icon: '📶', amount: '', frequency: 'monthly', category_type: 'fixed' },
    ]
  })

  function addExpense(category: typeof EXPENSE_CATEGORIES[0]) {
    const newId = `${category.id}_${Date.now()}`
    setExpenses([...expenses, {
      id: newId,
      label: category.label,
      icon: category.icon,
      amount: '',
      frequency: 'monthly',
      category_type: category.type as 'priority' | 'fixed' | 'variable'
    }])
  }

  function removeExpense(id: string) {
    setExpenses(expenses.filter(e => e.id !== id))
  }

  function updateAmount(id: string, amount: string) {
    setExpenses(expenses.map(e => e.id === id ? { ...e, amount } : e))
  }

  function updateLabel(id: string, label: string) {
    setExpenses(expenses.map(e => e.id === id ? { ...e, label } : e))
  }

  function updateFrequency(id: string, frequency: 'monthly' | 'biweekly') {
    setExpenses(expenses.map(e => e.id === id ? { ...e, frequency } : e))
  }
  function applyMasterFrequency(frequency: 'monthly' | 'biweekly') {
    setMasterFrequency(frequency)
    setExpenses(expenses.map(e => ({ ...e, frequency })))
  }

  function handleContinue() {
    saveExpensesToStore(expenses)
    router.push('/onboarding/assign')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.step}>Step 4 of 5</Text>
      <Text style={styles.title}>What are your regular expenses?</Text>
      <Text style={styles.subtitle}>Start with your biggest bills — you can always add more later.</Text>
      <View style={styles.masterToggle}>
        <Text style={styles.masterToggleLabel}>Set all to:</Text>
        <TouchableOpacity
          style={[styles.masterBtn, masterFrequency === 'monthly' && styles.masterBtnActive]}
          onPress={() => applyMasterFrequency('monthly')}
        >
          <Text style={[styles.masterBtnText, masterFrequency === 'monthly' && styles.masterBtnTextActive]}>Monthly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.masterBtn, masterFrequency === 'biweekly' && styles.masterBtnActive]}
          onPress={() => applyMasterFrequency('biweekly')}
        >
          <Text style={[styles.masterBtnText, masterFrequency === 'biweekly' && styles.masterBtnTextActive]}>Bi-weekly</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.expenseList}>
        {expenses.map((expense) => (
          <View key={expense.id} style={styles.expenseRow}>
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseIcon}>{expense.icon}</Text>
              <TextInput
                style={styles.expenseLabel}
                value={expense.label}
                onChangeText={(val) => updateLabel(expense.id, val)}
                placeholderTextColor={Colors.textSecondary}
                selectTextOnFocus
              />
            </View>
            <View style={styles.expenseRight}>
              <View style={styles.freqToggle}>
                <TouchableOpacity
                  style={[styles.freqChip, expense.frequency === 'monthly' && styles.freqChipActive]}
                  onPress={() => updateFrequency(expense.id, 'monthly')}
                >
                  <Text style={[styles.freqChipText, expense.frequency === 'monthly' && styles.freqChipTextActive]}>
                    Mo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.freqChip, expense.frequency === 'biweekly' && styles.freqChipActive]}
                  onPress={() => updateFrequency(expense.id, 'biweekly')}
                >
                  <Text style={[styles.freqChipText, expense.frequency === 'biweekly' && styles.freqChipTextActive]}>
                    BiW
                  </Text>
                </TouchableOpacity>
              </View>
                <CurrencyInput
                  style={styles.amountInput}
                  placeholder="$0.00"
                  value={expense.amount}
                  onChangeText={(val) => updateAmount(expense.id, val)}
                  // @ts-ignore
                tabIndex={expenses.indexOf(expense) + 1}
                />

              <TouchableOpacity onPress={() => removeExpense(expense.id)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.addLabel}>Add a category</Text>
      <View style={styles.typeGrid}>
        {EXPENSE_CATEGORIES.sort((a, b) => a.label.localeCompare(b.label)).map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.typeChip}
            onPress={() => addExpense(category)}
          >
            <Text style={styles.typeChipIcon}>{category.icon}</Text>
            <Text style={styles.typeChipLabel}>{category.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
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
  expenseList: {
    gap: 10,
    marginBottom: 32,
  },
  expenseRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  expenseIcon: {
    fontSize: 20,
  },
  expenseLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  freqChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  freqChipText: {
    fontSize: 11,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: Colors.text,
    width: 90,
    textAlign: 'right',
  },
  removeBtn: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  addLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 40,
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
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  masterToggleLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  masterBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  masterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  masterBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  masterBtnTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  permanentIcon: {
    fontSize: 14,
    opacity: 0.4,
  },
})