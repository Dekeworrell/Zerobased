import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import PaydayModal from '../../components/PaydayModal'
import { Colors } from '../../constants/colors'
import { getSubscriptionTier } from '../../lib/purchases'
import { calculateBudgetStatus, getPayPeriodDates, toMonthly, toPeriodAmount } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { getCachedHouseholdIds, getCachedUserId } from '../../lib/userCache'

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
  const [summaryView, setSummaryView] = useState<'cycle' | 'monthly'>('monthly')
  const [categoryDefaults, setCategoryDefaults] = useState<{ [categoryId: string]: string }>({})
  const [globalDefaultAccountId, setGlobalDefaultAccountId] = useState<string | null>(null)
  const [showPaydayModal, setShowPaydayModal] = useState(false)
  const [paydayIncomeSources, setPaydayIncomeSources] = useState<any[]>([])
  const [paydayUserName, setPaydayUserName] = useState('')
  const [paydayActualDate, setPaydayActualDate] = useState('')
  const [isPaydayReminder, setIsPaydayReminder] = useState(false)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free')
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
      const userId = await getCachedUserId()
      if (!userId) { router.replace('/'); return }

      const userIds = await getCachedHouseholdIds(userId)

      // Fire all independent queries in parallel — including household lookups
      const [
        { data: profile },
        { data: income },
        { data: cats },
        { data: accs },
        { data: catDefaults },
        { data: members },
        rcTier,
      ] = await Promise.all([
        supabase.from('profiles').select('name, budget_cycle, default_account_id, last_payday_check, household_id, subscription_tier, paycheque_reminders, summary_view').eq('id', userId).single(),
        supabase.from('income_sources').select('id, label, amount, frequency, next_payday, income_type, user_id').in('user_id', userIds),
        supabase.from('budget_categories').select('id, label, icon, budgeted_amount, frequency, category_type, sort_order').in('user_id', userIds).order('sort_order', { ascending: true }),
        supabase.from('accounts').select('id, label, type, balance, user_id').in('user_id', userIds),
        supabase.from('category_account_defaults').select('category_id, account_id').in('user_id', userIds),
        supabase.rpc('get_household_members'),
        getSubscriptionTier(),
      ])

      // Profile + greeting name
      const profileName = profile?.name || 'there'
      if (profile?.household_id && members && members.length > 0) {
        setName(`${profileName} & ${members[0].name}`)
      } else {
        setName(profileName)
      }

      // Budget cycle — use own profile setting (household members inherit via shared categories)
      const cycle = profile?.budget_cycle || 'monthly'
      setBudgetCycle(cycle)
      setSummaryView(profile?.summary_view === 'cycle' ? 'cycle' : 'monthly')
      if (profile?.default_account_id) setGlobalDefaultAccountId(profile.default_account_id)

      // Payday check — only fires for the current user's own income sources
      const now = new Date()
      const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0]
      const lastCheck = profile?.last_payday_check || ''
      const myIncome = (income || []).filter((s: any) => s.user_id === userId)
      // Combine DB tier and RevenueCat tier — Pro if either says Pro
      const dbTier = (profile?.subscription_tier as string) ?? 'free'
      const tier = dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free'
      const remindersOn = profile?.paycheque_reminders ?? true

      if (tier === 'pro' && remindersOn && !showPaydayModal && !paydayShownRef.current && myIncome.length > 0) {
        const isPendingSkip = lastCheck.startsWith('SKIP:')
        const skippedDate = isPendingSkip ? lastCheck.replace('SKIP:', '') : null

        if (isPendingSkip && skippedDate) {
          // User previously skipped — remind them with the original payday date
          setPaydayIncomeSources(myIncome.map((s: any) => ({ ...s, income_type: s.income_type || 'fixed' })))
          setPaydayUserName(profileName)
          setPaydayActualDate(skippedDate)
          setIsPaydayReminder(true)
          paydayShownRef.current = true
          setShowPaydayModal(true)
        } else {
          // Find the most recent payday that is today or in the past and not yet logged
          let triggeredDate: string | null = null
          for (const s of myIncome) {
            if (!s.next_payday) continue
            // next_payday may be pipe-separated for semi-monthly
            const dates = s.next_payday.split('|').filter((d: string) => d <= todayStr)
            if (dates.length > 0) {
              // Take the most recent one (closest to today)
              const mostRecent = dates.sort().pop()
              if (mostRecent && mostRecent !== lastCheck) {
                triggeredDate = mostRecent
                break
              }
            }
          }
          if (triggeredDate) {
            // Check if triggered date is more than 2 pay periods old
            const triggeredSource = myIncome.find((s: any) => s.next_payday)
            const freq = triggeredSource?.frequency || 'biweekly'
            const periodDays = freq === 'weekly' ? 7 : freq === 'semimonthly' ? 15 : freq === 'monthly' ? 30 : 14
            const cutoff = new Date()
            cutoff.setDate(cutoff.getDate() - (2 * periodDays))
            const cutoffStr = cutoff.toISOString().split('T')[0]

            if (triggeredDate < cutoffStr) {
              // Too old — silently advance next_payday and skip the modal
              for (const s of myIncome) {
                if (!s.next_payday) continue
                const advanced = new Date(triggeredDate + 'T12:00:00')
                while (advanced.toISOString().split('T')[0] <= todayStr) {
                  advanced.setDate(advanced.getDate() + periodDays)
                }
                await supabase.from('income_sources')
                  .update({ next_payday: advanced.toISOString().split('T')[0] })
                  .eq('id', s.id)
              }
              await supabase.from('profiles')
                .update({ last_payday_check: todayStr })
                .eq('id', userId)
            } else {
              // Within 2 pay periods — show the modal normally
              setPaydayIncomeSources(myIncome
                .filter((s: any) => {
                  if (!s.next_payday) return false
                  const dates = s.next_payday.split('|')
                  return dates.some((d: string) => d <= todayStr)
                })
                .map((s: any) => ({ ...s, income_type: s.income_type || 'fixed' })))
              setPaydayUserName(profileName)
              setPaydayActualDate(triggeredDate)
              setIsPaydayReminder(triggeredDate < todayStr)
              paydayShownRef.current = true
              setShowPaydayModal(true)
            }
          }
        }
      }

      // Subscription tier — use combined result
      setSubscriptionTier(tier === 'pro' ? 'pro' : 'free')

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

      // Transactions — for monthly users we can use a pre-calculated date range.
      // For paycycle users, periodStart/End are now set above so we use those.
      if (cats) {
        const txnStart = periodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const txnEnd = periodEnd ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)

        const { data: txns } = await supabase
          .from('transactions')
          .select('category_id, amount, type, is_unexpected, date')
          .in('user_id', userIds)
          .eq('type', 'expense')
          .gte('date', txnStart.toISOString().split('T')[0])
          .lte('date', txnEnd.toISOString().split('T')[0])

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

  const { totalBudgeted: monthlyBudgeted, remaining: unassigned } = useMemo(
    () => calculateBudgetStatus(monthlyIncome, categories),
    [monthlyIncome, categories]
  )

  const paycycleBudgeted = useMemo(() => {
    if (budgetCycle === 'paycycle' && payPeriodStart && payPeriodEnd) {
      return categories.reduce((sum, c) =>
        sum + toPeriodAmount(c.budgeted_amount, c.frequency, budgetCycle, payPeriodStart, payPeriodEnd), 0)
    }
    return monthlyBudgeted / 2
  }, [categories, budgetCycle, payPeriodStart, payPeriodEnd, monthlyBudgeted])

  const displayBudgeted = summaryView === 'monthly' ? monthlyBudgeted : paycycleBudgeted

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

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
            {greeting}, {name} 👋
          </Text>
          <Text style={styles.subGreeting}>
            {budgetCycle === 'paycycle'
              ? `Pay period: ${payPeriodLabel}`
              : `Here's your budget for ${new Date().toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {subscriptionTier !== 'pro' && (
            <TouchableOpacity style={styles.proPill} onPress={() => router.push('/upgrade')}>
              <Text style={styles.proPillText}>⭐ Pro</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {subscriptionTier === 'pro' && accounts.length === 0 && (
        <TouchableOpacity style={styles.setupCard} onPress={() => router.push('/onboarding/accounts-everyday')}>
          <View style={styles.setupCardLeft}>
            <Text style={styles.setupCardTitle}>Complete your Pro setup</Text>
            <Text style={styles.setupCardBody}>Add your accounts, debts, assets, and goals to unlock the full picture.</Text>
          </View>
          <Text style={styles.setupCardArrow}>→</Text>
        </TouchableOpacity>
      )}

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
              <TouchableOpacity onPress={() => router.push('/budget')}>
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
                    if (subscriptionTier !== 'pro') {
                      router.push('/upgrade')
                    } else {
                      const next = summaryView === 'cycle' ? 'monthly' : 'cycle'
                      setSummaryView(next)
                      getCachedUserId().then(async uid => {
                        if (uid) {
                          const { error: svError } = await supabase
                            .from('profiles')
                            .update({ summary_view: next })
                            .eq('id', uid)
                          if (svError) console.error('summary_view save failed:', svError.message)
                        }
                      })
                    }
                  }}
                  style={styles.togglePill}
                >
                  <Text style={styles.togglePillText}>
                    {subscriptionTier !== 'pro'
                      ? '📅 Pay period 🔒'
                      : summaryView === 'cycle' ? '📅 Pay period' : '🗓 Monthly'}
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
                {' '}of ${displayBudgeted.toLocaleString('en-CA', { maximumFractionDigits: 0 })}{summaryView === 'monthly' ? '/mo' : '/period'}
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
                const periodAmount = budgetCycle === 'paycycle' && payPeriodStart && payPeriodEnd
                  ? toPeriodAmount(cat.budgeted_amount, cat.frequency, budgetCycle, payPeriodStart, payPeriodEnd)
                  : monthlyAmount / 2
                const displayAmount = summaryView === 'monthly' ? monthlyAmount : periodAmount
                const displayLabel = summaryView === 'monthly' ? '/mo' : '/period'
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
        accounts={accounts}
        defaultAccountId={globalDefaultAccountId}
        userName={paydayUserName}
        paydayDate={paydayActualDate}
        isReminder={isPaydayReminder}
        onComplete={() => { setShowPaydayModal(false); loadDashboard() }}
        onSkip={async () => {
          // Mark as skipped with the actual payday date so we can remind next open
          const { data: { session } } = await supabase.auth.getSession()
          const user = session?.user
          if (user) {
            await supabase.from('profiles')
              .update({ last_payday_check: `SKIP:${paydayActualDate}` })
              .eq('id', user.id)
          }
          setShowPaydayModal(false)
        }}
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
  setupCard: {
    backgroundColor: '#edf7f1',
    borderWidth: 1.5,
    borderColor: '#b6dfc0',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  setupCardLeft: { flex: 1 },
  setupCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  setupCardBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  setupCardArrow: { fontSize: 20, color: Colors.primary, fontWeight: '600' },
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proPill: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  proPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  settingsBtn: {
    padding: 8,
    paddingRight: 16,
  },
  settingsIcon: {
    fontSize: 24,
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
