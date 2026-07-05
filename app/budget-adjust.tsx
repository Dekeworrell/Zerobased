import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../components/CurrencyInput'
import { Colors } from '../constants/colors'
import { maybeRequestReview } from '../lib/requestReview'
import { toMonthly } from '../lib/store'
import { supabase } from '../lib/supabase'

type Category = {
  id: string
  label: string
  icon: string
  budgeted_amount: number
  frequency: string
  category_type: string
  override_amount: number
}

export default function BudgetAdjustScreen() {
  const { actualPay, expectedPay, periodStart, periodEnd } = useLocalSearchParams<{
    actualPay: string
    expectedPay: string
    periodStart: string
    periodEnd: string
  }>()

  const actual = parseFloat(actualPay || '0')
  const expected = parseFloat(expectedPay || '0')
  const diff = actual - expected

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { data: cats } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('user_id', user.id)

    if (cats) {
      setCategories(cats.map((c: any) => ({
        ...c,
        override_amount: toMonthly(c.budgeted_amount, c.frequency) / 2,
      })))
    }
    setLoading(false)
  }

  function updateOverride(id: string, val: string) {
    setCategories(cats => cats.map(c =>
      c.id === id ? { ...c, override_amount: parseFloat(val) || 0 } : c
    ))
  }

  const totalAssigned = categories.reduce((sum, c) => sum + c.override_amount, 0)
  const remaining = actual - totalAssigned
  const isOver = remaining < -1
  const isZero = Math.abs(remaining) < 1

  function getStatusColor() {
    if (isOver) return Colors.danger
    if (isZero) return Colors.success
    return '#4FC3F7'
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not logged in')
      const user = session.user

      // Delete existing overrides for this period
      await supabase.from('budget_overrides')
        .delete()
        .eq('user_id', user.id)
        .eq('pay_period_start', periodStart)

      // Insert new overrides
      const overrides = categories.map(c => ({
        user_id: user.id,
        category_id: c.id,
        original_amount: toMonthly(c.budgeted_amount, c.frequency) / 2,
        override_amount: c.override_amount,
        pay_period_start: periodStart,
        pay_period_end: periodEnd,
      }))

      await supabase.from('budget_overrides').insert(overrides)

      if (isZero) maybeRequestReview()

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

  const fixedCats = categories.filter(c => c.category_type === 'fixed')
  const variableCats = categories.filter(c => c.category_type === 'variable')
  const priorityCats = categories.filter(c => c.category_type === 'priority')

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.replace('/dashboard')} style={styles.backButton}>
        <Text style={styles.backText}>← Skip for now</Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        {diff < -1 ? '📉 Adjust this cycle' : '🎉 Extra this cycle'}
      </Text>
      <Text style={styles.subtitle}>
        {diff < -1
          ? `You received $${Math.abs(diff).toFixed(0)} less than expected. Adjust your spending below to fit your actual pay of $${actual.toFixed(0)}.`
          : `You received $${diff.toFixed(0)} extra this cycle. Assign it below.`
        }
      </Text>

      <View style={[styles.statusCard, {
        borderColor: getStatusColor(),
        backgroundColor: isZero ? Colors.success + '22' : isOver ? Colors.danger + '22' : Colors.card,
      }]}>
        <Text style={styles.statusLabel}>Remaining to assign</Text>
        <Text style={[styles.statusAmount, { color: getStatusColor() }]}>
          {isZero ? '🎉 $0' : `$${Math.abs(remaining).toFixed(0)}`}
        </Text>
        <Text style={[styles.statusSub, { color: getStatusColor() }]}>
          {isOver ? 'Over budget' : isZero ? 'Every dollar assigned!' : 'Unassigned this cycle'}
        </Text>
        <Text style={styles.statusIncome}>
          Actual pay: ${actual.toFixed(0)} · Expected: ${expected.toFixed(0)}
        </Text>
      </View>

      {[
        { label: '🔒 Fixed expenses', cats: fixedCats },
        { label: '💳 Variable expenses', cats: variableCats },
        { label: '⭐ Priority', cats: priorityCats },
      ].filter(s => s.cats.length > 0).map(section => (
        <View key={section.label} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.label}</Text>
          {section.cats.map(cat => (
            <View key={cat.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>{cat.icon}</Text>
                <View>
                  <Text style={styles.rowLabel}>{cat.label}</Text>
                  <Text style={styles.rowOriginal}>
                    Template: ${(toMonthly(cat.budgeted_amount, cat.frequency) / 2).toFixed(0)}/cycle
                  </Text>
                </View>
              </View>
              <CurrencyInput
                style={styles.input}
                placeholder="$0"
                value={cat.override_amount ? cat.override_amount.toString() : ''}
                onChangeText={(val) => updateOverride(cat.id, val)}
              />
            </View>
          ))}
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryBtn, (isOver || saving) && styles.disabled]}
        onPress={handleSave}
        disabled={isOver || saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.primaryBtnText}>
              {isZero ? 'Save & start cycle' : 'Continue anyway'}
            </Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f2f4f2' },
  content: { paddingHorizontal: 24, paddingVertical: 60, maxWidth: 500, alignSelf: 'center', width: '100%', gap: 16 },
  backButton: { marginBottom: 8 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  statusCard: { borderWidth: 2, borderRadius: 16, padding: 20, alignItems: 'center' },
  statusLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  statusAmount: { fontSize: 40, fontWeight: 'bold', marginBottom: 4 },
  statusSub: { fontSize: 16, fontWeight: '500', marginBottom: 6 },
  statusIncome: { fontSize: 12, color: Colors.textSecondary },
  section: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowIcon: { fontSize: 18 },
  rowLabel: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  rowOriginal: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  input: { backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: Colors.text, width: 90, textAlign: 'right' },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.4 },
  primaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
})