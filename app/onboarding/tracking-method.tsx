import { router } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'

export default function TrackingMethodScreen() {
  function handleChoice(method: 'bank' | 'manual') {
    if (method === 'bank') {
      router.push('/onboarding/connect-bank')
    } else {
      router.push('/onboarding/accounts')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.step}>Step 1 of 5</Text>
        <Text style={styles.title}>How would you like to track your money?</Text>
        <Text style={styles.subtitle}>You can change this anytime in settings</Text>

        <View style={styles.options}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => handleChoice('bank')}
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
            onPress={() => handleChoice('manual')}
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
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 60,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
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
})