import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import KeyboardScrollView from '../../components/KeyboardScrollView'
import { Category, getExpenseCategories } from '../../constants/categories'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setExpenses as saveExpensesToStore } from '../../lib/store'

type LocalExpense = {
  id: string
  label: string
  icon: string
  amount: string
  frequency: 'monthly' | 'biweekly'
  category_type: 'priority' | 'fixed' | 'variable'
  permanent?: boolean
}

const FREE_TIER_LIMIT = 4
const FREE_TIER_NUDGE_AT = 3

export default function ExpensesScreen() {
  const [masterFrequency, setMasterFrequency] = useState<'monthly' | 'biweekly'>('monthly')
  const [expenses, setExpenses] = useState<LocalExpense[]>(() => {
    const saved = getOnboardingData().expenses
    return saved.length > 0 ? saved as LocalExpense[] : [
      { id: 'mortgage', label: 'Mortgage/Rent', icon: '🏠', amount: '', frequency: 'monthly', category_type: 'fixed' },
    ]
  })

  const atNudge = expenses.length === FREE_TIER_NUDGE_AT
  const atLimit = expenses.length >= FREE_TIER_LIMIT

  function addExpense(category: Category) {
    if (atLimit) return
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
    router.replace('/onboarding/assign')
  }

  return (
    <>
      <KeyboardScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.replace('/onboarding/income')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>
        <Text style={styles.progressLabel}>Step 2 of 3</Text>
      </View>
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
            <View style={styles.expenseTopRow}>
              <Text style={styles.expenseIcon}>{expense.icon}</Text>
              <TextInput
                style={styles.expenseLabel}
                value={expense.label}
                onChangeText={(val) => updateLabel(expense.id, val)}
                placeholderTextColor={Colors.textSecondary}
              />
              <TouchableOpacity onPress={() => removeExpense(expense.id)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.expenseBottomRow}>
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
              />
            </View>
          </View>
        ))}
      </View>

      {atNudge && (
        <View style={styles.nudgeBanner}>
          <Text style={styles.nudgeText}>
            1 category left on your free plan — upgrade for unlimited
          </Text>
        </View>
      )}

      {atLimit ? (
        <View style={styles.limitCard}>
          <Text style={styles.limitTitle}>You've reached the free plan limit.</Text>
          <Text style={styles.limitBody}>
            Free accounts can have up to 8 budget categories. You can add more after upgrading, or continue with these 8 and adjust later.
          </Text>
          <TouchableOpacity style={styles.limitUpgradeBtn} onPress={() => router.push('/upgrade')}>
            <Text style={styles.limitUpgradeBtnText}>Upgrade to Pro — Unlimited categories</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.addLabel}>Add a category</Text>
          <View style={styles.typeGrid}>
            {getExpenseCategories(getOnboardingData().country).sort((a, b) => a.label.localeCompare(b.label)).map((category) => (
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
        </>
      )}

      <View style={{ height: 80 }} />
    </KeyboardScrollView>
    <View style={styles.floatingButton}>
      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f2',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  expenseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expenseBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
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
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
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
  progressWrap: { marginBottom: 20 },
  progressTrack: { height: 3, backgroundColor: '#e3e8e3', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 3, backgroundColor: '#3db870', borderRadius: 2 },
  progressLabel: { fontSize: 11, color: '#3db870', fontWeight: '600' },
  nudgeBanner: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#f5d97a', borderRadius: 10, padding: 12, marginBottom: 12 },
  nudgeText: { fontSize: 13, color: '#92400e', textAlign: 'center', fontWeight: '500' },
  limitCard: { backgroundColor: '#fff8f8', borderWidth: 1.5, borderColor: '#f5c6c6', borderRadius: 14, padding: 18, gap: 8, marginBottom: 16 },
  limitTitle: { fontSize: 15, fontWeight: '700', color: '#b91c1c', textAlign: 'center' },
  limitBody: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },
  limitUpgradeBtn: { backgroundColor: '#3db870', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  limitUpgradeBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  floatingButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f2f4f2',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e3e8e3',
    alignItems: 'center',
  },
})