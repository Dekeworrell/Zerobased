import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { toMonthly } from '../lib/store'
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

type Account = {
  id: string
  label: string
  type: string
}

type Props = {
  visible: boolean
  incomeSources: IncomeSource[]
  accounts: Account[]
  defaultAccountId: string | null
  onComplete: () => void
}

const PARTICLES = ['💸', '✨', '🎉', '💵']
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const PARTICLE_X = [0.22, 0.38, 0.55, 0.72].map(p => SCREEN_W * p)

export default function PaydayModal({ visible, incomeSources, accounts, defaultAccountId, onComplete }: Props) {
  const variableSources = incomeSources.filter(s => s.income_type === 'variable')
  const fixedSources = incomeSources.filter(s => s.income_type === 'fixed')

  const [variableAmounts, setVariableAmounts] = useState<{ [id: string]: string }>({})
  const [step, setStep] = useState<'payday' | 'shortfall' | 'extra'>('payday')
  const [shortfallAmount, setShortfallAmount] = useState(0)
  const [extraAmount, setExtraAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmedActual, setConfirmedActual] = useState(0)
  const [confirmedBudgeted, setConfirmedBudgeted] = useState(0)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(defaultAccountId)
  const [makeDefault, setMakeDefault] = useState(false)

  const emojiScale = useRef(new Animated.Value(0.1)).current
  const particleAnims = useRef(
    PARTICLES.map(() => ({ y: new Animated.Value(0), opacity: new Animated.Value(0) }))
  ).current

  useEffect(() => {
    if (!visible) return
    setStep('payday')
    setVariableAmounts({})
    setError('')
    setSelectedAccountId(defaultAccountId)
    setMakeDefault(false)

    emojiScale.setValue(0.1)
    Animated.spring(emojiScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }).start()

    particleAnims.forEach((anim, i) => {
      anim.y.setValue(0)
      anim.opacity.setValue(0)
      Animated.sequence([
        Animated.delay(i * 100),
        Animated.parallel([
          Animated.timing(anim.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(anim.y, { toValue: -(100 + i * 25), duration: 1100, useNativeDriver: true }),
        ]),
        Animated.timing(anim.opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start()
    })
  }, [visible])

  const today = new Date()
  const dateStr = new Date(today.getTime() - today.getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0]

  async function handleConfirm() {
    if (!selectedAccountId) {
      setError('Please select an account to deposit your pay into.')
      return
    }
    setSaving(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      let totalBudgeted = 0
      let totalActual = 0
      let balanceDelta = 0

      const { data: cats } = await supabase
        .from('budget_categories').select('budgeted_amount, frequency').eq('user_id', user.id)
      if (cats) cats.forEach((c: any) => { totalBudgeted += toMonthly(c.budgeted_amount, c.frequency) / 2 })

      for (const source of fixedSources) {
        await supabase.from('transactions').insert({
          user_id: user.id, label: source.label, amount: source.amount,
          date: dateStr, type: 'income', is_unexpected: false, category_id: null,
        })
        totalActual += source.amount
        balanceDelta += source.amount
      }

      for (const source of variableSources) {
        const actualAmount = parseFloat(variableAmounts[source.id] || '0') || 0
        if (actualAmount > 0) {
          await supabase.from('transactions').insert({
            user_id: user.id, label: source.label, amount: actualAmount,
            date: dateStr, type: 'income', is_unexpected: false, category_id: null,
          })
          totalActual += actualAmount
          balanceDelta += actualAmount
        }
      }

      if (balanceDelta > 0) {
        const { data: acc } = await supabase.from('accounts').select('balance').eq('id', selectedAccountId).single()
        if (acc) {
          await supabase.from('accounts')
            .update({ balance: (parseFloat(acc.balance) || 0) + balanceDelta })
            .eq('id', selectedAccountId)
        }
      }

      if (makeDefault) {
        await supabase.from('profiles').update({ default_account_id: selectedAccountId }).eq('id', user.id)
      }

      await supabase.from('profiles').update({ last_payday_check: dateStr }).eq('id', user.id)

      for (const source of incomeSources) {
        if (!source.next_payday) continue
        let periodDays = 14
        if (source.frequency === 'weekly') periodDays = 7
        if (source.frequency === 'monthly') periodDays = 30
        if (source.frequency === 'semimonthly') periodDays = 15
        const current = new Date(source.next_payday.split('|')[0] + 'T12:00:00')
        const todayMid = new Date()
        todayMid.setHours(12, 0, 0, 0)
        while (current <= todayMid) current.setDate(current.getDate() + periodDays)
        await supabase.from('income_sources').update({ next_payday: current.toISOString().split('T')[0] }).eq('id', source.id)
      }

      await new Promise(resolve => setTimeout(resolve, 300))

      setConfirmedActual(totalActual)
      setConfirmedBudgeted(totalBudgeted)
      const diff = totalActual - totalBudgeted
      if (diff < -1) { setShortfallAmount(Math.abs(diff)); setStep('shortfall') }
      else if (diff > 1) { setExtraAmount(diff); setStep('extra') }
      else onComplete()

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
              onPress={() => {
                onComplete()
                setTimeout(() => router.push({
                  pathname: '/budget-adjust',
                  params: { actualPay: confirmedActual.toString(), expectedPay: confirmedBudgeted.toString(), periodStart: dateStr, periodEnd: dateStr },
                }), 300)
              }}
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
            <Text style={styles.title}>Extra ${extraAmount.toLocaleString('en-CA', { maximumFractionDigits: 0 })} this cycle!</Text>
            <Text style={styles.body}>
              Nice! You earned more than expected. Consider paying down high-interest debt first, then put the rest toward your goals.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                onComplete()
                setTimeout(() => router.push({
                  pathname: '/budget-adjust',
                  params: { actualPay: confirmedActual.toString(), expectedPay: confirmedBudgeted.toString(), periodStart: dateStr, periodEnd: dateStr },
                }), 300)
              }}
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

  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        {/* Celebratory particles floating up behind the modal */}
        {particleAnims.map((anim, i) => (
          <Animated.Text
            key={i}
            style={[styles.particle, {
              left: PARTICLE_X[i],
              top: SCREEN_H * 0.38,
              opacity: anim.opacity,
              transform: [{ translateY: anim.y }],
            }]}
          >
            {PARTICLES[i]}
          </Animated.Text>
        ))}

        <View style={styles.modal}>
          <Animated.Text style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}>
            💰
          </Animated.Text>
          <Text style={styles.title}>It's Payday! 🎉</Text>
          <Text style={styles.subtitle}>How much did you get paid?</Text>

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
              <Text style={styles.fieldLabel}>{source.label} — actual amount</Text>
              <CurrencyInput
                style={styles.input}
                placeholder={`Expected $${source.amount.toLocaleString('en-CA', { maximumFractionDigits: 2 })}`}
                value={variableAmounts[source.id] || ''}
                onChangeText={(val) => setVariableAmounts(prev => ({ ...prev, [source.id]: val }))}
              />
            </View>
          ))}

          <Text style={styles.fieldLabel}>Deposit to account</Text>
          <View style={styles.accountList}>
            {accounts.map(acc => (
              <TouchableOpacity
                key={acc.id}
                style={[styles.accountRow, selectedAccountId === acc.id && styles.accountRowActive]}
                onPress={() => setSelectedAccountId(acc.id)}
              >
                <Text style={[styles.accountRowText, selectedAccountId === acc.id && styles.accountRowTextActive]}>
                  🏦 {acc.label}
                </Text>
                {selectedAccountId === acc.id && <Text style={styles.accountRowCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {selectedAccountId && selectedAccountId !== defaultAccountId && (
            <TouchableOpacity style={styles.defaultToggle} onPress={() => setMakeDefault(!makeDefault)}>
              <View style={[styles.checkbox, makeDefault && styles.checkboxActive]}>
                {makeDefault && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.defaultToggleText}>
                Set {selectedAccount?.label} as my default account
              </Text>
            </TouchableOpacity>
          )}

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
  emoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -4,
  },
  body: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  particle: {
    position: 'absolute',
    fontSize: 26,
    zIndex: 10,
  },
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
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
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
  accountList: { gap: 8 },
  accountRow: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountRowActive: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
  },
  accountRowText: { fontSize: 15, color: Colors.text },
  accountRowTextActive: { fontWeight: '600', color: Colors.text },
  accountRowCheck: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxCheck: { fontSize: 12, color: Colors.text, fontWeight: '700' },
  defaultToggleText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
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
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: Colors.textSecondary, fontSize: 15 },
})
