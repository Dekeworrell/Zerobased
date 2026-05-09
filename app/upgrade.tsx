import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { purchaseAnnual, purchaseMonthly, restorePurchases } from '../lib/purchases'
import { supabase } from '../lib/supabase'

const FEATURES: { label: string; free: string; pro: string }[] = [
  { label: 'Manual expense tracking',    free: '✅',      pro: '✅' },
  { label: 'Over-budget alerts',          free: '✅',      pro: '✅' },
  { label: 'Custom notification thresholds', free: '🔒',  pro: '✅' },
  { label: 'Budget categories',          free: 'Up to 8', pro: 'Unlimited' },
  { label: 'Pay cycle budgeting',        free: '🔒',      pro: '✅' },
  { label: 'Household sharing',          free: '🔒',      pro: '✅' },
  { label: 'Accounts, debts & net worth',free: '🔒',      pro: '✅' },
  { label: 'Reports & insights',         free: '🔒',      pro: '✅' },
  { label: 'Bank connections',           free: '🔒',      pro: '✅' },
]

async function syncTierWithSupabase(): Promise<void> {
  await supabase.functions.invoke('update-subscription-tier')
}

export default function UpgradeScreen() {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual')
  const [purchasing, setPurchasing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')

  async function handlePurchase() {
    setPurchasing(true)
    setPurchaseError('')
    try {
      const tier = selectedPlan === 'monthly'
        ? await purchaseMonthly()
        : await purchaseAnnual()

      if (tier === 'pro') {
        await syncTierWithSupabase()
        // Fire-and-forget: attribute conversion to affiliate who referred this user (if any)
        supabase.functions.invoke('affiliate-track-conversion', { body: { plan: selectedPlan } }).catch(() => {})
        router.replace('/dashboard')
      }
    } catch (err: any) {
      // RC throws a specific error when the user cancels — don't show that as an error
      if (err?.userCancelled) {
        // silent cancel
      } else {
        setPurchaseError(err?.message ?? 'Purchase failed. Please try again.')
      }
    } finally {
      setPurchasing(false)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setPurchaseError('')
    try {
      const tier = await restorePurchases()
      if (tier === 'pro') {
        await syncTierWithSupabase()
        router.replace('/dashboard')
      } else {
        setPurchaseError('No active subscription found.')
      }
    } catch (err: any) {
      setPurchaseError(err?.message ?? 'Restore failed. Please try again.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Close */}
      <View style={styles.closeRow}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Logo + wordmark */}
      <View style={styles.logoWrap}>
        <View style={styles.logoMark}>
          <View style={styles.logoInner}>
            <View style={[styles.bar, { height: 10, opacity: 0.45 }]} />
            <View style={[styles.bar, { height: 18, opacity: 0.7 }]} />
            <View style={[styles.bar, { height: 26 }]} />
          </View>
        </View>
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>
            Zero<Text style={styles.wordmarkAccent}>based</Text>
          </Text>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        </View>
      </View>

      {/* Headline */}
      <Text style={styles.headline}>Take full control of your money.</Text>
      <Text style={styles.subheading}>
        Zerobased Pro gives you the complete picture — every dollar, every account, every goal, shared with your household.
      </Text>

      {/* Feature comparison */}
      <View style={styles.comparisonCard}>
        <View style={[styles.featureRow, styles.featureHeaderRow]}>
          <Text style={[styles.featureLabel, styles.featureColHeader]}>Feature</Text>
          <Text style={[styles.featureCol, styles.featureColHeader]}>Free</Text>
          <Text style={[styles.featureCol, styles.featureColHeader]}>Pro</Text>
        </View>
        {FEATURES.map((f, i) => {
          const freeMuted = f.free !== '✅'
          return (
            <View
              key={f.label}
              style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureRowBorder]}
            >
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={[styles.featureCol, freeMuted && styles.featureColMuted]}>{f.free}</Text>
              <Text style={styles.featureCol}>{f.pro}</Text>
            </View>
          )
        })}
      </View>

      {/* Pricing */}
      <Text style={styles.pricingTitle}>Choose your plan</Text>
      <View style={styles.pricingRow}>
        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('monthly')}
          activeOpacity={0.8}
          disabled={purchasing}
        >
          <Text style={styles.planName}>Monthly</Text>
          <Text style={styles.planPrice}>$12.99</Text>
          <Text style={styles.planUnit}>CAD / month</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('annual')}
          activeOpacity={0.8}
          disabled={purchasing}
        >
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>Save 42%</Text>
          </View>
          <Text style={[styles.planName, { marginTop: 10 }]}>Annual</Text>
          <Text style={styles.planPrice}>$89.99</Text>
          <Text style={styles.planUnit}>CAD / year</Text>
        </TouchableOpacity>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.upgradeButton, purchasing && styles.upgradeButtonDisabled]}
        onPress={handlePurchase}
        activeOpacity={0.85}
        disabled={purchasing}
      >
        {purchasing
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
        }
      </TouchableOpacity>

      {purchaseError ? (
        <Text style={styles.errorText}>{purchaseError}</Text>
      ) : null}

      <Text style={styles.legalText}>Cancel anytime. Billed through the App Store.</Text>

      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestore}
        disabled={restoring || purchasing}
      >
        {restoring
          ? <ActivityIndicator size="small" color={Colors.textSecondary} />
          : <Text style={styles.restoreText}>Restore purchases</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f2',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    gap: 0,
  },

  // Close button
  closeRow: {
    marginBottom: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoMark: {
    width: 64,
    height: 64,
    backgroundColor: '#edf7f1',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#b6dfc0',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    marginBottom: 14,
  },
  logoInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  bar: {
    width: 7,
    backgroundColor: '#3db870',
    borderRadius: 3,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  wordmarkAccent: {
    color: Colors.primary,
  },
  proBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.2,
  },

  // Hero copy
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },

  // Feature comparison
  comparisonCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  featureHeaderRow: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  featureLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingRight: 8,
  },
  featureCol: {
    width: 68,
    fontSize: 14,
    textAlign: 'center',
    color: Colors.text,
  },
  featureColHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureColMuted: {
    color: Colors.textSecondary,
    fontSize: 13,
  },

  // Pricing
  pricingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  saveBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 2,
  },
  saveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  planName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  planUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // CTA
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonDisabled: {
    opacity: 0.6,
  },
  upgradeButtonText: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: 10,
  },
  legalText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
})
