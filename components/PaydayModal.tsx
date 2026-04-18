import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'
import CurrencyInput from './CurrencyInput'

type IncomeSource = {
  id: string
  label: string
  amount: number
  frequency: string
  income_type: 'fixed' | 'variable'
  next_payday: string
}

type Props = {
  visible: boolean
  incomeSources: IncomeSource[]
  onComplete: () => void
}

export default function PaydayModal({ visible, incomeSources, onComplete }: Props) {
  const variableSources = incomeSources.filter(s => s.income_type === 'variable')
  const fixedSources = incomeSources.filter(s => s.income_type === 'fixed')

  const [variableAmounts, setVariableAmounts] = useState<{ [id: string]: string }>({})
  const [step, setStep] = useState<'payday' | 'shortfall' | 'extra'>('payday')
  const [shortfallAmount, setShortfallAmount] = useState(0)
  const [extraAmount, setExtraAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  const offset = today.getTimezoneOffset()
  const dateStr = new Date(today.getTime() - offset * 60 * 1000).toISOString().split('T')[0]

  async function handleConfirm() {
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let totalBudgeted = 0
      let totalActual = 0

      // Auto-log fixed income sources
      for (const source of fixedSources) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          label: source.label,
          amount: source.amount,
          date: dateStr,
          type: 'income',
          is_unexpected: false,
          category_id: null,
        })

        // Find default account and update balance
        const { data: profile } = await supabase
          .from('profiles').select('default_account_id').eq('id', user.id).single()
        if (profile?.default_account_id) {
          const { data: acc } = await supabase
            .from('accounts').select('balance').eq('id', profile.default_account_id).single()
          if (acc) {
            const newBalance = (parseFloat(acc.balance) || 0) + source.amount
            await supabase.from('accounts').update({ balance: newBalance }).eq('id', profile.default_account_id)
          }
        }

        totalBudgeted += source.amount
        totalActual += source.amount
      }

      // Log variable income with user-entered amounts
      for (const source of variableSources) {
        const actualAmount = parseFloat(variableAmounts[source.id] || '0') || 0
        if (actualAmount > 0) {
          await supabase.from('transactions').insert({
            user_id: user.id,
            label: source.label,
            amount: actualAmount,
            date: dateStr,
            type: 'income',
            is_unexpected: false,
            category_id: null,
          })

          const { data: profile } = await supabase
            .from('profiles').select('default_account_id').eq('id', user.id).single()
          if (profile?.default_account_id) {
            const { data: acc } = await supabase
              .from('accounts').select('balance').eq('id', profile.default_account_id).single()
            if (acc) {
              const newBalance = (parseFloat(acc.balance) || 0) + actualAmount
              await supabase.from('accounts').update({ balance: newBalance }).eq('id', profile.default_account_id)
            }
          }
        }
        totalBudgeted += source.amount
        totalActual += actualAmount
      }

      // Mark payday as checked today
      await supabase.from('profiles').update({ last_payday_check: dateStr }).eq('id', user.id)

      const diff = totalActual - totalBudgeted

      if (diff < -1) {
        setShortfallAmount(Math.abs(diff))
        setStep('shortfall')
      } else if (diff > 1) {
        setExtraAmount(diff)
        setStep('extra')
      } else {
        onComplete()
      }

    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (step === 'shortfall') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.emoji}>📉</Text>
            <Text style={styles.title}>You're ${shortfallAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })} short this cycle</Text>
            <Text style={styles.body}>
              Your take-home was less than expected. We recommend reviewing your budget to find savings — or carry the shortfall and we'll track it in your reports.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { onComplete(); router.push('/budget') }}
            >
              <Text style={styles.primaryBtnText}>Review Budget</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onComplete}>
              <Text style={styles.secondaryBtnText}>Carry the Shortfall</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  if (step === 'extra') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.title}>Extra ${ extraAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })} this cycle!</Text>
            <Text style={styles.body}>
              Nice! You earned more than expected. Consider paying down high-interest debt first, then put the rest toward your goals.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { onComplete(); router.push('/onboarding/assign') }}
            >
              <Text style={styles.primaryBtnText}>Assign It</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onComplete}>
              <Text style={styles.secondaryBtnText}>I'll do it later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.emoji}>💰</Text>
          <Text style={styles.title}>It's payday!</Text>

          {fixedSources.length > 0 && (
            <View style={styles.fixedList}>
              {fixedSources.map(source => (
                <View key={source.id} style={styles.fixedRow}>
                  <View style={styles.fixedRowLeft}>
                    <Text style={styles.fixedLabel}>{source.label}</Text>
                    <Text style={styles.fixedAmount}>
                      ${source.amount.toLocaleString('en-CA', { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.autoTag}>
                    <Text style={styles.autoTagText}>Auto-logged ✓</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {variableSources.map(source => (
            <View key={source.id} style={{ marginBottom: 12 }}>
              <Text style={styles.fieldLabel}>{source.label} — how much did you get paid?</Text>
              <CurrencyInput
                style={styles.input}
                placeholder={`Expected $${source.amount.toLocaleString('en-CA', { maximumFractionDigits: 2 })}`}
                value={variableAmounts[source.id] || ''}
                onChangeText={(val) => setVariableAmounts(prev => ({ ...prev, [source.id]: val }))}
              />
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.disabled]}
            onPress={handleConfirm}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.text} />
              : <Text style={styles.primaryBtnText}>Confirm & Log Paycheque</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: Colors.background,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 480,
    gap: 12,
  },
  emoji: { fontSize: 36, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  fixedList: { gap: 8 },
  fixedRow: {
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fixedRowLeft: { gap: 2 },
  fixedLabel: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  fixedAmount: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  autoTag: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  autoTagText: { fontSize: 11, color: Colors.text, fontWeight: '600' },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: Colors.text,
  },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.4 },
  primaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.textSecondary, fontSize: 15 },
})