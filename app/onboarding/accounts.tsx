import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setAccounts as saveAccountsToStore } from '../../lib/store'


const ACCOUNT_TYPES = [
  { id: 'chequing', label: 'Chequing', icon: '💳' },
  { id: 'savings', label: 'Savings', icon: '🏦' },
  { id: 'rrsp', label: 'RRSP', icon: '📈' },
  { id: 'tfsa', label: 'TFSA', icon: '🛡️' },
  { id: 'fhsa', label: 'FHSA', icon: '🏡' },
  { id: 'resp', label: 'RESP', icon: '🎓' },
  { id: 'pension', label: 'Pension', icon: '👴' },
  { id: 'home', label: 'Home value', icon: '🏡' },
  { id: 'vehicle', label: 'Vehicle value', icon: '🚗' },
  { id: 'other', label: 'Other asset', icon: '➕' },
  { id: 'mortgage', label: 'Mortgage', icon: '🏦' },
  { id: 'heloc', label: 'HELOC', icon: '🏦' },
  { id: 'loc', label: 'Line of credit', icon: '💸' },
  { id: 'carloan', label: 'Car loan', icon: '🚗' },
  { id: 'studentloan', label: 'Student loan', icon: '🎓' },
  { id: 'creditcard', label: 'Credit card', icon: '💳' },
  { id: 'other_liability', label: 'Other liability', icon: '📋' },
]

type Account = {
  type: string
  label: string
  icon: string
  balance: string
}

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = getOnboardingData().accounts
    return saved.length > 0 ? saved : [{ type: 'chequing', label: 'Chequing', icon: '💳', balance: '' }]
  })

  function addAccount(type: string, label: string) {
    setAccounts([...accounts, { type, label, icon: '', balance: '' }])
  }

  function removeAccount(index: number) {
    setAccounts(accounts.filter((_, i) => i !== index))
  }

  function updateBalance(index: number, balance: string) {
    const updated = [...accounts]
    updated[index].balance = balance
    setAccounts(updated)
  }

  function handleContinue() {
    console.log('Saving accounts:', JSON.stringify(accounts))
    saveAccountsToStore(accounts)
    router.push('/onboarding/income')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.step}>Step 2 of 5</Text>
      <Text style={styles.title}>Your accounts</Text>
      <Text style={styles.subtitle}>Add your accounts and current balances</Text>

      <View style={styles.accountList}>
        {accounts.map((account, index) => (
          <View key={index} style={styles.accountRow}>
            <View style={styles.accountInfo}>
              <Text style={styles.accountIcon}>
                {ACCOUNT_TYPES.find(t => t.id === account.type)?.icon}
              </Text>
                <TextInput
                style={styles.accountLabel}
                value={account.label}
                onChangeText={(val) => {
                    const updated = [...accounts]
                    updated[index].label = val
                    setAccounts(updated)
                }}
                placeholderTextColor={Colors.textSecondary}
                selectTextOnFocus
                />
            </View>
            <View style={styles.accountRight}>
              <CurrencyInput
                style={styles.balanceInput}
                placeholder="$0.00"
                value={account.balance}
                onChangeText={(val) => updateBalance(index, val)}
                // @ts-ignore
                tabIndex={index + 1}
              />
              {accounts.length > 1 && (
                <TouchableOpacity onPress={() => removeAccount(index)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.addLabel}>Add an account</Text>
      <View style={styles.typeGrid}>
        {ACCOUNT_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={styles.typeChip}
            onPress={() => addAccount(type.id, type.label)}
          >
            <Text style={styles.typeChipIcon}>{type.icon}</Text>
            <Text style={styles.typeChipLabel}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 60,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
backButton: {
    marginBottom: 24,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },

  step: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  accountList: {
    gap: 12,
    marginBottom: 32,
  },
  accountRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountIcon: {
    fontSize: 20,
  },
  accountLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    width: 100,
    textAlign: 'right',
  },
  removeBtn: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  addLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 40,
  },
  typeChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
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
})