import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist'
import { GestureHandlerRootView, Pressable as GHPressable } from 'react-native-gesture-handler'
import CurrencyInput from '../../components/CurrencyInput'
import { EXPENSE_CATEGORIES } from '../../constants/categories'
import { Colors } from '../../constants/colors'
import { getSubscriptionTier } from '../../lib/purchases'
import { calculateBudgetStatus, toMonthly } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { getCachedHouseholdIds, getCachedUserId } from '../../lib/userCache'

const FREE_TIER_LIMIT = 8
const FREE_TIER_NUDGE_AT = 7

type Category = {
  id: string
  label: string
  icon: string
  budgeted_amount: string
  frequency: 'monthly' | 'biweekly'
  category_type: 'priority' | 'fixed' | 'variable'
  isNew?: boolean
  sort_order: number
}

export default function BudgetScreen() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadBudget()
  }, [])

  async function loadBudget() {
    try {
      const userId = await getCachedUserId()
      if (!userId) { router.replace('/'); return }

      const [{ data: profile }, rcTier, userIds] = await Promise.all([
        supabase.from('profiles').select('subscription_tier').eq('id', userId).single(),
        getSubscriptionTier(),
        getCachedHouseholdIds(userId),
      ])
      const dbTier = (profile?.subscription_tier as 'free' | 'pro') ?? 'free'
      setSubscriptionTier(dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free')

      const [{ data: income }, { data: cats }] = await Promise.all([
        supabase.from('income_sources').select('amount, frequency, user_id').in('user_id', userIds),
        supabase.from('budget_categories').select('id, label, icon, budgeted_amount, frequency, category_type, sort_order').in('user_id', userIds).order('sort_order', { ascending: true }),
      ])

      if (income) {
        const total = income.reduce((sum: number, s: any) =>
          sum + toMonthly(s.amount.toString(), s.frequency), 0)
        setMonthlyIncome(total)
      }

      if (cats) {
        setCategories(cats.map((c: any, index: number) => ({
          id: c.id,
          label: c.label,
          icon: c.icon,
          budgeted_amount: c.budgeted_amount.toString(),
          frequency: c.frequency || 'monthly',
          category_type: c.category_type || 'variable',
          sort_order: c.sort_order ?? index,
        })))
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  function addCategory(cat: typeof EXPENSE_CATEGORIES[0]) {
    setCategories([...categories, {
      id: `${cat.id}_${Date.now()}`,
      label: cat.label,
      icon: cat.icon,
      budgeted_amount: '',
      frequency: 'monthly',
      category_type: cat.type as 'priority' | 'fixed' | 'variable' || 'variable',
      isNew: true,
      sort_order: categories.length,
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

  async function saveSortOrder(reorderedCats: Category[]) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      for (let i = 0; i < reorderedCats.length; i++) {
        if (!reorderedCats[i].isNew) {
          await supabase
            .from('budget_categories')
            .update({ sort_order: i })
            .eq('id', reorderedCats[i].id)
        }
      }
    } catch (err) {
      console.warn('Sort order save failed:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not logged in')
      const user = session.user

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
          newCats.map((c, i) => ({
            user_id: user.id,
            label: c.label,
            icon: c.icon,
            budgeted_amount: parseFloat(c.budgeted_amount) || 0,
            frequency: c.frequency,
            sort_order: existingCats.length + i,
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

  const { totalBudgeted, remaining } = calculateBudgetStatus(monthlyIncome, categories)

  function renderItem({ item: cat, drag, isActive }: RenderItemParams<Category>) {
    return (
      <ScaleDecorator>
        <View style={[styles.categoryRow, isActive && styles.categoryRowActive]}>
          <View style={styles.categoryTopRow}>
            {Platform.OS === 'web' ? (
              <span
                onPointerDown={(e: any) => {
                  e.preventDefault()
                  e.currentTarget.releasePointerCapture(e.pointerId)
                  drag()
                }}
                style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', fontSize: 18, color: Colors.textSecondary, padding: 4 } as any}
              >â˜°</span>
            ) : (
              <GHPressable onLongPress={drag} delayLongPress={200}>
                <Text style={styles.dragHandle}>â˜°</Text>
              </GHPressable>
            )}
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <TextInput
              style={styles.categoryLabel}
              value={cat.label}
              onChangeText={(val) => updateLabel(cat.id, val)}
              placeholderTextColor={Colors.textSecondary}
            />
            <TouchableOpacity onPress={() => removeCategory(cat.id)}>
              <Text style={styles.removeBtn}>âœ•</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.categoryBottomRow}>
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
          </View>
        </View>
      </ScaleDecorator>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const headerComponent = (
    <View style={styles.headerContent}>
      <Text style={styles.title}>Edit budget</Text>
      <Text style={styles.subtitle}>Adjust your monthly budget categories</Text>
      <View style={[styles.statusCard, {
        borderColor: remaining < 0 ? Colors.danger : Math.abs(remaining) < 0.5 ? Colors.success : Colors.info,
        backgroundColor: remaining < 0 ? Colors.danger + '22' : Math.abs(remaining) < 0.5 ? Colors.success + '22' : Colors.info + '22',
      }]}>
        <Text style={styles.statusLabel}>Remaining to assign</Text>
        <Text style={[styles.statusAmount, {
          color: remaining < 0 ? Colors.danger : Math.abs(remaining) < 0.5 ? Colors.success : Colors.info
        }]}>
          {Math.abs(remaining) < 0.5 ? 'ðŸŽ‰ $0' : '$' + Math.abs(remaining).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={[styles.statusBiweekly, {
          color: remaining < 0 ? Colors.danger : Math.abs(remaining) < 0.5 ? Colors.success : Colors.info
        }]}>
          {Math.abs(remaining) < 0.5 ? 'Every dollar assigned!' : (remaining < 0 ? 'Over budget by $' : 'Unassigned $') + Math.abs(remaining / 2).toLocaleString('en-CA', { maximumFractionDigits: 0 }) + ' per paycheque'}
        </Text>
        <Text style={styles.statusIncome}>
          Monthly income: ${monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })} Â· Per paycheque: ${(monthlyIncome / 2).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </Text>
      </View>
      <Text style={styles.dragHint}>Hold â˜° to drag and reorder</Text>
    </View>
  )

  const atNudge = subscriptionTier === 'free' && categories.length === FREE_TIER_NUDGE_AT
  const atLimit = subscriptionTier === 'free' && categories.length >= FREE_TIER_LIMIT

  const footerComponent = (
    <View style={styles.footerContent}>
      {atNudge && (
        <View style={styles.nudgeBanner}>
          <Text style={styles.nudgeText}>
            1 category left on your Free plan â€” Zerobased Pro has unlimited
          </Text>
        </View>
      )}
      {atLimit ? (
        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeCardTitle}>You've reached your Free plan limit.</Text>
          <Text style={styles.upgradeCardBody}>
            Upgrade to Zerobased Pro for unlimited categories.
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/upgrade')}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.addLabel}>Add a category</Text>
          <View style={styles.typeGrid}>
            {EXPENSE_CATEGORIES.sort((a, b) => a.label.localeCompare(b.label)).map((category) => (
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
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>âœ… Budget saved!</Text> : null}
      <View style={{ height: 80 }} />
    </View>
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DraggableFlatList
        data={categories}
        onDragEnd={({ data }) => {
          setCategories(data)
          saveSortOrder(data)
        }}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={headerComponent}
        ListFooterComponent={footerComponent}
        containerStyle={styles.container}
        contentContainerStyle={styles.content}
      />
      <View style={styles.floatingButton}>
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
      </View>
    </GestureHandlerRootView>
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
    paddingBottom: 100,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  headerContent: {
    paddingTop: 60,
    gap: 16,
    marginBottom: 10,
  },
  footerContent: {
    gap: 16,
    marginTop: 10,
  },
  dragHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dragHandle: {
    fontSize: 18,
    color: Colors.textSecondary,
    paddingRight: 4,
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
  categoryRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  categoryRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '11',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
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
  statusBiweekly: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
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
  nudgeBanner: {
    backgroundColor: Colors.info + '18',
    borderWidth: 1,
    borderColor: Colors.info + '44',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nudgeText: {
    fontSize: 13,
    color: Colors.info,
    textAlign: 'center',
  },
  upgradeCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  upgradeCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  upgradeCardBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 8,
  },
  upgradeButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})
