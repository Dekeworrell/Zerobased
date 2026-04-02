import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../components/CurrencyInput'
import { Colors } from '../constants/colors'
import { toMonthly } from '../lib/store'
import { supabase } from '../lib/supabase'

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
  { id: 'mortgage', label: 'Mortgage', icon: '🏦', type: 'fixed' },
  { id: 'dining', label: 'Dining out', icon: '🍽️', type: 'variable' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺', type: 'fixed' },
  { id: 'health', label: 'Health', icon: '💊', type: 'variable' },
  { id: 'fitness', label: 'Fitness', icon: '💪', type: 'fixed' },
  { id: 'clothing', label: 'Clothing', icon: '👕', type: 'variable' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', type: 'variable' },
  { id: 'savings', label: 'Savings', icon: '💰', type: 'priority' },
  { id: 'investments', label: 'Investments', icon: '📈', type: 'priority' },
  { id: 'education', label: 'Education', icon: '📚', type: 'variable' },
  { id: 'childcare', label: 'Childcare', icon: '👶', type: 'fixed' },
  { id: 'pets', label: 'Pets', icon: '🐾', type: 'variable' },
  { id: 'cable_tv', label: 'Cable TV', icon: '📡', type: 'fixed' },
  { id: 'life_insurance', label: 'Life insurance', icon: '🛡️', type: 'fixed' },
  { id: 'rrsp', label: 'RRSP', icon: '📈', type: 'priority' },
  { id: 'tfsa', label: 'TFSA', icon: '🛡️', type: 'priority' },
  { id: 'fhsa', label: 'FHSA', icon: '🏠', type: 'priority' },
  { id: 'mortgage_extra', label: 'Mortgage overpayment', icon: '🏦', type: 'priority' },
  { id: 'emergency_fund', label: 'Emergency fund', icon: '🆘', type: 'priority' },
  { id: 'other', label: 'Other', icon: '➕', type: 'variable' },
]

type Category = {
  id: string
  label: string
  icon: string
  budgeted_amount: string
  frequency: 'monthly' | 'biweekly'
  category_type: 'priority' | 'fixed' | 'variable'
  isNew?: boolean
}

export default function BudgetScreen() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadBudget()
  }, [])

  async function loadBudget() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      const { data: income } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)

      if (income) {
        const total = income.reduce((sum: number, s: any) =>
          sum + toMonthly(s.amount.toString(), s.frequency), 0)
        setMonthlyIncome(total)
      }

      const { data: cats } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('user_id', user.id)

   if (cats) {
        setCategories(cats.map((c: any) => ({
          id: c.id,
          label: c.label,
          icon: c.icon,
          budgeted_amount: c.budgeted_amount.toString(),
          frequency: c.frequency || 'monthly',
          category_type: c.category_type || 'variable',
        })))
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const MULTI_ALLOWED = ['entertainment', 'other', 'loan_repayment']

  function addCategory(cat: typeof EXPENSE_CATEGORIES[0]) {
    if (!MULTI_ALLOWED.includes(cat.id) && categories.find(c => c.label === cat.label)) return
    setCategories([...categories, {
      id: MULTI_ALLOWED.includes(cat.id) ? `${cat.id}_${Date.now()}` : cat.id,
      label: cat.label,
      icon: cat.icon,
      budgeted_amount: '',
      frequency: 'monthly',
      category_type: cat.type as 'priority' | 'fixed' | 'variable' || 'variable',
      isNew: true,
    }])
  }

  function removeCategory(id: string) {
    setCategories(categories.filter(c => c.id !== id))
  }

  function updateAmount(id: string, amount: string) {
    setCategories(categories.map(c => c.id === id ? { ...c, budgeted_amount: amount } : c))
  }

  function updateFrequency(id: string, frequency: 'monthly' | 'biweekly') {
    setCategories(categories.map(c => c.id === id ? { ...c, frequency } : c))
  }

  function updateLabel(id: string, label: string) {
    setCategories(categories.map(c => c.id === id ? { ...c, label } : c))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const newCats = categories.filter(c => c.isNew)
      const existingCats = categories.filter(c => !c.isNew)

      for (const cat of existingCats) {
        await supabase
          .from('budget_categories')
          .update({
            label: cat.label,
            budgeted_amount: parseFloat(cat.budgeted_amount) || 0,
            frequency: cat.frequency,
          })
          .eq('id', cat.id)
      }

      if (newCats.length > 0) {
        await supabase.from('budget_categories').insert(
          newCats.map(c => ({
            user_id: user.id,
            label: c.label,
            icon: c.icon,
            budgeted_amount: parseFloat(c.budgeted_amount) || 0,
            frequency: c.frequency,
          }))
        )
      }

      const { data: dbCats } = await supabase
        .from('budget_categories')
        .select('id')
        .eq('user_id', user.id)

      if (dbCats) {
        const toDelete = dbCats
          .filter((d: any) => !categories.find(c => c.id === d.id || c.isNew))
          .map((d: any) => d.id)

        if (toDelete.length > 0) {
          await supabase
            .from('budget_categories')
            .delete()
            .in('id', toDelete)
        }
      }

      setSuccess(true)
      setTimeout(() => {
        router.replace('/dashboard')
      }, 1000)

    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  const totalBudgeted = categories.reduce((sum, c) =>
    sum + toMonthly(c.budgeted_amount, c.frequency), 0)
  const remaining = Math.round((monthlyIncome - totalBudgeted) * 100) / 100

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

      <Text style={styles.title}>Edit budget</Text>
      <Text style={styles.subtitle}>Adjust your monthly budget categories</Text>

      <View style={[styles.statusCard, {
        borderColor: remaining < 0 ? Colors.danger : Math.abs(remaining) < 0.5 ? Colors.success : Colors.primary,
        backgroundColor: Math.abs(remaining) < 0.5 ? Colors.success + '22' : remaining < 0 ? Colors.danger + '22' : Colors.primaryLight,
      }]}>
        <Text style={styles.statusLabel}>Remaining to assign</Text>
        <Text style={[styles.statusAmount, {
          color: remaining < 0 ? Colors.danger : remaining === 0 ? Colors.success : Colors.primary
        }]}>
          {Math.abs(remaining) < 0.5 ? '🎉 $0' : '$' + Math.abs(remaining).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={[styles.statusBiweekly, {
          color: remaining < 0 ? Colors.danger : remaining === 0 ? Colors.success : Colors.primary
        }]}>
          {Math.abs(remaining) < 0.5 ? 'Every dollar assigned!' : (remaining < 0 ? 'Over budget by $' : 'Unassigned $') + Math.abs(remaining / 2).toLocaleString('en-CA', { maximumFractionDigits: 0 }) + ' per paycheque'}
        </Text>
        <Text style={styles.statusIncome}>
          Monthly income: ${monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })} · Per paycheque: ${(monthlyIncome / 2).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </Text>
      </View>

      <View style={styles.categoryList}>
        {categories.map((cat) => (
          <View key={cat.id} style={styles.categoryRow}>
            <View style={styles.categoryLeft}>
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <TextInput
                  style={styles.categoryLabel}
                  value={cat.label}
                  onChangeText={(val) => updateLabel(cat.id, val)}
                  placeholderTextColor={Colors.textSecondary}
                  selectTextOnFocus
                />
            </View>
            <View style={styles.categoryRight}>
              <View style={styles.freqToggle}>
                <TouchableOpacity
                  style={[styles.freqChip, cat.frequency === 'monthly' && styles.freqChipActive]}
                  onPress={() => updateFrequency(cat.id, 'monthly')}
                >
                  <Text style={[styles.freqChipText, cat.frequency === 'monthly' && styles.freqChipTextActive]}>Mo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.freqChip, cat.frequency === 'biweekly' && styles.freqChipActive]}
                  onPress={() => updateFrequency(cat.id, 'biweekly')}
                >
                  <Text style={[styles.freqChipText, cat.frequency === 'biweekly' && styles.freqChipTextActive]}>BiW</Text>
                </TouchableOpacity>
              </View>
              <CurrencyInput
                style={styles.amountInput}
                placeholder="$0"
                value={cat.budgeted_amount}
                onChangeText={(val) => updateAmount(cat.id, val)}
              />
              <TouchableOpacity onPress={() => removeCategory(cat.id)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.addLabel}>Add a category</Text>
      <View style={styles.typeGrid}>
        {EXPENSE_CATEGORIES.filter(c =>
          ['entertainment', 'other', 'loan_repayment'].includes(c.id) ||
          !categories.find(e => e.label === c.label)
        ).sort((a, b) => a.label.localeCompare(b.label)).map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.typeChip}
            onPress={() => addCategory(category)}
          >
            <Text style={styles.typeChipIcon}>{category.icon}</Text>
            <Text style={styles.typeChipLabel}>{category.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>✅ Budget saved!</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.primaryButtonText}>Save budget</Text>
        }
      </TouchableOpacity>
    </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
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
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusIncome: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  categoryList: {
    gap: 10,
  },
  categoryRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  categoryRight: {
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
    fontWeight: '500',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  error: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    color: Colors.success,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
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

  statusBiweekly: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
})