import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'

export default function WelcomeScreen() {
  const { country } = useLocalSearchParams<{ country?: string }>()
  const isUS = country === 'US'
  return (
    <View style={styles.container}>
      <View style={styles.content}>

        <Text style={styles.emoji}>💰</Text>
        <Text style={styles.title}>Welcome to Zerobased</Text>
        <Text style={styles.tagline}>{isUS ? 'The budgeting app built for how Americans actually get paid.' : 'The budgeting app built for how Canadians actually get paid.'}</Text>

        <View style={styles.pointsCard}>
          <View style={styles.point}>
            <Text style={styles.pointIcon}>📅</Text>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>Built around your paycheque</Text>
              <Text style={styles.pointDesc}>Budget by pay period, not just monthly. The app adjusts every time you get paid.</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.point}>
            <Text style={styles.pointIcon}>🎯</Text>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>Every dollar has a job</Text>
              <Text style={styles.pointDesc}>Assign your income to categories before you spend it. Nothing gets wasted.</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.point}>
            <Text style={styles.pointIcon}>{isUS ? '🇺🇸' : '🇨🇦'}</Text>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>{isUS ? 'Made for the USA' : 'Made for Canada'}</Text>
              <Text style={styles.pointDesc}>{isUS ? '401k, IRA, Roth IRA — we speak your language. Built for US account types and pay cycles.' : 'RRSP, TFSA, FHSA — we speak your language. Built for Canadian account types and pay cycles.'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.point}>
            <Text style={styles.pointIcon}>⏱️</Text>
            <View style={styles.pointText}>
              <Text style={styles.pointTitle}>Setup takes 5 minutes</Text>
              <Text style={styles.pointDesc}>Answer a few questions and your budget is ready. You can always adjust later.</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/onboarding/income')}
        >
          <Text style={styles.primaryBtnText}>Let's set up your budget →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => router.replace('/onboarding/income')}
        >
          <Text style={styles.skipText}>Skip intro</Text>
        </TouchableOpacity>

      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 60,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  emoji: {
    fontSize: 52,
    textAlign: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  pointsCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    gap: 16,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  pointIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  pointText: {
    flex: 1,
    gap: 3,
  },
  pointTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  pointDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  primaryBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  skipBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
})