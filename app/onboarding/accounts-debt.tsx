import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import KeyboardScrollView from '../../components/KeyboardScrollView'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setAccounts } from '../../lib/store'

const DEBT_ACCOUNTS = [
  { id: 'mortgage', label: 'Mortgage', icon: '🏠', multi: true },
  { id: 'heloc', label: 'HELOC', icon: '🏦', multi: true },
  { id: 'line_of_credit', label: 'Line of Credit', icon: '💳', multi: true },
  { id: 'credit_card', label: 'Credit card', icon: '💳', multi: true },
  { id: 'car_loan', label: 'Car loan', icon: '🚗', multi: true },
  { id: 'student_loan', label: 'Student loan', icon: '🎓', multi: true },
  { id: 'personal_loan', label: 'Personal loan', icon: '📋', multi: true },
  { id: 'other_liability', label: 'Other', icon: '➕', multi: true },
]

type Account = {
  type: string
  label: string
  icon: string
  balance: string
}

export default function AccountsDebtScreen() {
  const existing = getOnboardingData().accounts.filter(a =>
    DEBT_ACCOUNTS.some(e => a.type === e.id || a.type.startsWith(e.id + '_'))
  )

  const [accounts, setLocalAccounts] = useState<Account[]>(existing)
  
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
    const nonDebtAccounts = existing.filter(a => {
      return !DEBT_ACCOUNTS.some(d => a.type === d.id || a.type.startsWith(d.id + '_'))
    })
    setAccounts([...nonDebtAccounts, ...accounts])
    router.replace('/onboarding/accounts-investment')
  }

  return (
    <KeyboardScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '33%' }]} />
        </View>
        <Text style={styles.progressLabel}>Step 3 of 9</Text>
      </View>
      <Text style={styles.title}>What do you currently owe?</Text>
      <Text style={styles.subtitle}>
        Include mortgages, credit cards, and loans — knowing your debts is the first step to crushing them.
      </Text>

      <View style={styles.chipRow}>
        {DEBT_ACCOUNTS.map(acc => (
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
              />
              <TouchableOpacity onPress={() => setLocalAccounts(accounts.filter(a => a.type !== account.type))}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
              <CurrencyInput
                style={styles.balanceInput}
                placeholder="Outstanding balance"
                value={account.balance}
                onChangeText={(val) => updateBalance(account.type, val)}
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Enter the outstanding balance — what you still owe. This is shown as a liability in your net worth calculation.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleContinue} style={styles.skipButton}>
        <Text style={styles.skipText}>I have no debt accounts</Text>
      </TouchableOpacity>
    </KeyboardScrollView>
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