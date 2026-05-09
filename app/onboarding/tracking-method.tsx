import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { setBudgetCycle, setTrackingMethod } from '../../lib/store'

export default function TrackingMethodScreen() {
  const [step, setStep] = useState<'tracking' | 'cycle'>('tracking')
  const [selectedTracking, setSelectedTracking] = useState<'bank' | 'manual' | null>(null)

  function handleTrackingChoice(method: 'bank' | 'manual') {
    setSelectedTracking(method)
    setTrackingMethod(method)
    setStep('cycle')
  }

  function handleCycleChoice(cycle: 'monthly' | 'paycycle') {
    setBudgetCycle(cycle)
    router.replace('/onboarding/accounts-everyday')
  }

  if (step === 'cycle') {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <TouchableOpacity onPress={() => setStep('tracking')} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '11%' }]} />
          </View>
          <Text style={styles.progressLabel}>Step 1 of 9</Text>
        </View>
          <Text style={styles.title}>How do you want to budget?</Text>
          <Text style={styles.subtitle}>This affects how your budget resets and how spending is tracked</Text>

          <View style={styles.options}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleCycleChoice('monthly')}
            >
              <Text style={styles.optionIcon}>📅</Text>
              <Text style={styles.optionTitle}>Calendar month</Text>
              <Text style={styles.optionDesc}>
                Budget resets on the 1st of every month. Simple and straightforward — works best if you're paid monthly.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleCycleChoice('paycycle')}
            >
              <Text style={styles.optionIcon}>💰</Text>
              <Text style={styles.optionTitle}>Pay cycle</Text>
              <Text style={styles.optionDesc}>
                Budget resets with each paycheque. Perfect for bi-weekly or weekly pay — your budget follows your actual cash flow.
              </Text>
              <Text style={styles.optionTag}>Recommended for bi-weekly pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.replace('/welcome')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '11%' }]} />
          </View>
          <Text style={styles.progressLabel}>Step 1 of 9</Text>
        </View>
        <Text style={styles.title}>How would you like to track your money?</Text>
        <Text style={styles.subtitle}>You can change this anytime in settings</Text>

        <View style={styles.options}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => handleTrackingChoice('bank')}
          >
            <Text style={styles.optionIcon}>🏦</Text>
            <Text style={styles.optionTitle}>Connect my bank</Text>
            <Text style={styles.optionDesc}>
              Automatically import transactions from your Canadian bank accounts. Recommended for most users.
            </Text>
            <Text style={styles.optionTag}>Recommended</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => handleTrackingChoice('manual')}
          >
            <Text style={styles.optionIcon}>✏️</Text>
            <Text style={styles.optionTitle}>Enter manually</Text>
            <Text style={styles.optionDesc}>
              Log transactions yourself or scan receipts. Great if you prefer full control over your data.
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f2',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 60,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 40,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  options: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 16,
    padding: 24,
  },
  optionIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  optionDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  optionTag: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  progressWrap: {
    marginBottom: 20,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#e3e8e3',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 3,
    backgroundColor: '#3db870',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: '#3db870',
    fontWeight: '600',
  },
})