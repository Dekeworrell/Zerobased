import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setIncomeSources } from '../../lib/store'
import { supabase } from '../../lib/supabase'

const PAY_FREQUENCIES = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'semimonthly', label: 'Semi-monthly' },
  { id: 'monthly', label: 'Monthly' },
]

const INCOME_TYPES = [
  { id: 'employment', label: 'Employment' },
  { id: 'selfemployed', label: 'Self-employed' },
  { id: 'pension', label: 'Pension' },
  { id: 'benefits', label: 'Benefits' },
  { id: 'other', label: 'Other' },
]

type IncomeSource = {
  id?: string
  label: string
  amount: string
  frequency: string
  type: string
  next_payday: string
  second_payday: string
}

export default function IncomeScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>()
  const isEditing = from === 'dashboard'
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [showPaydayPicker, setShowPaydayPicker] = useState<number | null>(null)
  const [showSecondPaydayPicker, setShowSecondPaydayPicker] = useState<number | null>(null)
  const [paydayError, setPaydayError] = useState('')
  const [sources, setSources] = useState<IncomeSource[]>([
    { label: 'Primary income', amount: '', frequency: 'biweekly', type: 'employment', next_payday: '', second_payday: '' }
  ])

  useEffect(() => {
    if (isEditing) {
      loadExistingIncome()
    } else {
      const saved = getOnboardingData().incomeSources
      if (saved.length > 0) {
        setSources(saved.map((s: any) => ({ ...s, next_payday: s.next_payday || '' })))
      }
    }
  }, [])

  async function loadExistingIncome() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('income_sources')
      .select('*')
      .eq('user_id', user.id)

    if (data && data.length > 0) {
      setSources(data.map((s: any) => {
        const dates = (s.next_payday || '').split('|')
        return {
          id: s.id,
          label: s.label,
          amount: s.amount.toString(),
          frequency: s.frequency,
          type: s.type,
          next_payday: dates[0] || '',
          second_payday: dates[1] || '',
        }
      }))
    }
    setLoading(false)
  }

  function updateSource(index: number, field: keyof IncomeSource, value: string) {
    const updated = [...sources]
    updated[index] = { ...updated[index], [field]: value }
    setSources(updated)
  }

  function addSource() {
    setSources([...sources, {
      label: 'Additional income',
      amount: '',
      frequency: 'monthly',
      type: 'other',
      next_payday: '',
      second_payday: '',
    }])
  }

  function removeSource(index: number) {
    setSources(sources.filter((_, i) => i !== index))
  }

  async function handleContinue() {
    const missing = sources.find(s => !s.next_payday)
    if (missing) {
      setPaydayError('Please choose your next payday date before continuing.')
      return
    }
    setPaydayError('')
    if (isEditing) {
      setSaving(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('income_sources').delete().eq('user_id', user.id)
        await supabase.from('income_sources').insert(
          sources.map(s => ({
            user_id: user.id,
            label: s.label,
            amount: parseFloat(s.amount) || 0,
            frequency: s.frequency,
            type: s.type,
            next_payday: s.frequency === 'semimonthly' && s.second_payday
              ? `${s.next_payday}|${s.second_payday}`
              : s.next_payday || null,
          }))
        )
        router.replace('/dashboard')
      } catch (err) {
        console.error(err)
      }
      setSaving(false)
    } else {
      setIncomeSources(sources)
      router.push('/onboarding/expenses')
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      {!isEditing && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '77%' }]} />
          </View>
          <Text style={styles.progressLabel}>Step 7 of 9</Text>
        </View>
      )}
      {isEditing && <Text style={styles.step}>Edit income</Text>}
      <Text style={styles.title}>How much do you bring home?</Text>
      <Text style={styles.subtitle}>Enter your take-home pay after tax. Add multiple sources if you have them.</Text>

      <View style={styles.sourceList}>
        {sources.map((source, index) => (
          <View key={index} style={styles.sourceCard}>
            <View style={styles.cardHeader}>
              <TextInput
                style={styles.sourceLabel}
                value={source.label}
                onChangeText={(val) => updateSource(index, 'label', val)}
                placeholderTextColor={Colors.textSecondary}
              />
              {sources.length > 1 && (
                <TouchableOpacity onPress={() => removeSource(index)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fieldLabel}>Amount (after tax)</Text>
            <CurrencyInput
              style={styles.input}
              placeholder="$0.00"
              value={source.amount}
              onChangeText={(val) => updateSource(index, 'amount', val)}
            />

            <Text style={styles.fieldLabel}>Pay frequency</Text>
            <View style={styles.chipRow}>
              {PAY_FREQUENCIES.map((freq) => (
                <TouchableOpacity
                  key={freq.id}
                  style={[styles.chip, source.frequency === freq.id && styles.chipActive]}
                  onPress={() => updateSource(index, 'frequency', freq.id)}
                >
                  <Text style={[styles.chipText, source.frequency === freq.id && styles.chipTextActive]}>
                    {freq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              {source.frequency === 'semimonthly' ? '1st payday of the period' : 'Next payday'}
            </Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={source.next_payday}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => updateSource(index, 'next_payday', e.target.value)}
                style={{
                  backgroundColor: Colors.card,
                  border: `2px solid ${source.next_payday ? Colors.primary : Colors.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontSize: 16,
                  color: Colors.text,
                  width: '100%',
                  boxSizing: 'border-box' as any,
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowPaydayPicker(index)}
              >
                <Text style={styles.dateButtonText}>
                  📅 {source.next_payday || 'Select date'}
                </Text>
              </TouchableOpacity>
            )}
            {showPaydayPicker === index && (
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden' }}>
                <DateTimePicker
                  value={source.next_payday ? new Date(source.next_payday + 'T12:00:00') : new Date()}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const offset = selectedDate.getTimezoneOffset()
                      const local = new Date(selectedDate.getTime() - offset * 60 * 1000)
                      updateSource(index, 'next_payday', local.toISOString().split('T')[0])
                    }
                  }}
                />
                <TouchableOpacity
                  style={styles.datePickerDoneBtn}
                  onPress={() => setShowPaydayPicker(null)}
                >
                  <Text style={styles.datePickerDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {source.frequency === 'semimonthly' && (
              <>
                <Text style={styles.fieldLabel}>2nd payday of the period</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={source.second_payday}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => updateSource(index, 'second_payday', e.target.value)}
                    style={{
                      backgroundColor: '#1c1c1e',
                      border: '1px solid #3a3a3c',
                      borderRadius: 12,
                      padding: '14px 16px',
                      fontSize: 16,
                      color: '#ffffff',
                      width: '100%',
                      boxSizing: 'border-box' as any,
                      marginBottom: 8,
                    }}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowSecondPaydayPicker(index)}
                  >
                    <Text style={styles.dateButtonText}>
                      📅 {source.second_payday || 'Select date'}
                    </Text>
                  </TouchableOpacity>
                )}
                {showSecondPaydayPicker === index && (
                  <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden' }}>
                    <DateTimePicker
                      value={source.second_payday ? new Date(source.second_payday + 'T12:00:00') : new Date()}
                      mode="date"
                      display="spinner"
                      themeVariant="light"
                      minimumDate={new Date()}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          const offset = selectedDate.getTimezoneOffset()
                          const local = new Date(selectedDate.getTime() - offset * 60 * 1000)
                          updateSource(index, 'second_payday', local.toISOString().split('T')[0])
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.datePickerDoneBtn}
                      onPress={() => setShowSecondPaydayPicker(null)}
                    >
                      <Text style={styles.datePickerDoneBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <Text style={styles.fieldLabel}>Income type</Text>
            <View style={styles.chipRow}>
              {INCOME_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.chip, source.type === type.id && styles.chipActive]}
                  onPress={() => updateSource(index, 'type', type.id)}
                >
                  <Text style={[styles.chipText, source.type === type.id && styles.chipTextActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.addButton} onPress={addSource}>
        <Text style={styles.addButtonText}>+ Add another income source</Text>
      </TouchableOpacity>

      {paydayError ? (
        <View style={styles.paydayError}>
          <Text style={styles.paydayErrorText}>⚠️ {paydayError}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={handleContinue}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : isEditing ? 'Save & return to dashboard' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f2f4f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sourceList: {
    gap: 16,
    marginBottom: 16,
  },
  sourceCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  removeBtn: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
  },
  dateButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 4,
  },
  dateButtonText: {
    fontSize: 15,
    color: Colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  addButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerDoneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  datePickerDoneBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  paydayError: {
    backgroundColor: Colors.danger + '22',
    borderWidth: 2,
    borderColor: Colors.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  paydayErrorText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressWrap: { marginBottom: 20 },
  progressTrack: { height: 3, backgroundColor: '#e3e8e3', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 3, backgroundColor: '#3db870', borderRadius: 2 },
  progressLabel: { fontSize: 11, color: '#3db870', fontWeight: '600' },
})