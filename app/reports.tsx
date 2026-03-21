import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { toMonthly } from '../lib/store'
import { supabase } from '../lib/supabase'

type MonthSummary = {
  month: string
  label: string
  income: number
  expenses: number
  unexpected: number
  net: number
}

type CategorySummary = {
  label: string
  icon: string
  budgeted: number
  spent: number
}

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<MonthSummary[]>([])
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [monthlyIncome, setMonthlyIncome] = useState(0)

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
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

    const { data: txns } = await supabase
      .from('transactions')
      .select(`
        amount, date, type, is_unexpected,
        category:budget_categories(label, icon)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (txns) {
      const monthMap: { [key: string]: MonthSummary } = {}

      txns.forEach((t: any) => {
        const month = t.date.slice(0, 7)
        if (!monthMap[month]) {
          const date = new Date(month + '-01')
          monthMap[month] = {
            month,
            label: date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
            income: 0,
            expenses: 0,
            unexpected: 0,
            net: 0,
          }
        }
        if (t.type === 'income') {
          monthMap[month].income += t.amount
        } else {
          monthMap[month].expenses += t.amount
          if (t.is_unexpected) monthMap[month].unexpected += t.amount
        }
        monthMap[month].net = monthMap[month].income - monthMap[month].expenses
      })

      const sortedMonths = Object.values(monthMap).sort((a, b) =>
        b.month.localeCompare(a.month)
      )
      setMonths(sortedMonths)

      if (sortedMonths.length > 0) {
        setSelectedMonth(sortedMonths[0].month)
      }

      const { data: cats } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('user_id', user.id)

      if (cats) {
        const catSummaries = cats.map((cat: any) => {
          const spent = txns
            .filter((t: any) => t.category?.label === cat.label && t.type === 'expense')
            .reduce((sum: number, t: any) => sum + t.amount, 0)

          return {
            label: cat.label,
            icon: cat.icon,
            budgeted: toMonthly(cat.budgeted_amount.toString(), cat.frequency),
            spent,
          }
        })
        setCategories(catSummaries)
      }
    }

    setLoading(false)
  }

  const currentMonth = months.find(m => m.month === selectedMonth)

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Reports</Text>

      {months.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>Add transactions to see your reports</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.monthRow}>
              {months.map(m => (
                <TouchableOpacity
                  key={m.month}
                  style={[styles.monthChip, selectedMonth === m.month && styles.monthChipActive]}
                  onPress={() => setSelectedMonth(m.month)}
                >
                  <Text style={[styles.monthChipText, selectedMonth === m.month && styles.monthChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {currentMonth && (
            <>
              <View style={[styles.netCard, {
                borderColor: currentMonth.net >= 0 ? Colors.success : Colors.danger
              }]}>
                <Text style={styles.netLabel}>
                  {currentMonth.net >= 0 ? '✅ Net positive' : '⚠️ Net negative'}
                </Text>
                <Text style={[styles.netAmount, {
                  color: currentMonth.net >= 0 ? Colors.success : Colors.danger
                }]}>
                  {currentMonth.net >= 0 ? '+' : ''}
                  ${currentMonth.net.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.netMonth}>{currentMonth.label}</Text>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Budgeted income</Text>
                  <Text style={[styles.summaryValue, { color: Colors.success }]}>
                    ${monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total spent</Text>
                  <Text style={[styles.summaryValue, { color: Colors.danger }]}>
                    ${currentMonth.expenses.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>

              {currentMonth.unexpected > 0 && (
                <View style={styles.unexpectedCard}>
                  <Text style={styles.unexpectedTitle}>⚠️ Unexpected expenses</Text>
                  <Text style={styles.unexpectedAmount}>
                    ${currentMonth.unexpected.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={styles.unexpectedSubtitle}>
                    Consider adding a buffer category to your budget
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>Category breakdown</Text>
              <View style={styles.categoryList}>
                {categories.map((cat, index) => {
                  const percent = cat.budgeted > 0
                    ? Math.min((cat.spent / cat.budgeted) * 100, 100)
                    : 0
                  const isOver = cat.spent > cat.budgeted
                  const isWarning = cat.spent >= cat.budgeted * 0.8

                  return (
                    <View key={index} style={styles.categoryCard}>
                      <View style={styles.categoryHeader}>
                        <View style={styles.categoryLeft}>
                          <Text style={styles.categoryIcon}>{cat.icon}</Text>
                          <Text style={styles.categoryLabel}>{cat.label}</Text>
                        </View>
                        <View style={styles.categoryRight}>
                          <Text style={[styles.categorySpent, {
                            color: isOver ? Colors.danger : Colors.text
                          }]}>
                            ${cat.spent.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                          </Text>
                          <Text style={styles.categoryBudgeted}>
                            {' '}/ ${cat.budgeted.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, {
                          width: `${percent}%` as any,
                          backgroundColor: isOver ? Colors.danger : isWarning ? Colors.warning : Colors.success
                        }]} />
                      </View>
                      <Text style={styles.categoryStatus}>
                        {isOver
                          ? `$${(cat.spent - cat.budgeted).toLocaleString('en-CA', { maximumFractionDigits: 0 })} over budget`
                          : `$${(cat.budgeted - cat.spent).toLocaleString('en-CA', { maximumFractionDigits: 0 })} remaining`
                        }
                      </Text>
                    </View>
                  )
                })}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Monthly history</Text>
          <View style={styles.historyList}>
            {months.map(m => (
              <TouchableOpacity
                key={m.month}
                style={styles.historyRow}
                onPress={() => setSelectedMonth(m.month)}
              >
                <View style={styles.historyLeft}>
                  <Text style={styles.historyMonth}>{m.label}</Text>
                  <Text style={styles.historyExpenses}>
                    ${m.expenses.toLocaleString('en-CA', { maximumFractionDigits: 0 })} spent
                  </Text>
                </View>
                <Text style={[styles.historyNet, {
                  color: m.net >= 0 ? Colors.success : Colors.danger
                }]}>
                  {m.net >= 0 ? '+' : ''}
                  ${m.net.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
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
  monthRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  monthChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  monthChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  monthChipTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  netCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.card,
    gap: 6,
  },
  netLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  netAmount: {
    fontSize: 42,
    fontWeight: 'bold',
  },
  netMonth: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  unexpectedCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  unexpectedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  unexpectedAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.warning,
  },
  unexpectedSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryList: {
    gap: 10,
  },
  categoryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
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
    fontSize: 18,
  },
  categoryLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categorySpent: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryBudgeted: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  historyList: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyLeft: {
    gap: 2,
  },
  historyMonth: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  historyExpenses: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  historyNet: {
    fontSize: 16,
    fontWeight: '600',
  },
})