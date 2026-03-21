import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'

const DEMO_DATA = {
  name: 'Deke',
  monthlyIncome: 9533.33,
  totalBudgeted: 4900.00,
  totalSpent: 2340.00,
  netWorth: 142500.00,
  netWorthChange: 1250.00,
  categories: [
    { label: 'Mortgage', icon: '🏦', budgeted: 2600, spent: 2600, color: Colors.success },
    { label: 'Groceries', icon: '🛒', budgeted: 1300, spent: 843, color: Colors.success },
    { label: 'Fuel', icon: '⛽', budgeted: 1000, spent: 620, color: Colors.warning },
    { label: 'Utilities', icon: '💡', budgeted: 150, spent: 0, color: Colors.textSecondary },
    { label: 'Internet', icon: '📶', budgeted: 80, spent: 80, color: Colors.success },
    { label: 'Phone', icon: '📱', budgeted: 60, spent: 60, color: Colors.success },
  ]
}

export default function DashboardScreen() {
  const remaining = DEMO_DATA.monthlyIncome - DEMO_DATA.totalBudgeted
  const spentPercent = Math.min((DEMO_DATA.totalSpent / DEMO_DATA.totalBudgeted) * 100, 100)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning, {DEMO_DATA.name} 👋</Text>
          <Text style={styles.subGreeting}>Here's your budget this month</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Net worth</Text>
        <Text style={styles.netWorthAmount}>${DEMO_DATA.netWorth.toLocaleString()}</Text>
        <Text style={styles.netWorthChange}>
          ↑ ${DEMO_DATA.netWorthChange.toLocaleString()} this month
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly income</Text>
          <Text style={styles.statValue}>${DEMO_DATA.monthlyIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Unassigned</Text>
          <Text style={[styles.statValue, { color: remaining > 0 ? Colors.warning : Colors.success }]}>
            ${remaining.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
          </Text>
        </View>
      </View>

      <View style={styles.spendingCard}>
        <View style={styles.spendingHeader}>
          <Text style={styles.sectionTitle}>Monthly spending</Text>
          <Text style={styles.spendingAmount}>
            ${DEMO_DATA.totalSpent.toLocaleString()} / ${DEMO_DATA.totalBudgeted.toLocaleString()}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${spentPercent}%` as any }]} />
        </View>
        <Text style={styles.spendingSubtext}>{spentPercent.toFixed(0)}% of budget used</Text>
      </View>

      <Text style={styles.sectionTitle}>Budget categories</Text>
      <View style={styles.categoryList}>
        {DEMO_DATA.categories.map((cat, index) => {
          const catPercent = Math.min((cat.spent / cat.budgeted) * 100, 100)
          const catRemaining = cat.budgeted - cat.spent
          return (
            <TouchableOpacity key={index} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryLeft}>
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categorySpent}>${cat.spent.toLocaleString()}</Text>
                  <Text style={styles.categoryBudgeted}> / ${cat.budgeted.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.categoryProgressBar}>
                <View style={[
                  styles.categoryProgressFill,
                  { width: `${catPercent}%` as any, backgroundColor: cat.color }
                ]} />
              </View>
              <Text style={styles.categoryRemaining}>
                ${catRemaining.toLocaleString()} remaining
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

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
  netWorthChange: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
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
  spendingCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  spendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spendingAmount: {
    fontSize: 14,
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
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  spendingSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
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
  categorySpent: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
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
    borderRadius: 3,
  },
  categoryRemaining: {
    fontSize: 12,
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
})