import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { calculateBudgetStatus, getPayPeriodDates, toMonthly } from '../lib/store'
import { supabase } from '../lib/supabase'

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true)
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [name, setName] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [totalSpent, setTotalSpent] = useState(0)
  const [error, setError] = useState('')
  const [budgetCycle, setBudgetCycle] = useState<'monthly' | 'paycycle'>('monthly')
  const [payPeriodLabel, setPayPeriodLabel] = useState('this month')
  const [payPeriodStart, setPayPeriodStart] = useState<Date | null>(null)
  const [payPeriodEnd, setPayPeriodEnd] = useState<Date | null>(null)

  useFocusEffect(
    useCallback(() => {
      loadDashboard()
    }, [])
  )

  async function loadDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, budget_cycle')
        .eq('id', user.id)
        .single()

      setName(profile?.name || user.email?.split('@')[0] || 'there')

      const cycle = profile?.budget_cycle || 'monthly'
      setBudgetCycle(cycle)

      const { data: income } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)

      let periodStart: Date | null = null
      let periodEnd: Date | null = null

      if (income) {
        const total = income.reduce((sum: number, s: any) => sum + toMonthly(s.amount.toString(), s.frequency), 0)
        setMonthlyIncome(total)

        if (cycle === 'paycycle') {
          const primaryIncome = income.find((s: any) => s.next_payday) || income[0]
          if (primaryIncome?.next_payday) {
            const { start, end } = getPayPeriodDates(primaryIncome.next_payday, primaryIncome.frequency)
            periodStart = start
            periodEnd = end
            setPayPeriodStart(start)
            setPayPeriodEnd(end)

            const startStr = start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
            const endStr = end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
            setPayPeriodLabel(`${startStr} – ${endStr}`)
          }
        } else {
          const now = new Date()
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          setPayPeriodLabel('this month')
        }
      }

      const { data: cats } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('user_id', user.id)

      if (cats) {
        let txnQuery = supabase
          .from('transactions')
          .select('category_id, amount, type, is_unexpected, date')
          .eq('user_id', user.id)
          .eq('type', 'expense')

        if (periodStart && periodEnd) {
          txnQuery = txnQuery
            .gte('date', periodStart.toISOString().split('T')[0])
            .lte('date', periodEnd.toISOString().split('T')[0])
        }

        const { data: txns } = await txnQuery

        const catsWithSpent = cats.map((cat: any) => {
          const spent = txns
            ? txns
                .filter((t: any) => t.category_id === cat.id)
                .reduce((sum: number, t: any) => sum + t.amount, 0)
            : 0
          return { ...cat, spent }
        })

        const unexpectedTotal = txns
          ? txns
              .filter((t: any) => t.is_unexpected)
              .reduce((sum: number, t: any) => sum + t.amount, 0)
          : 0

        setCategories(catsWithSpent)
        setTotalSpent(
          catsWithSpent.reduce((sum: number, c: any) => sum + c.spent, 0) + unexpectedTotal
        )
      }

      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)

      if (accs) setAccounts(accs)

    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const { totalBudgeted: monthlyBudgeted, remaining: unassigned } = calculateBudgetStatus(monthlyIncome, categories)

  const totalBudgeted = budgetCycle === 'paycycle' && payPeriodStart && payPeriodEnd
    ? categories.reduce((sum, c) => {
        const monthly = toMonthly(c.budgeted_amount.toString(), c.frequency)
        const days = Math.round((payPeriodEnd.getTime() - payPeriodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        return sum + (monthly / 30) * days
      }, 0)
    : monthlyBudgeted

  const LIABILITY_TYPES = [
    'mortgage', 'heloc', 'loc', 'carloan', 'studentloan', 'creditcard', 'other_liability',
    'loan', 'credit', 'car_loan', 'student_loan', 'credit_card', 'line_of_credit',
  ]

  function isLiability(type: string) {
    const t = type.toLowerCase()
    return LIABILITY_TYPES.some(l => t.startsWith(l) || t.includes(l))
  }

  const netWorth = accounts.reduce((sum, a) => {
    const balance = parseFloat(a.balance) || 0
    return isLiability(a.type) ? sum - balance : sum + balance
  }, 0)

  function getHour() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your budget...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
            {getHour()}, {name} 👋
          </Text>
          <Text style={styles.subGreeting}>
            {budgetCycle === 'paycycle'
              ? `Pay period: ${payPeriodLabel}`
              : `Here's your budget this month`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text style={styles.netWorthAmount}>
          ${netWorth.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={styles.netWorthSub}>Based on your account balances</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Text style={styles.statLabel}>Monthly Income</Text>
            <TouchableOpacity onPress={() => router.push('/onboarding/income?from=dashboard')}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.statValue}>
            ${monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.statBiweekly}>
            ${(monthlyIncome / 2).toLocaleString('en-CA', { maximumFractionDigits: 0 })} per paycheque
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Unassigned</Text>
          <Text style={[styles.statValue, { color: unassigned < 0 ? Colors.danger : unassigned === 0 ? Colors.success : Colors.info }]}>
            {unassigned < 0 ? '-' : ''}${Math.abs(unassigned).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.statBiweekly}>
            {unassigned < 0 ? 'Over by $' : '$'}{Math.abs(unassigned / 2).toLocaleString('en-CA', { maximumFractionDigits: 0 })} per paycheque
          </Text>
        </View>
      </View>

      {categories.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Categories</Text>
            <TouchableOpacity onPress={() => router.push('/budget')}>
              <Text style={styles.editLink}>Edit Budget</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.budgetSummaryCard}
            onPress={() => setCategoriesExpanded(!categoriesExpanded)}
          >
            <View style={styles.budgetSummaryRow}>
              <View style={styles.budgetSummaryLeft}>
                <Text style={styles.budgetSummaryIcons}>
                  {categories.slice(0, 4).map(c => c.icon).join(' ')}
                </Text>
                <Text style={styles.budgetSummaryText}>
                  {categories.length} categories
                </Text>
              </View>
              <View style={styles.budgetSummaryRight}>
                <Text style={styles.budgetSummaryAmount}>
                  ${totalBudgeted.toLocaleString('en-CA', { maximumFractionDigits: 0 })}{budgetCycle === 'paycycle' ? '/period' : '/mo'}
                </Text>
                <Text style={styles.budgetSummaryChevron}>
                  {categoriesExpanded ? '▲' : '▼'}
                </Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${Math.min((totalSpent / totalBudgeted) * 100, 100)}%` as any,
                backgroundColor: totalSpent >= totalBudgeted ? Colors.danger : totalSpent >= totalBudgeted * 0.8 ? Colors.warning : Colors.primary
              }]} />
            </View>
            <View style={styles.budgetSummaryFooter}>
              <Text style={styles.budgetSummarySubtext}>
                ${totalSpent.toLocaleString('en-CA', { maximumFractionDigits: 0 })} spent · ${(totalBudgeted - totalSpent).toLocaleString('en-CA', { maximumFractionDigits: 0 })} remaining
              </Text>
              <Text style={styles.budgetSummarySubtext}>
                {totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(0) : 0}%
              </Text>
            </View>
          </TouchableOpacity>

          {categoriesExpanded && (
            <View style={styles.categoryList}>
              {categories.map((cat) => {
                const monthlyAmount = toMonthly(cat.budgeted_amount.toString(), cat.frequency)
                let periodAmount = monthlyAmount
                if (budgetCycle === 'paycycle' && payPeriodStart && payPeriodEnd) {
                  const days = Math.round((payPeriodEnd.getTime() - payPeriodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                  periodAmount = (monthlyAmount / 30) * days
                }
                return (
                  <TouchableOpacity key={cat.id} style={styles.categoryCard}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryLeft}>
                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                        <Text style={styles.categoryLabel}>{cat.label}</Text>
                      </View>
                      <View style={styles.categoryRight}>
                        <Text style={styles.categoryBudgeted}>
                          ${periodAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })}{budgetCycle === 'paycycle' ? '/period' : '/mo'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.categoryProgressBar}>
                      <View style={[styles.categoryProgressFill, {
                        width: `${Math.min((cat.spent / periodAmount) * 100, 100)}%` as any,
                        backgroundColor: cat.spent >= periodAmount ? Colors.danger : cat.spent >= periodAmount * 0.8 ? Colors.warning : Colors.success
                      }]} />
                    </View>
                    <View style={styles.categorySpentRow}>
                      <Text style={styles.categoryRemaining}>
                        ${(periodAmount - cat.spent).toLocaleString('en-CA', { maximumFractionDigits: 0 })} remaining
                      </Text>
                      <Text style={styles.categorySpentAmount}>
                        ${cat.spent.toLocaleString('en-CA', { maximumFractionDigits: 0 })} spent
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </>
      )}

      {categories.length === 0 && (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => router.push('/onboarding/tracking-method')}
        >
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No budget set up yet</Text>
          <Text style={styles.emptySubtitle}>Tap to complete your budget setup</Text>
        </TouchableOpacity>
      )}

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/add-transaction')}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>Add Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/transactions')}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>Transactions</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/accounts')}>
            <Text style={styles.actionIcon}>🏦</Text>
            <Text style={styles.actionLabel}>Accounts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/reports')}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Reports</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
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
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subGreeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  settingsBtn: {
    padding: 8,
    paddingRight: 16,
  },
  settingsIcon: {
    fontSize: 24,
  },
  netWorthCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  netWorthLabel: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 8,
  },
  netWorthAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#0A2A1A',
    marginBottom: 8,
  },
  netWorthSub: {
    fontSize: 13,
    color: Colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statBiweekly: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryList: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBudgeted: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  categoryProgressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  categoryRemaining: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
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
  quickActions: {
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  budgetSummaryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  budgetSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  budgetSummaryIcons: {
    fontSize: 16,
  },
  budgetSummaryText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  budgetSummaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  budgetSummaryAmount: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  budgetSummaryChevron: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  budgetSummarySubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  categorySpentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categorySpentAmount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetSummaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
})