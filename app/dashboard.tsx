import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { toMonthly } from '../lib/store'
import { supabase } from '../lib/supabase'

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }

      setName(user.email?.split('@')[0] || 'there')

      const { data: income } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)

      if (income) {
        const total = income.reduce((sum: number, s: any) => sum + toMonthly(s.amount.toString(), s.frequency), 0)
        setMonthlyIncome(total)
      }

      const { data: cats } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('user_id', user.id)

      if (cats) setCategories(cats)

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

  const totalBudgeted = categories.reduce((sum, c) => sum + toMonthly(c.budgeted_amount.toString(), c.frequency), 0)
  const unassigned = monthlyIncome - totalBudgeted
  const netWorth = accounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0)

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
        <View>
          <Text style={styles.greeting}>{getHour()}, {name} 👋</Text>
          <Text style={styles.subGreeting}>Here's your budget this month</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Net worth</Text>
        <Text style={styles.netWorthAmount}>
          ${netWorth.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={styles.netWorthSub}>Based on your account balances</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly income</Text>
          <Text style={styles.statValue}>
            ${monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Unassigned</Text>
          <Text style={[styles.statValue, { color: unassigned > 0 ? Colors.warning : Colors.success }]}>
            ${Math.abs(unassigned).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
        </View>
      </View>

      {categories.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget categories</Text>
            <TouchableOpacity onPress={() => router.push('/budget')}>
                <Text style={styles.editLink}>Edit budget</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.categoryList}>
            {categories.map((cat) => {
              const monthlyAmount = toMonthly(cat.budgeted_amount.toString(), cat.frequency)
              return (
                <TouchableOpacity key={cat.id} style={styles.categoryCard}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryLeft}>
                      <Text style={styles.categoryIcon}>{cat.icon}</Text>
                      <Text style={styles.categoryLabel}>{cat.label}</Text>
                    </View>
                    <View style={styles.categoryRight}>
                      <Text style={styles.categoryBudgeted}>
                        ${monthlyAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })}/mo
                      </Text>
                    </View>
                  </View>
                  <View style={styles.categoryProgressBar}>
                    <View style={[styles.categoryProgressFill, { width: '0%' as any }]} />
                  </View>
                  <Text style={styles.categoryRemaining}>
                    ${monthlyAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })} remaining
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
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
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>Add transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>View reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>🏦</Text>
            <Text style={styles.actionLabel}>Accounts</Text>
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
  },
  settingsIcon: {
    fontSize: 24,
  },
  netWorthCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  netWorthLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  netWorthAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  netWorthSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textSecondary,
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
})