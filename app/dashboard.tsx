import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import PaydayModal from '../components/PaydayModal'
import { isLiabilityAccount } from '../constants/categories'
import { Colors } from '../constants/colors'
import { calculateBudgetStatus, getPayPeriodDates, toMonthly, toPeriodAmount } from '../lib/store'
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
  const [summaryView, setSummaryView] = useState<'cycle' | 'monthly'>('cycle')
  const [categoryDefaults, setCategoryDefaults] = useState<{ [categoryId: string]: string }>({})
  const [globalDefaultAccountId, setGlobalDefaultAccountId] = useState<string | null>(null)
  const [showPaydayModal, setShowPaydayModal] = useState(false)
  const [paydayIncomeSources, setPaydayIncomeSources] = useState<any[]>([])
  const scrollRef = useRef<ScrollView>(null)
  const paydayShownRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      setCategoriesExpanded(false)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
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

      const { data: householdIds } = await supabase.rpc('get_household_user_ids')
      const userIds: string[] = householdIds || [user.id]

      // Fire all independent queries in parallel
      const [
        { data: profile },
        { data: income },
        { data: cats },
        { data: accs },
        { data: catDefaults },
      ] = await Promise.all([
        supabase.from('profiles').select('name, budget_cycle, default_account_id, last_payday_check, household_id').eq('id', user.id).single(),
        supabase.from('income_sources').select('*').in('user_id', userIds),
        supabase.from('budget_categories').select('*').in('user_id', userIds).order('sort_order', { ascending: true }),
        supabase.from('accounts').select('*').in('user_id', userIds),
        supabase.from('category_account_defaults').select('category_id, account_id').in('user_id', userIds),
      ])

      // Profile
      const profileName = profile?.name || 'there'
      if (profile?.household_id) {
        const { data: members } = await supabase.rpc('get_household_members')
        if (members && members.length > 0) {
          setName(`${profileName} & ${members[0].name}`)
        } else {
          setName(profileName)
        }
      } else {
        setName(profileName)
      }
      let cycle = profile?.budget_cycle || 'monthly'
      // If no income on this profile, use partner's budget cycle
      if (profile?.household_id) {
        const { data: householdProfiles } = await supabase
          .from('profiles')
          .select('budget_cycle')
          .eq('household_id', profile.household_id)
          .neq('budget_cycle', null)
        if (householdProfiles && householdProfiles.length > 0) {
          const withCycle = householdProfiles.find((p: any) => p.budget_cycle === 'paycycle')
          if (withCycle) cycle = 'paycycle'
        }
      }
      setBudgetCycle(cycle)
      if (profile?.default_account_id) setGlobalDefaultAccountId(profile.default_account_id)

      // Payday check
      const now = new Date()
      const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0]
      const lastCheck = profile?.last_payday_check || ''
      if (lastCheck !== todayStr && !showPaydayModal && !paydayShownRef.current && income && income.length > 0) {
        const isPayday = income.some((s: any) => {
          if (!s.next_payday) return false
          const paydays = s.next_payday.split('|')
          return paydays.some((d: string) => d === todayStr)
        })
        if (isPayday) {
          setPaydayIncomeSources(income.map((s: any) => ({
            ...s,
            income_type: s.income_type || 'fixed',
          })))
          paydayShownRef.current = true
          setShowPaydayModal(true)
        }
      }

      // Accounts
      if (accs) setAccounts(accs)

      // Category defaults
      if (catDefaults) {
        const map: { [key: string]: string } = {}
        catDefaults.forEach((d: any) => { map[d.category_id] = d.account_id })
        setCategoryDefaults(map)
      }

      // Income + pay period dates
      let periodStart: Date | null = null
      let periodEnd: Date | null = null

      if (income) {
        const total = income.reduce((sum: number, s: any) =>
          sum + toMonthly(s.amount.toString(), s.frequency), 0)
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

      // Transactions — depends on pay period so runs after
      if (cats) {
        let txnQuery = supabase
          .from('transactions')
          .select('category_id, amount, type, is_unexpected, date')
          .in('user_id', userIds)
          .eq('type', 'expense')

        if (periodStart && periodEnd) {
          txnQuery = txnQuery
            .gte('date', periodStart.toISOString().split('T')[0])
            .lte('date', periodEnd.toISOString().split('T')[0])
        }

        const { data: txns } = await txnQuery

        const catsWithSpent = cats.map((cat: any) => {
          const spent = txns
            ? txns.filter((t: any) => t.category_id === cat.id)
                  .reduce((sum: number, t: any) => sum + t.amount, 0)
            : 0
          return { ...cat, spent }
        })

        const unexpectedTotal = txns
          ? txns.filter((t: any) => t.is_unexpected)
                .reduce((sum: number, t: any) => sum + t.amount, 0)
          : 0

        setCategories(catsWithSpent.sort((a: any, b: any) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0)
        ))
        setTotalSpent(
          catsWithSpent.reduce((sum: number, c: any) => sum + c.spent, 0) + unexpectedTotal
        )
      }

    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const { totalBudgeted: monthlyBudgeted, remaining: unassigned } = calculateBudgetStatus(monthlyIncome, categories)

  const paycycleBudgeted = payPeriodStart && payPeriodEnd
    ? categories.reduce((sum, c) => {
        return sum + toPeriodAmount(c.budgeted_amount, c.frequency, budgetCycle, payPeriodStart, payPeriodEnd)
      }, 0)
    : monthlyBudgeted / 2

  const totalBudgeted = budgetCycle === 'paycycle' ? paycycleBudgeted : monthlyBudgeted

  const displayBudgeted = summaryView === 'monthly' ? monthlyBudgeted : totalBudgeted

  const netWorth = accounts.reduce((sum, a) => {
    const balance = parseFloat(a.balance) || 0
    return isLiabilityAccount(a.type) ? sum - balance : sum + balance
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
    <>
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.greeting} adjustsFontSizeToFit numberOfLines={2}>
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
          <View style={styles.statCardHeader}>
            <Text style={styles.statLabel}>Unassigned</Text>
            {unassigned > 0 && (
              <TouchableOpacity onPress={() => router.push('/onboarding/assign')}>
                <Text style={styles.editLink}>Assign</Text>
              </TouchableOpacity>
            )}
          </View>
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
                  {categories.slice(0, 3).map(c => c.icon).join(' ')}
                </Text>
                <Text style={styles.budgetSummaryText}>
                  {categories.length} categories
                </Text>
              </View>
              <View style={styles.budgetSummaryRight}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation()
                    setSummaryView(v => v === 'cycle' ? 'monthly' : 'cycle')
                  }}
                  style={styles.togglePill}
                >
                  <Text style={styles.togglePillText}>
                    {summaryView === 'cycle'
                      ? budgetCycle === 'paycycle' ? '📅 Pay period' : '📅 Monthly'
                      : '🗓 Monthly'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.budgetSummaryChevron}>
                  {categoriesExpanded ? '▲' : '▼'}
                </Text>
              </View>
            </View>
            <View style={[styles.budgetSummaryRow, { marginTop: 8 }]}>
              <Text style={styles.budgetSummaryAmount}>
                ${(displayBudgeted - totalSpent).toLocaleString('en-CA', { maximumFractionDigits: 0 })} remaining
              </Text>
              <Text style={[styles.budgetSummaryAmount, { fontSize: 13, color: Colors.textSecondary, fontWeight: '400' }]}>
                {' '}of ${displayBudgeted.toLocaleString('en-CA', { maximumFractionDigits: 0 })}{summaryView === 'monthly' ? '/mo' : budgetCycle === 'paycycle' ? '/period' : '/mo'}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${Math.min((totalSpent / displayBudgeted) * 100, 100)}%` as any,
                backgroundColor: totalSpent > displayBudgeted ? Colors.danger : totalSpent >= displayBudgeted * 0.8 ? Colors.warning : Colors.primary
              }]} />
            </View>
            <View style={styles.budgetSummaryFooter}>
              <Text style={styles.budgetSummarySubtext}>
                ${totalSpent.toLocaleString('en-CA', { maximumFractionDigits: 0 })} spent · ${(displayBudgeted - totalSpent).toLocaleString('en-CA', { maximumFractionDigits: 0 })} remaining
              </Text>
              <Text style={styles.budgetSummarySubtext}>
                {displayBudgeted > 0 ? ((totalSpent / displayBudgeted) * 100).toFixed(0) : 0}%
              </Text>
            </View>
          </TouchableOpacity>

          {categoriesExpanded && (
            <View style={styles.categoryList}>
              {categories.map((cat) => {
                const monthlyAmount = toMonthly(cat.budgeted_amount.toString(), cat.frequency)
                const periodAmount = toPeriodAmount(
                  cat.budgeted_amount,
                  cat.frequency,
                  budgetCycle,
                  payPeriodStart,
                  payPeriodEnd
                )
                const displayAmount = summaryView === 'monthly' ? monthlyAmount : periodAmount
                const displayLabel = summaryView === 'monthly' ? '/mo' : budgetCycle === 'paycycle' ? '/period' : '/mo'
                return (
                  <TouchableOpacity key={cat.id} style={styles.categoryCard}
                    onPress={() => router.push({ pathname: '/add-transaction', params: { categoryId: cat.id, categoryLabel: cat.label, categoryIcon: cat.icon } })}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryLeft}>
                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                        <Text style={styles.categoryLabel}>{cat.label}</Text>
                      </View>
                      <View style={styles.categoryRight}>
                        <Text style={styles.categoryBudgeted}>
                          ${displayAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })}{displayLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.categoryProgressBar}>
                      <View style={[styles.categoryProgressFill, {
                        width: `${Math.min((cat.spent / displayAmount) * 100, 100)}%` as any,
                        backgroundColor: cat.spent > displayAmount ? Colors.danger : cat.spent >= displayAmount * 0.8 ? Colors.warning : Colors.success
                      }]} />
                    </View>
                    <View style={styles.categorySpentRow}>
                      <Text style={styles.categoryRemaining}>
                        ${(displayAmount - cat.spent).toLocaleString('en-CA', { maximumFractionDigits: 0 })} remaining
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
    {showPaydayModal && (
      <PaydayModal
        visible={showPaydayModal}
        incomeSources={paydayIncomeSources}
        onComplete={() => { setShowPaydayModal(false); loadDashboard() }}
      />
    )}
    </>
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
    backgroundColor: '#f2f4f2',
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
    flexShrink: 1,
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
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
  togglePill: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  togglePillText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
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