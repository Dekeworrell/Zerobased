import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setAccounts } from '../../lib/store'

const CA_INVESTMENT_ACCOUNTS = [
  { id: 'rrsp', label: 'RRSP', icon: '📈', multi: true },
  { id: 'tfsa', label: 'TFSA', icon: '🌱', multi: true },
  { id: 'fhsa', label: 'FHSA', icon: '🏠', multi: true },
  { id: 'resp', label: 'RESP', icon: '🎓', multi: true },
  { id: 'pension', label: 'Pension', icon: '👴', multi: true },
  { id: 'margin', label: 'Margin account', icon: '📊', multi: true },
  { id: 'crypto', label: 'Crypto', icon: '🪙', multi: true },
  { id: 'other_investment', label: 'Other', icon: '💹', multi: true },
]

const US_INVESTMENT_ACCOUNTS = [
  { id: '401k', label: '401(k)', icon: '📈', multi: false },
  { id: 'ira', label: 'IRA', icon: '🏦', multi: true },
  { id: 'roth_ira', label: 'Roth IRA', icon: '🌱', multi: true },
  { id: 'hsa', label: 'HSA', icon: '💊', multi: false },
  { id: '529', label: '529 Plan', icon: '🎓', multi: true },
  { id: 'brokerage', label: 'Brokerage', icon: '📊', multi: true },
  { id: 'crypto', label: 'Crypto', icon: '🪙', multi: true },
  { id: 'other_investment', label: 'Other', icon: '💹', multi: true },
]

type Account = {
  type: string
  label: string
  icon: string
  balance: string
}

export default function AccountsInvestmentScreen() {
  const onboardingData = getOnboardingData()
  const INVESTMENT_ACCOUNTS = onboardingData.country === 'US' ? US_INVESTMENT_ACCOUNTS : CA_INVESTMENT_ACCOUNTS
  const isUS = onboardingData.country === 'US'

  const existing = onboardingData.accounts.filter(a =>
    INVESTMENT_ACCOUNTS.some(e => a.type === e.id || a.type.startsWith(e.id + '_'))
  )

  const [accounts, setLocalAccounts] = useState<Account[]>(existing)

  useEffect(() => {
    const existing = getOnboardingData().accounts
    const nonInvestmentAccounts = existing.filter(a =>
      !INVESTMENT_ACCOUNTS.some(d => a.type === d.id || a.type.startsWith(d.id + '_'))
    )
    setAccounts([...nonInvestmentAccounts, ...accounts])
  }, [accounts])
  
  useEffect(() => {
    const existing = getOnboardingData().accounts
    const nonInvestmentAccounts = existing.filter(a =>
      !INVESTMENT_ACCOUNTS.some(d => a.type === d.id || a.type.startsWith(d.id + '_'))
    )
    setAccounts([...nonInvestmentAccounts, ...accounts])
  }, [accounts])

  function toggleAccount(type: string, label: string, icon: string, multi: boolean) {
    const exists = accounts.find(a => a.type === type)
    if (exists && !multi) {
      setLocalAccounts(accounts.filter(a => a.type !== type))
    } else {
      const newId = multi ? `${type}_${Date.now()}` : type
      setLocalAccounts([...accounts, { type: newId, label, icon, balance: '' }])
    }
  }

  function updateBalance(type: string, balance: string) {
    setLocalAccounts(accounts.map(a => a.type === type ? { ...a, balance } : a))
  }

  function handleContinue() {
    const existing = getOnboardingData().accounts
    const allInvestmentAccounts = [...CA_INVESTMENT_ACCOUNTS, ...US_INVESTMENT_ACCOUNTS]
    const otherAccounts = existing.filter(a => {
      const baseType = a.type.split('_')[0]
      return !allInvestmentAccounts.find(e => e.id === a.type) &&
             !allInvestmentAccounts.find(e => e.id === baseType)
    })
    setAccounts([...otherAccounts, ...accounts])
    router.push('/onboarding/assets')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '44%' }]} />
        </View>
        <Text style={styles.progressLabel}>Step 4 of 9</Text>
      </View>
      <Text style={styles.title}>Are you investing for your future?</Text>
      <Text style={styles.subtitle}>
        {isUS
          ? 'Add your 401(k)s, IRAs, and other investment accounts to see your complete net worth.'
          : 'Add your RRSPs, TFSAs, and other investment accounts to see your complete net worth.'
        }
      </Text>

      <View style={styles.chipRow}>
        {INVESTMENT_ACCOUNTS.map(acc => (
          <TouchableOpacity
            key={acc.id}
            style={[styles.chip, !acc.multi && accounts.find(a => a.type === acc.id) && styles.chipActive]}
            onPress={() => toggleAccount(acc.id, acc.label, acc.icon, acc.multi)}
          >
            <Text style={styles.chipIcon}>{acc.icon}</Text>
            <Text style={[styles.chipText, accounts.find(a => a.type === acc.id) && styles.chipTextActive]}>
              {acc.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {accounts.length > 0 && (
        <View style={styles.accountList}>
          {accounts.map(account => (
            <View key={account.type} style={styles.accountCard}>
              <View style={styles.accountHeader}>
              <Text style={styles.accountIcon}>{account.icon}</Text>
              <TextInput
                style={styles.accountLabel}
                value={account.label}
                onChangeText={(val) => setLocalAccounts(accounts.map(a => a.type === account.type ? { ...a, label: val } : a))}
                placeholderTextColor={Colors.textSecondary}
                selectTextOnFocus
              />
              <TouchableOpacity onPress={() => setLocalAccounts(accounts.filter(a => a.type !== account.type))}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
              <CurrencyInput
                style={styles.balanceInput}
                placeholder="Current value"
                value={account.balance}
                onChangeText={(val) => updateBalance(account.type, val)}
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Not sure of the exact value? A rough estimate is fine — you can update it anytime. Even approximate numbers help you see your full financial picture.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleContinue} style={styles.skipButton}>
        <Text style={styles.skipText}>I have no investment accounts</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f2',
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 60,
    maxWidth: 500,
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
  step: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.text,
  },
  accountList: {
    gap: 12,
  },
  accountCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountIcon: {
    fontSize: 22,
  },
  accountLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  balanceInput: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  infoBox: {
    backgroundColor: '#edf7f1',
    borderWidth: 1,
    borderColor: '#b6dfc0',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  deleteBtn: {
    color: Colors.textSecondary,
    fontSize: 16,
    paddingLeft: 8,
  },
  progressWrap: { marginBottom: 20 },
  progressTrack: { height: 3, backgroundColor: '#e3e8e3', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 3, backgroundColor: '#3db870', borderRadius: 2 },
  progressLabel: { fontSize: 11, color: '#3db870', fontWeight: '600' },
})