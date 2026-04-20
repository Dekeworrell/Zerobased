import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { supabase } from '../../lib/supabase'

const GOALS = [
  { id: 'emergency_fund', label: 'Build an emergency fund', icon: '🆘' },
  { id: 'pay_debt', label: 'Pay off debt', icon: '💳' },
  { id: 'buy_home', label: 'Buy a home', icon: '🏠' },
  { id: 'retirement', label: 'Save for retirement', icon: '👴' },
  { id: 'education', label: 'Save for education', icon: '🎓' },
  { id: 'vehicle', label: 'Buy a vehicle', icon: '🚗' },
  { id: 'vacation', label: 'Save for a vacation', icon: '✈️' },
  { id: 'invest', label: 'Start investing', icon: '📈' },
  { id: 'budget', label: 'Get control of my budget', icon: '📊' },
  { id: 'wealth', label: 'Build long term wealth', icon: '💰' },
  { id: 'savings', label: 'Build savings', icon: '🏦' },
  { id: 'project', label: 'Save for a project', icon: '🔨' },
  { id: 'other', label: 'Other', icon: '➕' },
]

const TIMELINES = [
  { id: '6months', label: 'Within 6 months' },
  { id: '1year', label: 'Within 1 year' },
  { id: '3years', label: '1 - 3 years' },
  { id: '5years', label: '3 - 5 years' },
  { id: '10years', label: '5 - 10 years' },
  { id: 'longterm', label: '10+ years' },
]

const DEBT_TYPES = [
  { id: 'credit_card', label: 'Credit card' },
  { id: 'student_loan', label: 'Student loan' },
  { id: 'car_loan', label: 'Car loan' },
  { id: 'mortgage', label: 'Mortgage' },
  { id: 'personal_loan', label: 'Personal loan' },
  { id: 'other', label: 'Other' },
]

export default function GoalsScreen() {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [timeline, setTimeline] = useState('')
  const [hasEmergencyFund, setHasEmergencyFund] = useState<boolean | null>(null)
  const [emergencyMonths, setEmergencyMonths] = useState('')
  const [highInterestDebt, setHighInterestDebt] = useState<boolean | null>(null)
  const [debtTypes, setDebtTypes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggleGoal(id: string) {
    if (selectedGoals.includes(id)) {
      setSelectedGoals(selectedGoals.filter(g => g !== id))
      if (primaryGoal === id) setPrimaryGoal('')
    } else {
      setSelectedGoals([...selectedGoals, id])
      if (!primaryGoal) setPrimaryGoal(id)
    }
  }

  function toggleDebtType(id: string) {
    if (debtTypes.includes(id)) {
      setDebtTypes(debtTypes.filter(d => d !== id))
    } else {
      setDebtTypes([...debtTypes, id])
    }
  }

  async function handleContinue() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          goals: selectedGoals,
          primary_goal: primaryGoal,
          goal_timeline: timeline,
          has_emergency_fund: hasEmergencyFund,
          emergency_fund_months: emergencyMonths ? parseInt(emergencyMonths) : null,
          has_high_interest_debt: highInterestDebt,
          debt_types: debtTypes,
        })
      }
    } catch (e) {}
    setSaving(false)
    router.push('/onboarding/income')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>
        <Text style={styles.progressLabel}>Step 6 of 9</Text>
      </View>
      <Text style={styles.title}>What are you working toward?</Text>
      <Text style={styles.subtitle}>
        Pick everything that applies — your budget will be built around making these happen.
      </Text>

      <Text style={styles.sectionLabel}>What are you working toward? (select all that apply)</Text>
      <View style={styles.chipGrid}>
        {GOALS.map(goal => (
          <TouchableOpacity
            key={goal.id}
            style={[styles.chip, selectedGoals.includes(goal.id) && styles.chipActive]}
            onPress={() => toggleGoal(goal.id)}
          >
            <Text style={styles.chipIcon}>{goal.icon}</Text>
            <Text style={[styles.chipText, selectedGoals.includes(goal.id) && styles.chipTextActive]}>
              {goal.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedGoals.length > 1 && (
        <>
          <Text style={styles.sectionLabel}>What is your most important goal right now?</Text>
          <View style={styles.chipGrid}>
            {GOALS.filter(g => selectedGoals.includes(g.id)).map(goal => (
              <TouchableOpacity
                key={goal.id}
                style={[styles.chip, primaryGoal === goal.id && styles.chipActive]}
                onPress={() => setPrimaryGoal(goal.id)}
              >
                <Text style={styles.chipIcon}>{goal.icon}</Text>
                <Text style={[styles.chipText, primaryGoal === goal.id && styles.chipTextActive]}>
                  {goal.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {selectedGoals.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>What is your timeline for your primary goal?</Text>
          <View style={styles.chipGrid}>
            {TIMELINES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.chip, timeline === t.id && styles.chipActive]}
                onPress={() => setTimeline(t.id)}
              >
                <Text style={[styles.chipText, timeline === t.id && styles.chipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>Do you have an emergency fund?</Text>
      <View style={styles.yesNoRow}>
        <TouchableOpacity
          style={[styles.yesNoBtn, hasEmergencyFund === true && styles.yesNoBtnActive]}
          onPress={() => setHasEmergencyFund(true)}
        >
          <Text style={[styles.yesNoBtnText, hasEmergencyFund === true && styles.yesNoBtnTextActive]}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.yesNoBtn, hasEmergencyFund === false && styles.yesNoBtnActive]}
          onPress={() => setHasEmergencyFund(false)}
        >
          <Text style={[styles.yesNoBtnText, hasEmergencyFund === false && styles.yesNoBtnTextActive]}>No</Text>
        </TouchableOpacity>
      </View>

      {hasEmergencyFund === true && (
        <>
          <Text style={styles.sectionLabel}>How many months of expenses does it cover?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 3"
            placeholderTextColor={Colors.textSecondary}
            value={emergencyMonths}
            onChangeText={setEmergencyMonths}
            keyboardType="number-pad"
          />
        </>
      )}

      <Text style={styles.sectionLabel}>Do you have any high-interest debt? (over 10%)</Text>
      <View style={styles.yesNoRow}>
        <TouchableOpacity
          style={[styles.yesNoBtn, highInterestDebt === true && styles.yesNoBtnActive]}
          onPress={() => setHighInterestDebt(true)}
        >
          <Text style={[styles.yesNoBtnText, highInterestDebt === true && styles.yesNoBtnTextActive]}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.yesNoBtn, highInterestDebt === false && styles.yesNoBtnActive]}
          onPress={() => setHighInterestDebt(false)}
        >
          <Text style={[styles.yesNoBtnText, highInterestDebt === false && styles.yesNoBtnTextActive]}>No</Text>
        </TouchableOpacity>
      </View>

      {highInterestDebt === true && (
        <>
          <Text style={styles.sectionLabel}>What type of high-interest debt?</Text>
          <View style={styles.chipGrid}>
            {DEBT_TYPES.map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, debtTypes.includes(d.id) && styles.chipActive]}
                onPress={() => toggleDebtType(d.id)}
              >
                <Text style={[styles.chipText, debtTypes.includes(d.id) && styles.chipTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          📋 Zerobased provides financial education and budgeting tools, not personalized financial advice. Information provided is for educational purposes only. For personalized financial advice, please consult a registered financial advisor.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={handleContinue}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleContinue} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip for now</Text>
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
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.text,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  yesNoBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yesNoBtnText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  yesNoBtnTextActive: {
    color: Colors.text,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  disclaimerBox: {
    backgroundColor: '#edf7f1',
    borderWidth: 1,
    borderColor: '#b6dfc0',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
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
  progressWrap: { marginBottom: 20 },
  progressTrack: { height: 3, backgroundColor: '#e3e8e3', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 3, backgroundColor: '#3db870', borderRadius: 2 },
  progressLabel: { fontSize: 11, color: '#3db870', fontWeight: '600' },
})