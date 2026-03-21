import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'

const EXPENSE_CATEGORIES = [
  { id: 'groceries', label: 'Groceries', icon: '🛒' },
  { id: 'transport', label: 'Transport', icon: '🚗' },
  { id: 'utilities', label: 'Utilities', icon: '💡' },
  { id: 'internet', label: 'Internet', icon: '📶' },
  { id: 'phone', label: 'Phone', icon: '📱' },
  { id: 'home_insurance', label: 'Home insurance', icon: '🏡' },
  { id: 'fuel', label: 'Fuel', icon: '⛽' },
  { id: 'auto_insurance', label: 'Auto insurance', icon: '🚘' },
  { id: 'vehicle_maintenance', label: 'Vehicle maintenance', icon: '🔧' },
  { id: 'property_tax', label: 'Property tax', icon: '🏛️' },
  { id: 'water_sewer', label: 'Water & sewer', icon: '💧' },
  { id: 'car_loan', label: 'Car loan', icon: '🔑' },
  { id: 'mortgage', label: 'Mortgage', icon: '🏦' },
  { id: 'dining', label: 'Dining out', icon: '🍽️' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺' },
  { id: 'health', label: 'Health', icon: '💊' },
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'clothing', label: 'Clothing', icon: '👕' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'savings', label: 'Savings', icon: '💰' },
  { id: 'investments', label: 'Investments', icon: '📈' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'childcare', label: 'Childcare', icon: '👶' },
  { id: 'pets', label: 'Pets', icon: '🐾' },
  { id: 'other', label: 'Other', icon: '➕' },
]

type Expense = {
  id: string
  label: string
  icon: string
  amount: string
  frequency: 'monthly' | 'biweekly'
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: 'mortgage', label: 'Mortgage', icon: '🏦', amount: '', frequency: 'monthly' },
    { id: 'groceries', label: 'Groceries', icon: '🛒', amount: '', frequency: 'monthly' },
    { id: 'fuel', label: 'Fuel', icon: '⛽', amount: '', frequency: 'biweekly' },
  ])

  function addExpense(category: typeof EXPENSE_CATEGORIES[0]) {
    if (expenses.find(e => e.id === category.id)) return
    setExpenses([...expenses, { id: category.id, label: category.label, icon: category.icon, amount: '', frequency: 'monthly' }])
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

  function handleContinue() {
    router.push('/onboarding/assign')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.step}>Step 4 of 5</Text>
      <Text style={styles.title}>Your expenses</Text>
      <Text style={styles.subtitle}>Add your monthly bills and spending categories</Text>

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
              <TextInput
                style={styles.amountInput}
                placeholder="$0.00"
                placeholderTextColor={Colors.textSecondary}
                value={expense.amount}
                onChangeText={(val) => updateAmount(expense.id, val)}
                keyboardType="decimal-pad"
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
        {EXPENSE_CATEGORIES.filter(c => !expenses.find(e => e.id === c.id)).map((category) => (
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
})