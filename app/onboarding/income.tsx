import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setIncomeSources } from '../../lib/store'

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
  label: string
  amount: string
  frequency: string
  type: string
}

export default function IncomeScreen() {
  const [sources, setSources] = useState<IncomeSource[]>(() => {
    const saved = getOnboardingData().incomeSources
    return saved.length > 0 ? saved : [{ label: 'Primary income', amount: '', frequency: 'biweekly', type: 'employment' }]
  })

  function updateSource(index: number, field: keyof IncomeSource, value: string) {
    const updated = [...sources]
    updated[index] = { ...updated[index], [field]: value }
    setSources(updated)
  }

  function addSource() {
    setSources([...sources, { label: 'Additional income', amount: '', frequency: 'monthly', type: 'other' }])
  }

  function removeSource(index: number) {
    setSources(sources.filter((_, i) => i !== index))
  }

  function handleContinue() {
    setIncomeSources(sources)
    router.push('/onboarding/expenses')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.step}>Step 3 of 5</Text>
      <Text style={styles.title}>Your income</Text>
      <Text style={styles.subtitle}>Add all sources of income you receive</Text>

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
  sourceList: {
    gap: 16,
    marginBottom: 16,
  },
  sourceCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
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
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
})