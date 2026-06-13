import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import KeyboardScrollView from '../../components/KeyboardScrollView'
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
  income_type: 'variable' | 'variable'
  next_payday: string
  second_payday: string
}

export default function IncomeScreen() {
  const { width: windowWidth } = useWindowDimensions()
  // content paddingHorizontal:32 each side + card padding:20 each side = 104
  const pickerWidth = Math.min(windowWidth, 500) - 104
  const { from } = useLocalSearchParams<{ from?: string }>()
  const isEditing = from === 'dashboard'
  const isHouseholdJoin = from === 'household_join'
  const [loading, setLoading] = useState(isEditing || isHouseholdJoin)
  // Partner income (household editing only)
  const [partnerSources, setPartnerSources] = useState<IncomeSource[]>([])
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string>('Partner')
  const [saving, setSaving] = useState(false)
  const [showPaydayPicker, setShowPaydayPicker] = useState<number | null>(null)
  const [showSecondPaydayPicker, setShowSecondPaydayPicker] = useState<number | null>(null)
  const [paydayError, setPaydayError] = useState('')
  const [sources, setSources] = useState<IncomeSource[]>([
    { label: 'Primary income', amount: '', frequency: 'biweekly', type: 'employment', income_type: 'variable', next_payday: '', second_payday: '' }
  ])

  useEffect(() => {
    if (isEditing || isHouseholdJoin) {
      loadExistingIncome()
    } else {
      const saved = getOnboardingData().incomeSources
      if (saved.length > 0) {
        setSources(saved.map((s: any) => ({ ...s, next_payday: s.next_payday || '' })))
      }
    }
  }, [])

  function parseSourceRow(s: any): IncomeSource {
    const dates = (s.next_payday || '').split('|')
    const storedDate = dates[0] || ''
    let nextPayday = storedDate
    if (storedDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let periodDays = 14
      if (s.frequency === 'weekly') periodDays = 7
      if (s.frequency === 'monthly') periodDays = 30
      if (s.frequency === 'semimonthly') periodDays = 15
      const d = new Date(storedDate + 'T12:00:00')
      while (d < today) d.setDate(d.getDate() + periodDays)
      nextPayday = d.toISOString().split('T')[0]
    }
    return {
      id: s.id,
      label: s.label,
      amount: s.amount.toString(),
      frequency: s.frequency,
      type: s.type,
      income_type: s.income_type || 'fixed',
      next_payday: nextPayday,
      second_payday: dates[1] || '',
    }
  }

  async function loadExistingIncome() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    // For household_join mode: just load current user's existing income (may be empty)
    if (isHouseholdJoin) {
      const { data } = await supabase.from('income_sources').select('*').eq('user_id', user.id)
      if (data && data.length > 0) setSources(data.map(parseSourceRow))
      else setSources([{ label: 'My income', amount: '', frequency: 'biweekly', type: 'employment', income_type: 'variable', next_payday: '', second_payday: '' }])
      setLoading(false)
      return
    }

    // Dashboard editing: load current user + partner income
    const { data: householdIds } = await supabase.rpc('get_household_user_ids')
    const userIds: string[] = householdIds || [user.id]
    const partnerIds = userIds.filter(id => id !== user.id)

    const { data } = await supabase.from('income_sources').select('*').in('user_id', userIds)

    const myRows = (data || []).filter((s: any) => s.user_id === user.id)
    const partnerRows = (data || []).filter((s: any) => s.user_id !== user.id)

    setSources(myRows.length > 0
      ? myRows.map(parseSourceRow)
      : [{ label: 'My income', amount: '', frequency: 'biweekly', type: 'employment', income_type: 'variable', next_payday: '', second_payday: '' }]
    )

    if (partnerIds.length > 0) {
      setPartnerId(partnerIds[0])
      setPartnerSources(partnerRows.length > 0
        ? partnerRows.map(parseSourceRow)
        : [{ label: "Partner's income", amount: '', frequency: 'biweekly', type: 'employment', income_type: 'variable', next_payday: '', second_payday: '' }]
      )
      // Use the household RPC (profiles RLS only allows reading own row)
      const { data: members } = await supabase.rpc('get_household_members')
      if (members && members.length > 0) setPartnerName(members[0].name || 'Partner')
    }

    setLoading(false)
  }

  function updateSource(index: number, field: keyof IncomeSource, value: string) {
    const updated = [...sources]
    updated[index] = { ...updated[index], [field]: value }
    setSources(updated)
  }

  function addSource() {
    setSources([...sources, { label: 'Additional income', amount: '', frequency: 'monthly', type: 'other', income_type: 'variable', next_payday: '', second_payday: '' }])
  }

  function removeSource(index: number) {
    setSources(sources.filter((_, i) => i !== index))
  }

  function updatePartnerSource(index: number, field: keyof IncomeSource, value: string) {
    const updated = [...partnerSources]
    updated[index] = { ...updated[index], [field]: value }
    setPartnerSources(updated)
  }

  function addPartnerSource() {
    setPartnerSources([...partnerSources, { label: 'Additional income', amount: '', frequency: 'monthly', type: 'other', income_type: 'variable', next_payday: '', second_payday: '' }])
  }

  function removePartnerSource(index: number) {
    setPartnerSources(partnerSources.filter((_, i) => i !== index))
  }

  function buildInsertRow(s: IncomeSource, userId: string) {
    return {
      user_id: userId,
      label: s.label,
      amount: parseFloat(s.amount) || 0,
      frequency: s.frequency,
      type: s.type,
      income_type: s.income_type || 'fixed',
      next_payday: s.frequency === 'semimonthly' && s.second_payday
        ? `${s.next_payday}|${s.second_payday}`
        : s.next_payday || null,
    }
  }

  async function handleSkipNoIncome() {
    if (isEditing || isHouseholdJoin) {
      setSaving(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return
        await supabase.from('income_sources').delete().eq('user_id', user.id)
        router.replace('/dashboard')
      } catch (err) { console.error(err) }
      setSaving(false)
    } else {
      setIncomeSources([])
      router.replace('/onboarding/expenses')
    }
  }

  async function handleContinue() {
    const allMySources = sources.filter(s => s.next_payday || parseFloat(s.amount) > 0)
    const allPartnerSources = partnerSources.filter(s => s.next_payday || parseFloat(s.amount) > 0)

    const missingPayday = allMySources.find(s => !s.next_payday)
    const missingPartnerPayday = allPartnerSources.find(s => !s.next_payday)
    if (missingPayday || missingPartnerPayday) {
      setPaydayError('Please choose a next payday date for each income source, or use "I have no income" to skip.')
      return
    }
    setPaydayError('')

    if (isEditing || isHouseholdJoin) {
      setSaving(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return

        // Save current user's income
        await supabase.from('income_sources').delete().eq('user_id', user.id)
        if (allMySources.length > 0) {
          await supabase.from('income_sources').insert(allMySources.map(s => buildInsertRow(s, user.id)))
        }

        // Save partner's income (dashboard editing only, not household_join)
        if (isEditing && partnerId && allPartnerSources.length > 0) {
          await supabase.from('income_sources').delete().eq('user_id', partnerId)
          await supabase.from('income_sources').insert(allPartnerSources.map(s => buildInsertRow(s, partnerId)))
        }

        router.replace('/dashboard')
      } catch (err) { console.error(err) }
      setSaving(false)
    } else {
      setIncomeSources(sources)
      router.replace('/onboarding/expenses')
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
    <>
      <KeyboardScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => (isEditing || isHouseholdJoin) ? router.replace('/dashboard') : router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      {!isEditing && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '77%' }]} />
          </View>
          <Text style={styles.progressLabel}>Step 1 of 3</Text>
        </View>
      )}
      {isEditing && <Text style={styles.step}>Edit income</Text>}
      {isHouseholdJoin && <Text style={styles.step}>Your income</Text>}
      <Text style={styles.title}>
        {isHouseholdJoin ? 'Set up your income' : 'How much do you bring home?'}
      </Text>
      <Text style={styles.subtitle}>
        {isHouseholdJoin
          ? 'Add your personal take-home income for the shared budget. You can skip this if all household income comes from your partner.'
          : 'Enter your take-home pay after tax. Add multiple sources if you have them.'}
      </Text>

      {isEditing && partnerId && (
        <Text style={styles.sectionHeader}>Your income</Text>
      )}

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
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden', alignSelf: 'stretch' }}>
                <DateTimePicker
                  value={source.next_payday ? new Date(source.next_payday + 'T12:00:00') : new Date()}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  minimumDate={new Date()}
                  style={{ width: pickerWidth }}
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
                      backgroundColor: Colors.card,
                      border: `2px solid ${source.second_payday ? Colors.primary : Colors.border}`,
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
                    onPress={() => setShowSecondPaydayPicker(index)}
                  >
                    <Text style={styles.dateButtonText}>
                      📅 {source.second_payday || 'Select date'}
                    </Text>
                  </TouchableOpacity>
                )}
                {showSecondPaydayPicker === index && (
                  <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden', alignSelf: 'stretch' }}>
                    <DateTimePicker
                      value={source.second_payday ? new Date(source.second_payday + 'T12:00:00') : new Date()}
                      mode="date"
                      display="spinner"
                      themeVariant="light"
                      minimumDate={new Date()}
                      style={{ width: pickerWidth }}
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

            <Text style={styles.fieldLabel}>Pay amount</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, source.income_type === 'variable' && styles.chipActive]}
                onPress={() => updateSource(index, 'income_type', 'variable')}
              >
                <Text style={[styles.chipText, source.income_type === 'variable' && styles.chipTextActive]}>
                  📊 Variable income
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, source.income_type === 'fixed' && styles.chipActive]}
                onPress={() => updateSource(index, 'income_type', 'fixed')}
              >
                <Text style={[styles.chipText, source.income_type === 'fixed' && styles.chipTextActive]}>
                  📅 Fixed income
                </Text>
              </TouchableOpacity>
            </View>
            {source.income_type === 'fixed' && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  📅 Fixed income is for salaried employees or anyone who receives the same amount every payday. We'll automatically log your paycheque on payday and ask you to confirm — with the option to adjust for bonuses or one-time payments.
                </Text>
              </View>
            )}
            {source.income_type === 'variable' && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  📊 Variable income is for hourly workers, freelancers, or anyone whose pay changes each cycle. On payday we'll ask how much you earned so your budget reflects your actual take-home pay.
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.addButton} onPress={addSource}>
        <Text style={styles.addButtonText}>+ Add another income source</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkipNoIncome} disabled={saving}>
        <Text style={styles.skipButtonText}>I have no income</Text>
      </TouchableOpacity>

      {/* Partner income section — shown only when editing from dashboard with a household partner */}
      {isEditing && partnerId && (
        <>
          <Text style={styles.sectionHeader}>{partnerName}'s income</Text>
          <View style={styles.sourceList}>
            {partnerSources.map((source, index) => (
              <View key={index} style={[styles.sourceCard, styles.partnerCard]}>
                <View style={styles.cardHeader}>
                  <TextInput
                    style={styles.sourceLabel}
                    value={source.label}
                    onChangeText={(val) => updatePartnerSource(index, 'label', val)}
                    placeholderTextColor={Colors.textSecondary}
                  />
                  {partnerSources.length > 1 && (
                    <TouchableOpacity onPress={() => removePartnerSource(index)}>
                      <Text style={styles.removeBtn}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Amount (after tax)</Text>
                <CurrencyInput
                  style={styles.input}
                  placeholder="$0.00"
                  value={source.amount}
                  onChangeText={(val) => updatePartnerSource(index, 'amount', val)}
                />

                <Text style={styles.fieldLabel}>Pay frequency</Text>
                <View style={styles.chipRow}>
                  {PAY_FREQUENCIES.map((freq) => (
                    <TouchableOpacity
                      key={freq.id}
                      style={[styles.chip, source.frequency === freq.id && styles.chipActive]}
                      onPress={() => updatePartnerSource(index, 'frequency', freq.id)}
                    >
                      <Text style={[styles.chipText, source.frequency === freq.id && styles.chipTextActive]}>
                        {freq.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Next payday</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={source.next_payday}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => updatePartnerSource(index, 'next_payday', e.target.value)}
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
                    onPress={() => setShowPaydayPicker(-(index + 1))}
                  >
                    <Text style={styles.dateButtonText}>
                      📅 {source.next_payday || 'Select date'}
                    </Text>
                  </TouchableOpacity>
                )}
                {showPaydayPicker === -(index + 1) && (
                  <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e3e8e3', overflow: 'hidden', alignSelf: 'stretch' }}>
                    <DateTimePicker
                      value={source.next_payday ? new Date(source.next_payday + 'T12:00:00') : new Date()}
                      mode="date"
                      display="spinner"
                      themeVariant="light"
                      minimumDate={new Date()}
                      style={{ width: pickerWidth }}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          const offset = selectedDate.getTimezoneOffset()
                          const local = new Date(selectedDate.getTime() - offset * 60 * 1000)
                          updatePartnerSource(index, 'next_payday', local.toISOString().split('T')[0])
                        }
                      }}
                    />
                    <TouchableOpacity style={styles.datePickerDoneBtn} onPress={() => setShowPaydayPicker(null)}>
                      <Text style={styles.datePickerDoneBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.fieldLabel}>Pay amount</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, source.income_type === 'variable' && styles.chipActive]}
                    onPress={() => updatePartnerSource(index, 'income_type', 'variable')}
                  >
                    <Text style={[styles.chipText, source.income_type === 'variable' && styles.chipTextActive]}>📊 Variable</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, source.income_type === 'fixed' && styles.chipActive]}
                    onPress={() => updatePartnerSource(index, 'income_type', 'fixed')}
                  >
                    <Text style={[styles.chipText, source.income_type === 'fixed' && styles.chipTextActive]}>📅 Fixed</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addPartnerSource}>
            <Text style={styles.addButtonText}>+ Add another source for {partnerName}</Text>
          </TouchableOpacity>
        </>
      )}

      {paydayError ? (
        <View style={styles.paydayError}>
          <Text style={styles.paydayErrorText}>⚠️ {paydayError}</Text>
        </View>
      ) : null}

      <View style={{ height: 80 }} />
    </KeyboardScrollView>
      <View style={styles.floatingButton}>
      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={handleContinue}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : (isEditing || isHouseholdJoin) ? 'Save & go to dashboard' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </View>
    </>
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
    marginBottom: 8,
  },
  addButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  partnerCard: {
    borderColor: Colors.primary + '66',
    backgroundColor: Colors.primary + '08',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
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
  infoBox: {
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: 12,
  },
  infoBoxText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f2f4f2',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e3e8e3',
    alignItems: 'center',
  },
})