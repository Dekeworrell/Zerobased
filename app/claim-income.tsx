import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'
import { invalidateUserCache } from '../lib/userCache'

type Income = { id: string; label: string; amount: number; frequency: string }

export default function ClaimIncomeScreen() {
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [incomes, setIncomes] = useState<Income[]>([])
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.replace('/'); return }

      const { data: ids } = await supabase.rpc('get_household_user_ids')
      const userIds: string[] = ids || [user.id]
      const { data } = await supabase
        .from('income_sources')
        .select('id, label, amount, frequency, user_id')
        .in('user_id', userIds)

      setIncomes((data || []).filter((i: any) => i.user_id !== user.id))
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }

  async function claim(incomeId: string) {
    setClaiming(true)
    setError('')
    try {
      const { error } = await supabase.rpc('claim_income', { income_id: incomeId })
      if (error) throw error
      invalidateUserCache()
      router.replace('/dashboard')
    } catch (err: any) { setError(err.message); setClaiming(false) }
  }

  function enterMyOwn() {
    router.replace('/onboarding/income?from=household_join')
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Which income is yours?</Text>
      <Text style={styles.subtitle}>
        Your partner already set up this budget. If one of these incomes is yours, claim it — otherwise add your own.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {incomes.length === 0 ? (
        <Text style={styles.subtitle}>No incomes found on this budget yet.</Text>
      ) : (
        incomes.map(inc => (
          <View key={inc.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{inc.label}</Text>
              <Text style={styles.cardAmount}>
                ${Number(inc.amount).toLocaleString('en-CA')} · {inc.frequency}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.claimBtn, claiming && styles.disabled]}
              onPress={() => claim(inc.id)}
              disabled={claiming}
            >
              <Text style={styles.claimBtnText}>This is mine</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.secondaryBtn} onPress={enterMyOwn} disabled={claiming}>
        <Text style={styles.secondaryBtnText}>None of these are mine — enter my income</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f2f4f2' },
  content: { paddingHorizontal: 24, paddingVertical: 60, maxWidth: 500, alignSelf: 'center', width: '100%', gap: 14 },
  title: { fontSize: 26, fontWeight: 'bold', color: Colors.text },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 8, lineHeight: 21 },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8e3', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardLabel: { fontSize: 16, fontWeight: '600', color: Colors.text },
  cardAmount: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  claimBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  claimBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  secondaryBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '500', textAlign: 'center' },
})