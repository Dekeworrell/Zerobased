import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { BarChart, LineChart } from 'react-native-gifted-charts'
import { Colors } from '../constants/colors'
import { getSubscriptionTier } from '../lib/purchases'
import { toMonthly } from '../lib/store'
import { supabase } from '../lib/supabase'
import { getCachedHouseholdIds, getCachedUserId } from '../lib/userCache'

const SCREEN_WIDTH = Dimensions.get('window').width
const CHART_WIDTH = SCREEN_WIDTH - 80

const LIABILITY_TYPES = [
  'mortgage', 'heloc', 'loc', 'carloan', 'studentloan', 'creditcard',
  'other_liability', 'loan', 'credit', 'car_loan', 'student_loan',
  'credit_card', 'line_of_credit',
]

function isLiability(type: string) {
  const t = type.toLowerCase()
  return LIABILITY_TYPES.some(l => t.startsWith(l) || t.includes(l))
}

const GOAL_ICONS: { [key: string]: string } = {
  'buy a home': '🏠', 'home': '🏠', 'house': '🏠',
  'pay off debt': '💳', 'debt': '💳',
  'student loan': '🎓', 'emergency fund': '🆘', 'emergency': '🆘',
  'retirement': '📈', 'invest': '📈',
  'travel': '✈️', 'vacation': '✈️',
  'education': '🎓', 'car': '🚗', 'vehicle': '🚗',
  'wedding': '💍', 'baby': '👶', 'children': '👶',
}

function getGoalIcon(goal: string): string {
  const lower = goal.toLowerCase()
  for (const key of Object.keys(GOAL_ICONS)) {
    if (lower.includes(key)) return GOAL_ICONS[key]
  }
  return '🎯'
}

type MonthSummary = {
  month: string
  shortLabel: string
  label: string
  income: number
  expenses: number
  savings: number
}

type CategorySummary = {
  label: string
  icon: string
  budgeted: number
  spent: number
}

type Snapshot = {
  month: string
  net_worth: number
  total_assets: number
  total_liabilities: number
}

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([])
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [currentNetWorth, setCurrentNetWorth] = useState(0)
  const [currentLiabilities, setCurrentLiabilities] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [goals, setGoals] = useState<string[]>([])
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [ivMode, setIvMode] = useState<'bar' | 'line'>('bar')
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | null>(null)

  useFocusEffect(
    useCallback(() => {
      loadReports()
    }, [])
  )

  async function loadReports() {
    setLoading(true)
    try {
      const userId = await getCachedUserId()
      if (!userId) { router.replace('/'); return }
      const userIds = await getCachedHouseholdIds(userId)

      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
      const fromDate = twelveMonthsAgo.toISOString().slice(0, 7) + '-01'

      // Fire all independent queries in parallel
      const [
        { data: profile },
        { data: income },
        { data: accounts },
        { data: txns },
        { data: cats },
        { data: snaps },
        rcTier,
      ] = await Promise.all([
        supabase.from('profiles').select('goals, primary_goal, subscription_tier').eq('id', userId).single(),
        supabase.from('income_sources').select('amount, frequency, user_id').in('user_id', userIds),
        supabase.from('accounts').select('id, label, type, balance, user_id').in('user_id', userIds),
        supabase.from('transactions')
          .select('amount, date, type, is_unexpected, category:budget_categories(label, icon)')
          .in('user_id', userIds)
          .gte('date', fromDate)
          .order('date', { ascending: false }),
        supabase.from('budget_categories').select('id, label, icon, budgeted_amount, frequency').in('user_id', userIds),
        supabase.from('monthly_snapshots')
          .select('month, net_worth, total_assets, total_liabilities')
          .in('user_id', userIds)
          .order('month', { ascending: true })
          .limit(12),
        getSubscriptionTier(),
      ])

      // Profile
      if (profile) {
        setGoals(profile.goals || [])
        setPrimaryGoal(profile.primary_goal || '')
        const dbTier = (profile.subscription_tier as 'free' | 'pro') ?? 'free'
        setSubscriptionTier(dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free')
      }

      // Income
      let totalMonthlyIncome = 0
      if (income) {
        totalMonthlyIncome = income.reduce((sum: number, s: any) =>
          sum + toMonthly(s.amount.toString(), s.frequency), 0)
        setMonthlyIncome(totalMonthlyIncome)
      }

      // Accounts — net worth
      let netWorth = 0
      let totalAssets = 0
      let totalLiabilities = 0
      if (accounts) {
        accounts.forEach((a: any) => {
          const bal = parseFloat(a.balance) || 0
          if (isLiability(a.type)) { totalLiabilities += bal }
          else { totalAssets += bal }
        })
        netWorth = totalAssets - totalLiabilities
        setCurrentNetWorth(netWorth)
        setCurrentLiabilities(totalLiabilities)
      }

      // Snapshots
      if (snaps) setSnapshots(snaps)

      // Transactions — build month summaries
      if (txns) {
        const monthMap: { [key: string]: MonthSummary } = {}
        txns.forEach((t: any) => {
          const month = t.date.slice(0, 7)
          if (!monthMap[month]) {
            const date = new Date(month + '-01T00:00:00')
            monthMap[month] = {
              month,
              shortLabel: date.toLocaleDateString('en-CA', { month: 'short' }),
              label: date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
              income: 0,
              expenses: 0,
              savings: 0,
            }
          }
          if (t.type === 'income') { monthMap[month].income += t.amount }
          else { monthMap[month].expenses += t.amount }
        })

        Object.values(monthMap).forEach(m => {
          const inc = m.income > 0 ? m.income : totalMonthlyIncome
          m.savings = inc - m.expenses
        })

        const sorted = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month))
        setMonthSummaries(sorted)
        if (sorted.length > 0) setSelectedMonth(sorted[0].month)

        // Category breakdown — cats already loaded, no extra query needed
        if (cats && sorted.length > 0) {
          const currentMonthStr = sorted[0].month
          const currentTxns = txns.filter((t: any) =>
            t.date.slice(0, 7) === currentMonthStr && t.type === 'expense'
          )
          const catSummaries = cats.map((cat: any) => {
            const spent = currentTxns
              .filter((t: any) => t.category?.label === cat.label)
              .reduce((sum: number, t: any) => sum + t.amount, 0)
            return {
              label: cat.label,
              icon: cat.icon,
              budgeted: toMonthly(cat.budgeted_amount.toString(), cat.frequency),
              spent,
            }
          }).filter(c => c.budgeted > 0 || c.spent > 0)
          setCategories(catSummaries)
        }
      }

      // Save / update this month's snapshot (fire and forget — don't await)
      const currentMonth = new Date().toISOString().slice(0, 7)
      supabase.from('monthly_snapshots').upsert(
        { user_id: userId, month: currentMonth, net_worth: netWorth, total_assets: totalAssets, total_liabilities: totalLiabilities },
        { onConflict: 'user_id,month' }
      )

    } catch (err: any) {
      console.error(err.message)
    }
    setLoading(false)
  }

  // ── Derived data ──────────────────────────────────────────────
  const last6 = monthSummaries.slice(0, 6).reverse()
  const currentMonthData = monthSummaries.find(m => m.month === selectedMonth)
  const prevMonthData = monthSummaries[1]

  const netAmount = currentMonthData
    ? (currentMonthData.income > 0 ? currentMonthData.income : monthlyIncome) - currentMonthData.expenses
    : 0

  const prevNet = prevMonthData
    ? (prevMonthData.income > 0 ? prevMonthData.income : monthlyIncome) - prevMonthData.expenses
    : null

  const labelStyle = { color: '#9eab9e', fontSize: 10 }

  const nwChartData = snapshots.length >= 2
    ? snapshots.slice(-6).map(s => ({
        value: Math.round(s.net_worth),
        label: new Date(s.month + '-01').toLocaleDateString('en-CA', { month: 'short' }),
      }))
    : []

  const debtChartData = snapshots.length >= 2
    ? snapshots.slice(-6).map(s => ({
        value: Math.round(s.total_liabilities),
        label: new Date(s.month + '-01').toLocaleDateString('en-CA', { month: 'short' }),
      }))
    : []

  const savingsData = last6.map(m => ({
    value: Math.round(m.savings),
    label: m.shortLabel,
    dataPointColor: m.savings < 0 ? '#e05252' : '#d97706',
  }))

  const incomeBarData = last6.flatMap(m => [
    { value: Math.round(m.income > 0 ? m.income : monthlyIncome), frontColor: '#3db870', label: m.shortLabel, spacing: 3, roundedTop: true },
    { value: Math.round(m.expenses), frontColor: '#e05252', spacing: 18, roundedTop: true },
  ])

  const incomeLineData = last6.map(m => ({
    value: Math.round(m.income > 0 ? m.income : monthlyIncome),
    label: m.shortLabel,
  }))
  const expenseLineData = last6.map(m => ({
    value: Math.round(m.expenses),
    label: m.shortLabel,
  }))

  function buildInsight(): string {
    if (!currentMonthData) return ''
    const saved = Math.round(netAmount)
    if (prevNet !== null) {
      const diff = saved - Math.round(prevNet)
      if (saved >= 0) {
        return diff >= 0
          ? `You saved $${saved.toLocaleString('en-CA')} this month — $${Math.abs(diff).toLocaleString('en-CA')} more than last month.`
          : `You saved $${saved.toLocaleString('en-CA')} this month — $${Math.abs(diff).toLocaleString('en-CA')} less than last month.`
      }
      return `You overspent by $${Math.abs(saved).toLocaleString('en-CA')} this month. Try reducing variable expenses next month.`
    }
    return saved >= 0
      ? `You saved $${saved.toLocaleString('en-CA')} this month. Keep it up!`
      : `You overspent by $${Math.abs(saved).toLocaleString('en-CA')} this month.`
  }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your reports...</Text>
      </View>
    )
  }

  if (subscriptionTier === 'free') {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeCardTitle}>Detailed reports and spending insights.</Text>
          <Text style={styles.upgradeCardBody}>Available on Zerobased Pro.</Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={() => router.push('/upgrade')}>
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Reports</Text>

      {/* Month chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipsRow}>
          {monthSummaries.map(m => (
            <TouchableOpacity
              key={m.month}
              style={[styles.chip, selectedMonth === m.month && styles.chipActive]}
              onPress={() => setSelectedMonth(m.month)}
            >
              <Text style={[styles.chipText, selectedMonth === m.month && styles.chipTextActive]}>
                {m.shortLabel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {monthSummaries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>Add transactions to see your reports</Text>
        </View>
      ) : (
        <>
          {/* Net card */}
          <View style={[styles.netCard, { borderColor: netAmount >= 0 ? '#b6dfc0' : '#f5c6c6' }]}>
            <Text style={styles.netLabel}>Net this month</Text>
            <Text style={[styles.netAmount, { color: netAmount >= 0 ? '#1f7a45' : '#e05252' }]}>
              {netAmount >= 0 ? '+' : ''}${Math.abs(netAmount).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.netSub}>
              Income ${monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })} · Expenses ${(currentMonthData?.expenses ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
            </Text>
            {prevNet !== null && (
              <View style={[styles.netBadge, { backgroundColor: netAmount >= prevNet ? 'rgba(61,184,112,0.12)' : 'rgba(224,82,82,0.1)' }]}>
                <Text style={[styles.netBadgeText, { color: netAmount >= prevNet ? '#1f7a45' : '#e05252' }]}>
                  {netAmount >= prevNet ? '↑' : '↓'} vs last month
                </Text>
              </View>
            )}
          </View>

          {/* 4 metric cards */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Income</Text>
              <Text style={[styles.metricValue, { color: '#1f7a45' }]}>
                ${monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Spent</Text>
              <Text style={[styles.metricValue, { color: '#e05252' }]}>
                ${(currentMonthData?.expenses ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Net worth</Text>
              <Text style={[styles.metricValue, { color: '#7c5cbf' }]}>
                ${currentNetWorth.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Saved</Text>
              <Text style={[styles.metricValue, { color: '#d97706' }]}>
                ${Math.max(0, netAmount).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          </View>

          {/* Assets vs Liabilities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Assets vs Liabilities</Text>
              <Text style={[styles.sectionMeta, { color: currentNetWorth >= 0 ? '#1f7a45' : '#e05252' }]}>
                Net {currentNetWorth >= 0 ? '+' : ''}${currentNetWorth.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={styles.chartCard}>
              <View style={styles.avlRow}>
                <View style={styles.avlItem}>
                  <Text style={styles.avlLabel}>Total Assets</Text>
                  <Text style={[styles.avlValue, { color: '#1f7a45' }]}>
                    ${(currentNetWorth + currentLiabilities).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
                <View style={styles.avlDivider} />
                <View style={styles.avlItem}>
                  <Text style={styles.avlLabel}>Total Liabilities</Text>
                  <Text style={[styles.avlValue, { color: '#e05252' }]}>
                    ${currentLiabilities.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>
              {(currentNetWorth + currentLiabilities) > 0 && (
                <View style={{ marginTop: 14 }}>
                  <View style={styles.avlBarTrack}>
                    <View style={[styles.avlBarAsset, {
                      width: `${Math.min(((currentNetWorth + currentLiabilities) / (currentNetWorth + currentLiabilities + currentLiabilities)) * 100, 100)}%` as any
                    }]} />
                    <View style={[styles.avlBarLiability, {
                      width: `${Math.min((currentLiabilities / (currentNetWorth + currentLiabilities + currentLiabilities)) * 100, 100)}%` as any
                    }]} />
                  </View>
                  <View style={styles.avlBarLabels}>
                    <Text style={styles.avlBarLabel}>
                      {Math.round(((currentNetWorth + currentLiabilities) / (currentNetWorth + currentLiabilities + currentLiabilities)) * 100)}% assets
                    </Text>
                    <Text style={styles.avlBarLabel}>
                      {Math.round((currentLiabilities / (currentNetWorth + currentLiabilities + currentLiabilities)) * 100)}% liabilities
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Net worth trend */}
          {nwChartData.length >= 2 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Net worth trend</Text>
                <Text style={styles.sectionMeta}>{nwChartData.length} months</Text>
              </View>
              <View style={styles.chartCard}>
                <LineChart
                  data={nwChartData}
                  width={CHART_WIDTH}
                  height={120}
                  color="#5b9cf6"
                  thickness={2.5}
                  curved
                  areaChart
                  startFillColor="rgba(91,156,246,0.2)"
                  endFillColor="rgba(91,156,246,0)"
                  hideDataPoints={false}
                  dataPointsColor="#5b9cf6"
                  dataPointsRadius={3}
                  xAxisLabelTextStyle={labelStyle}
                  yAxisTextStyle={labelStyle}
                  yAxisColor="transparent"
                  xAxisColor="rgba(0,0,0,0.06)"
                  rulesColor="rgba(0,0,0,0.04)"
                  noOfSections={3}
                  formatYLabel={(v) => '$' + Math.round(Number(v) / 1000) + 'K'}
                  backgroundColor="transparent"
                  initialSpacing={20}
                  endSpacing={20}
                />
              </View>
            </View>
          )}

          {/* Income vs expenses */}
          {last6.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Income vs expenses</Text>
                <View style={styles.togglePill}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, ivMode === 'bar' && styles.toggleBtnActive]}
                    onPress={() => setIvMode('bar')}
                  >
                    <Text style={[styles.toggleBtnText, ivMode === 'bar' && styles.toggleBtnTextActive]}>Bar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, ivMode === 'line' && styles.toggleBtnActive]}
                    onPress={() => setIvMode('line')}
                  >
                    <Text style={[styles.toggleBtnText, ivMode === 'line' && styles.toggleBtnTextActive]}>Line</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.chartCard}>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#3db870' }]} />
                    <Text style={styles.legendText}>Income</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#e05252' }]} />
                    <Text style={styles.legendText}>Expenses</Text>
                  </View>
                </View>
                {ivMode === 'bar' ? (
                  <BarChart
                    data={incomeBarData}
                    width={CHART_WIDTH}
                    height={140}
                    barWidth={14}
                    xAxisLabelTextStyle={labelStyle}
                    yAxisTextStyle={labelStyle}
                    yAxisColor="transparent"
                    xAxisColor="rgba(0,0,0,0.06)"
                    rulesColor="rgba(0,0,0,0.04)"
                    noOfSections={3}
                    formatYLabel={(v) => '$' + Math.round(Number(v) / 1000) + 'K'}
                    backgroundColor="transparent"
                    initialSpacing={12}
                    endSpacing={12}
                  />
                ) : (
                  <LineChart
                    data={incomeLineData}
                    data2={expenseLineData}
                    width={CHART_WIDTH}
                    height={140}
                    color1="#3db870"
                    color2="#e05252"
                    thickness={2.5}
                    curved
                    hideDataPoints={false}
                    dataPointsColor1="#3db870"
                    dataPointsColor2="#e05252"
                    dataPointsRadius={3}
                    xAxisLabelTextStyle={labelStyle}
                    yAxisTextStyle={labelStyle}
                    yAxisColor="transparent"
                    xAxisColor="rgba(0,0,0,0.06)"
                    rulesColor="rgba(0,0,0,0.04)"
                    noOfSections={3}
                    formatYLabel={(v) => '$' + Math.round(Number(v) / 1000) + 'K'}
                    backgroundColor="transparent"
                    initialSpacing={20}
                    endSpacing={20}
                  />
                )}
              </View>
            </View>
          )}

          {/* Savings trend */}
          {savingsData.length >= 2 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Savings trend</Text>
                <Text style={styles.sectionMeta}>{savingsData.length} months</Text>
              </View>
              <View style={styles.chartCard}>
                <LineChart
                  data={savingsData}
                  width={CHART_WIDTH}
                  height={110}
                  color="#d97706"
                  thickness={2.5}
                  curved
                  areaChart
                  startFillColor="rgba(217,119,6,0.15)"
                  endFillColor="rgba(217,119,6,0)"
                  hideDataPoints={false}
                  dataPointsRadius={3}
                  xAxisLabelTextStyle={labelStyle}
                  yAxisTextStyle={labelStyle}
                  yAxisColor="transparent"
                  xAxisColor="rgba(0,0,0,0.06)"
                  rulesColor="rgba(0,0,0,0.04)"
                  noOfSections={3}
                  formatYLabel={(v) => (Number(v) < 0 ? '-$' : '$') + Math.abs(Math.round(Number(v) / 1000)) + 'K'}
                  backgroundColor="transparent"
                  initialSpacing={20}
                  endSpacing={20}
                />
              </View>
            </View>
          )}

          {/* Category breakdown */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Category breakdown</Text>
                <Text style={styles.sectionMeta}>{currentMonthData?.label}</Text>
              </View>
              <View style={styles.chartCard}>
                {categories.map((cat, i) => {
                  const pct = cat.budgeted > 0 ? Math.min((cat.spent / cat.budgeted) * 100, 100) : 0
                  const isOver = cat.spent > cat.budgeted
                  const isWarning = cat.spent >= cat.budgeted * 0.8 && !isOver
                  const barColor = isOver ? '#e05252' : isWarning ? '#d97706' : '#3db870'
                  return (
                    <View key={i} style={[styles.catRow, i < categories.length - 1 && { marginBottom: 14 }]}>
                      <View style={styles.catMeta}>
                        <Text style={styles.catName}>{cat.icon} {cat.label}</Text>
                        <Text style={styles.catPct}>
                          ${cat.spent.toLocaleString('en-CA', { maximumFractionDigits: 0 })} / ${cat.budgeted.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* Debt trend */}
          {debtChartData.length >= 2 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Debt trend</Text>
                <Text style={styles.sectionMeta}>{debtChartData.length} months</Text>
              </View>
              <View style={styles.chartCard}>
                <LineChart
                  data={debtChartData}
                  width={CHART_WIDTH}
                  height={110}
                  color="#e05252"
                  thickness={2.5}
                  curved
                  areaChart
                  startFillColor="rgba(224,82,82,0.12)"
                  endFillColor="rgba(224,82,82,0)"
                  hideDataPoints={false}
                  dataPointsColor="#e05252"
                  dataPointsRadius={3}
                  xAxisLabelTextStyle={labelStyle}
                  yAxisTextStyle={labelStyle}
                  yAxisColor="transparent"
                  xAxisColor="rgba(0,0,0,0.06)"
                  rulesColor="rgba(0,0,0,0.04)"
                  noOfSections={3}
                  formatYLabel={(v) => '$' + Math.round(Number(v) / 1000) + 'K'}
                  backgroundColor="transparent"
                  initialSpacing={20}
                  endSpacing={20}
                />
              </View>
            </View>
          )}

          {/* Goals */}
          {goals.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Goals</Text>
                <Text style={styles.sectionMeta}>{goals.length} active</Text>
              </View>
              <View style={styles.goalsCard}>
                {goals.map((goal, i) => {
                  const isPrimary = goal === primaryGoal
                  return (
                    <View key={i} style={[styles.goalRow, i < goals.length - 1 && styles.goalRowBorder]}>
                      <View style={[styles.goalIcon, { backgroundColor: isPrimary ? '#edf7f1' : '#f5f7f5' }]}>
                        <Text style={{ fontSize: 18 }}>{getGoalIcon(goal)}</Text>
                      </View>
                      <View style={styles.goalText}>
                        <View style={styles.goalNameRow}>
                          <Text style={styles.goalName}>{goal}</Text>
                          {isPrimary && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>Primary</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.goalSub}>
                          {isPrimary ? 'Your main financial goal' : 'Working toward this'}
                        </Text>
                      </View>
                      <Text style={[styles.goalArrow, { color: isPrimary ? '#3db870' : '#c0c8c0' }]}>›</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* Insight */}
          <View style={styles.insightCard}>
            <Text style={styles.insightIcon}>✦</Text>
            <Text style={styles.insightText}>{buildInsight()}</Text>
          </View>

          {/* Monthly history */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>Monthly history</Text>
            <View style={styles.historyList}>
              {monthSummaries.map((m, i) => {
                const mNet = (m.income > 0 ? m.income : monthlyIncome) - m.expenses
                return (
                  <TouchableOpacity
                    key={m.month}
                    style={[styles.historyRow, i < monthSummaries.length - 1 && styles.historyRowBorder]}
                    onPress={() => setSelectedMonth(m.month)}
                  >
                    <View>
                      <Text style={styles.historyMonth}>{m.label}</Text>
                      <Text style={styles.historyDetail}>
                        ${(m.income > 0 ? m.income : monthlyIncome).toLocaleString('en-CA', { maximumFractionDigits: 0 })} in · ${m.expenses.toLocaleString('en-CA', { maximumFractionDigits: 0 })} out
                      </Text>
                    </View>
                    <Text style={[styles.historyNet, { color: mNet >= 0 ? '#1f7a45' : '#e05252' }]}>
                      {mNet >= 0 ? '+' : ''}${mNet.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: Colors.textSecondary, fontSize: 16 },
  container: { flex: 1, backgroundColor: '#f2f4f2' },
  content: { paddingHorizontal: 24, paddingVertical: 60, maxWidth: 600, alignSelf: 'center', width: '100%', gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.text },
  chipsRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: '#ffffff' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },
  netCard: { backgroundColor: '#edf7f1', borderWidth: 1.5, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6 },
  netLabel: { fontSize: 12, color: '#1f7a45', fontWeight: '600', letterSpacing: 0.3 },
  netAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5 },
  netSub: { fontSize: 12, color: Colors.textSecondary },
  netBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 2 },
  netBadgeText: { fontSize: 12, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 14, padding: 14 },
  metricLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },
  metricValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionMeta: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  chartCard: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e3e8e3', padding: 14, overflow: 'hidden' },
  togglePill: { flexDirection: 'row', backgroundColor: '#f0f4f0', borderRadius: 10, padding: 2, borderWidth: 1, borderColor: '#e3e8e3' },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#ffffff' },
  toggleBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  toggleBtnTextActive: { color: '#1f7a45', fontWeight: '700' },
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
  catRow: {},
  catMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  catPct: { fontSize: 11, color: Colors.textSecondary },
  barTrack: { height: 7, backgroundColor: '#f0f4f0', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#e3e8e3' },
  barFill: { height: '100%', borderRadius: 4 },
  goalsCard: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  goalRowBorder: { borderBottomWidth: 1, borderBottomColor: '#e3e8e3' },
  goalIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalText: { flex: 1 },
  goalNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  goalName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  primaryBadge: { backgroundColor: 'rgba(61,184,112,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  primaryBadgeText: { fontSize: 10, fontWeight: '700', color: '#1f7a45' },
  goalSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  goalArrow: { fontSize: 20, fontWeight: '600' },
  insightCard: { backgroundColor: '#edf7f1', borderWidth: 1.5, borderColor: '#b6dfc0', borderRadius: 14, padding: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  insightIcon: { fontSize: 18, color: '#3db870' },
  insightText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 21 },
  historyList: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: '#e3e8e3' },
  historyMonth: { fontSize: 13, fontWeight: '600', color: Colors.text },
  historyDetail: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  historyNet: { fontSize: 14, fontWeight: '700' },
  emptyCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 16, padding: 32, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary },

  avlRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avlItem: { flex: 1, alignItems: 'center', gap: 4 },
  avlDivider: { width: 1, height: 40, backgroundColor: '#e3e8e3' },
  avlLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  avlValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  avlBarTrack: { height: 10, borderRadius: 5, backgroundColor: '#f0f4f0', flexDirection: 'row', overflow: 'hidden' },
  avlBarAsset: { height: '100%', backgroundColor: '#3db870', borderRadius: 5 },
  avlBarLiability: { height: '100%', backgroundColor: '#e05252', borderRadius: 5 },
  avlBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  avlBarLabel: { fontSize: 10, color: Colors.textSecondary },
  lockedContainer: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center', padding: 24 },
  upgradeCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, width: '100%', maxWidth: 400 },
  upgradeCardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  upgradeCardBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  upgradeButton: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, marginTop: 8 },
  upgradeButtonText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
})