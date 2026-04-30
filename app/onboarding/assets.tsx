import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import CurrencyInput from '../../components/CurrencyInput'
import KeyboardScrollView from '../../components/KeyboardScrollView'
import { Colors } from '../../constants/colors'
import { getOnboardingData, setAccounts } from '../../lib/store'

const ASSET_TYPES = [
  { id: 'home', label: 'Home', icon: '🏠', multi: true },
  { id: 'vehicle', label: 'Vehicle', icon: '🚗', multi: true },
  { id: 'recreation_vehicle', label: 'Recreation vehicle', icon: '🚤', multi: true },
  { id: 'cottage', label: 'Cottage/Cabin', icon: '🏡', multi: true },
  { id: 'rental', label: 'Rental property', icon: '🏢', multi: true },
  { id: 'business', label: 'Business', icon: '💼', multi: true },
  { id: 'other_asset', label: 'Other asset', icon: '💎', multi: true },
]

type Asset = {
  type: string
  label: string
  icon: string
  balance: string
}

export default function AssetsScreen() {
  const existing = getOnboardingData().accounts.filter(a =>
    ASSET_TYPES.some(e => a.type === e.id || a.type.startsWith(e.id + '_'))
  )

  const [assets, setAssets] = useState<Asset[]>(existing)

  function toggleAsset(type: string, label: string, icon: string, multi?: boolean) {
    const exists = assets.find(a => a.type === type)
    if (exists && !multi) {
      setAssets(assets.filter(a => a.type !== type))
    } else {
      const newId = multi ? `${type}_${Date.now()}` : type
      setAssets([...assets, { type: newId, label, icon, balance: '' }])
    }
  }

  function updateBalance(type: string, balance: string) {
    setAssets(assets.map(a => a.type === type ? { ...a, balance } : a))
  }

  function updateLabel(type: string, label: string) {
    setAssets(assets.map(a => a.type === type ? { ...a, label } : a))
  }

  function handleContinue() {
    const existing = getOnboardingData().accounts
    const otherAccounts = existing.filter(a => !ASSET_TYPES.find(e => e.id === a.type))
    setAccounts([...otherAccounts, ...assets])
    router.push('/onboarding/goals')
  }

  return (
    <KeyboardScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}> 
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '55%' }]} />
        </View>
        <Text style={styles.progressLabel}>Step 5 of 9</Text>
      </View>
      <Text style={styles.title}>What do you own of value?</Text>
      <Text style={styles.subtitle}>
        Your home, vehicles, and other major assets count toward your net worth. Rough estimates work great!
      </Text>
      <Text style={styles.subtitle}>
        What's the estimated current value of each?
      </Text>

      <View style={styles.chipRow}>
        {ASSET_TYPES.map(acc => (
          <TouchableOpacity
            key={acc.id}
            style={[styles.chip, !(acc as any).multi && assets.find(a => a.type === acc.id) && styles.chipActive]}
            onPress={() => toggleAsset(acc.id, acc.label, acc.icon, (acc as any).multi)}
          >
            <Text style={styles.chipIcon}>{acc.icon}</Text>
            <Text style={[styles.chipText, assets.find(a => a.type === acc.id) && styles.chipTextActive]}>
              {acc.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {assets.length > 0 && (
        <View style={styles.accountList}>
          {assets.map(asset => (
            <View key={asset.type} style={styles.accountCard}>
              <View style={styles.accountHeader}>
              <Text style={styles.accountIcon}>{asset.icon}</Text>
              <TextInput
                style={styles.accountLabel}
                value={asset.label}
                onChangeText={(val) => setAssets(assets.map(a => a.type === asset.type ? { ...a, label: val } : a))}
                placeholderTextColor={Colors.textSecondary}
              />
              <TouchableOpacity onPress={() => setAssets(assets.filter(a => a.type !== asset.type))}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
              <CurrencyInput
                style={styles.balanceInput}
                placeholder="Estimated value"
                value={asset.balance}
                onChangeText={(val) => updateBalance(asset.type, val)}
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Use estimated market value — what you could sell it for today. For your home, a rough estimate based on your neighbourhood is fine.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleContinue} style={styles.skipButton}>
        <Text style={styles.skipText}>I have no physical assets to add</Text>
      </TouchableOpacity>
    </KeyboardScrollView>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.text,
  },
  accountList: {
    gap: 12,
  },
  accountCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountIcon: {
    fontSize: 22,
  },
  accountLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  balanceInput: {
    backgroundColor: '#f2f4f2',
    borderWidth: 1,
    borderColor: '#e3e8e3',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  infoBox: {
    backgroundColor: '#edf7f1',
    borderWidth: 1,
    borderColor: '#b6dfc0',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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
  deleteBtn: {
    color: Colors.textSecondary,
    fontSize: 16,
    paddingLeft: 8,
  },
  progressWrap: { marginBottom: 20 },
  progressTrack: { height: 3, backgroundColor: '#e3e8e3', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 3, backgroundColor: '#3db870', borderRadius: 2 },
  progressLabel: { fontSize: 11, color: '#3db870', fontWeight: '600' },
})