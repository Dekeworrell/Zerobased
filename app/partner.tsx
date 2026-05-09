import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

const APP_URL = 'https://zerobased.app'

type AffiliateData = {
  id: string
  name: string
  email: string
  referral_code: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  tier: 'standard' | 'creator' | 'launch'
  commission_rate: number
  applied_at: string
  approved_at: string | null
}

type Stats = {
  total_clicks: number
  total_conversions: number
  total_earned: number
  total_paid: number
  pending_payout: number
}

const TIER_RATES: Record<string, { label: string; rate: string; color: string }> = {
  standard:  { label: 'Standard',      rate: '20%', color: '#888' },
  creator:   { label: 'Creator',       rate: '25%', color: Colors.info },
  launch:    { label: 'Launch Partner', rate: '30%+', color: Colors.primary },
}

export default function PartnerScreen() {
  const [loading, setLoading] = useState(true)
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [conversions, setConversions] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])

  // Apply form
  const [applying, setApplying] = useState(false)
  const [applyName, setApplyName] = useState('')
  const [applyCode, setApplyCode] = useState('')
  const [applyPlatform, setApplyPlatform] = useState('')
  const [applyAudience, setApplyAudience] = useState('')
  const [applyError, setApplyError] = useState('')
  const [applySuccess, setApplySuccess] = useState(false)

  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useFocusEffect(
    useCallback(() => {
      loadPartnerData()
    }, [])
  )

  async function loadPartnerData() {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      // Load affiliate record for this user
      const { data: aff } = await supabase
        .from('affiliates')
        .select('id, name, email, referral_code, status, tier, commission_rate, applied_at, approved_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (aff) {
        setAffiliate(aff)

        if (aff.status === 'approved') {
          // Load stats and history
          const [clicksRes, conversionsRes, payoutsRes] = await Promise.all([
            supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('affiliate_id', aff.id),
            supabase.from('affiliate_conversions').select('id, plan, commission_amount, status, converted_at').eq('affiliate_id', aff.id).order('converted_at', { ascending: false }).limit(20),
            supabase.from('affiliate_payouts').select('id, amount, status, requested_at, paid_at').eq('affiliate_id', aff.id).order('requested_at', { ascending: false }).limit(10),
          ])

          const convData = conversionsRes.data ?? []
          const payData = payoutsRes.data ?? []
          const totalEarned = convData.reduce((s, c) => s + Number(c.commission_amount), 0)
          const totalPaid = payData.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)

          setStats({
            total_clicks: clicksRes.count ?? 0,
            total_conversions: convData.length,
            total_earned: Math.round(totalEarned * 100) / 100,
            total_paid: Math.round(totalPaid * 100) / 100,
            pending_payout: Math.round((totalEarned - totalPaid) * 100) / 100,
          })
          setConversions(convData)
          setPayouts(payData)
        }
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleApply() {
    if (!applyName.trim() || !applyCode.trim()) {
      setApplyError('Name and referral code are required')
      return
    }
    setApplying(true)
    setApplyError('')
    try {
      const { data, error } = await supabase.functions.invoke('affiliate-apply', {
        body: {
          name: applyName.trim(),
          referral_code: applyCode.trim(),
          platform_url: applyPlatform.trim() || null,
          audience_size: applyAudience.trim() || null,
        },
      })
      if (error || data?.error) throw new Error(data?.error ?? error?.message)
      setApplySuccess(true)
      await loadPartnerData()
    } catch (err: any) {
      setApplyError(err.message)
    }
    setApplying(false)
  }

  function copyLink() {
    if (!affiliate) return
    const link = `${APP_URL}/?ref=${affiliate.referral_code}`
    Clipboard.setString(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function formatCAD(amount: number) {
    return `$${amount.toFixed(2)} CAD`
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  }

  // ── Not an affiliate yet ─────────────────────────────────────────────────
  if (!affiliate) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Become a partner</Text>
        <Text style={styles.subtitle}>
          Share Zerobased and earn commission on every subscriber you refer.
        </Text>

        {/* Tier cards */}
        <View style={styles.tierGrid}>
          {[
            { tier: 'standard', desc: 'Great for personal finance enthusiasts', req: 'Any audience size' },
            { tier: 'creator', desc: 'For established personal finance creators', req: '50k+ followers' },
            { tier: 'launch', desc: 'Exclusive rate for early launch partners', req: 'By invitation' },
          ].map(t => {
            const info = TIER_RATES[t.tier]
            return (
              <View key={t.tier} style={styles.tierCard}>
                <Text style={[styles.tierRate, { color: info.color }]}>{info.rate}</Text>
                <Text style={styles.tierLabel}>{info.label}</Text>
                <Text style={styles.tierDesc}>{t.desc}</Text>
                <Text style={styles.tierReq}>{t.req}</Text>
              </View>
            )
          })}
        </View>

        {/* Apply form */}
        <View style={styles.applyCard}>
          <Text style={styles.applyTitle}>Apply now</Text>

          <Text style={styles.fieldLabel}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="Sarah Johnson"
            placeholderTextColor={Colors.textSecondary}
            value={applyName}
            onChangeText={setApplyName}
          />

          <Text style={styles.fieldLabel}>Your referral code</Text>
          <TextInput
            style={styles.input}
            placeholder="SARAH20"
            placeholderTextColor={Colors.textSecondary}
            value={applyCode}
            onChangeText={v => setApplyCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoCapitalize="characters"
            maxLength={15}
          />
          <Text style={styles.fieldHint}>3–15 letters/numbers. Your followers will use this to get a discount.</Text>

          <Text style={styles.fieldLabel}>TikTok / Instagram / YouTube (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="@yourhandle or URL"
            placeholderTextColor={Colors.textSecondary}
            value={applyPlatform}
            onChangeText={setApplyPlatform}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Approximate audience size (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 25000"
            placeholderTextColor={Colors.textSecondary}
            value={applyAudience}
            onChangeText={setApplyAudience}
            keyboardType="numeric"
          />

          {applyError ? <Text style={styles.error}>{applyError}</Text> : null}

          <TouchableOpacity
            style={[styles.applyButton, applying && styles.buttonDisabled]}
            onPress={handleApply}
            disabled={applying}
          >
            {applying
              ? <ActivityIndicator color={Colors.text} />
              : <Text style={styles.applyButtonText}>Submit application</Text>
            }
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    )
  }

  // ── Pending ──────────────────────────────────────────────────────────────
  if (affiliate.status === 'pending') {
    return (
      <View style={styles.center}>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={[styles.backButton, { alignSelf: 'flex-start', marginBottom: 24 }]}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 48 }}>⏳</Text>
        <Text style={styles.title}>Application submitted!</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', maxWidth: 300 }]}>
          We'll review your application and get back to you within 2–3 business days.
        </Text>
        <Text style={[styles.fieldHint, { textAlign: 'center' }]}>
          Applied {formatDate(affiliate.applied_at)} · Code: {affiliate.referral_code}
        </Text>
      </View>
    )
  }

  // ── Rejected ─────────────────────────────────────────────────────────────
  if (affiliate.status === 'rejected' || affiliate.status === 'suspended') {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48 }}>❌</Text>
        <Text style={styles.title}>Application not approved</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', maxWidth: 300 }]}>
          Thank you for applying. Your application wasn't approved at this time. Feel free to reach out if you have questions.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Approved — live dashboard ──────────────────────────────────────────
  const tierInfo = TIER_RATES[affiliate.tier] ?? TIER_RATES.standard
  const referralLink = `${APP_URL}/?ref=${affiliate.referral_code}`

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Partner dashboard</Text>
          <Text style={styles.subtitle}>Hey {affiliate.name} 👋</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: tierInfo.color + '22', borderColor: tierInfo.color }]}>
          <Text style={[styles.tierBadgeText, { color: tierInfo.color }]}>
            {tierInfo.label} · {tierInfo.rate}
          </Text>
        </View>
      </View>

      {/* Referral link */}
      <View style={styles.linkCard}>
        <Text style={styles.linkCardLabel}>Your referral link</Text>
        <Text style={styles.linkCardUrl}>{referralLink}</Text>
        <TouchableOpacity style={styles.copyButton} onPress={copyLink}>
          <Text style={styles.copyButtonText}>{copied ? '✅ Copied!' : '📋 Copy link'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats grid */}
      {stats && (
        <View style={styles.statsGrid}>
          {[
            { label: 'Clicks', value: stats.total_clicks.toString() },
            { label: 'Conversions', value: stats.total_conversions.toString() },
            { label: 'Total earned', value: formatCAD(stats.total_earned) },
            { label: 'Pending payout', value: formatCAD(stats.pending_payout) },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Commission table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversion rates</Text>
        <View style={styles.commissionTable}>
          <View style={styles.commissionRow}>
            <Text style={styles.commissionLabel}>Monthly plan ($12.99)</Text>
            <Text style={styles.commissionValue}>
              {formatCAD(12.99 * affiliate.commission_rate)} / subscriber
            </Text>
          </View>
          <View style={styles.commissionRow}>
            <Text style={styles.commissionLabel}>Annual plan ($89.99)</Text>
            <Text style={styles.commissionValue}>
              {formatCAD(89.99 * affiliate.commission_rate)} / subscriber
            </Text>
          </View>
        </View>
      </View>

      {/* Recent conversions */}
      {conversions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent conversions</Text>
          {conversions.slice(0, 10).map(c => (
            <View key={c.id} style={styles.conversionRow}>
              <View>
                <Text style={styles.conversionPlan}>{c.plan === 'annual' ? '📅 Annual' : '📆 Monthly'}</Text>
                <Text style={styles.conversionDate}>{formatDate(c.converted_at)}</Text>
              </View>
              <View style={styles.conversionRight}>
                <Text style={styles.conversionAmount}>+{formatCAD(Number(c.commission_amount))}</Text>
                <Text style={[styles.conversionStatus, {
                  color: c.status === 'paid' ? Colors.success : c.status === 'pending' ? Colors.warning : Colors.textSecondary
                }]}>{c.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Payout history */}
      {payouts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout history</Text>
          {payouts.map(p => (
            <View key={p.id} style={styles.conversionRow}>
              <View>
                <Text style={styles.conversionPlan}>💸 Payout</Text>
                <Text style={styles.conversionDate}>{formatDate(p.requested_at)}</Text>
              </View>
              <View style={styles.conversionRight}>
                <Text style={styles.conversionAmount}>{formatCAD(Number(p.amount))}</Text>
                <Text style={[styles.conversionStatus, {
                  color: p.status === 'paid' ? Colors.success : Colors.warning
                }]}>{p.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Payout info */}
      <View style={styles.payoutInfo}>
        <Text style={styles.payoutInfoText}>
          💡 Payouts are processed monthly via Stripe. Minimum payout is $25 CAD. Contact us to set up your payout account.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  container: { flex: 1, backgroundColor: '#f2f4f2' },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40, maxWidth: 600, alignSelf: 'center', width: '100%', gap: 20 },
  backButton: { marginBottom: 4 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  tierBadge: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  tierBadgeText: { fontSize: 12, fontWeight: '700' },

  // Tier cards
  tierGrid: { gap: 12 },
  tierCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, gap: 4 },
  tierRate: { fontSize: 26, fontWeight: '800' },
  tierLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  tierDesc: { fontSize: 13, color: Colors.textSecondary },
  tierReq: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },

  // Apply form
  applyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 20, gap: 10 },
  applyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  fieldHint: { fontSize: 12, color: Colors.textSecondary },
  input: { backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text },
  applyButton: { backgroundColor: Colors.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  applyButtonText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.55 },

  // Referral link
  linkCard: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 16, padding: 20, gap: 10 },
  linkCardLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  linkCardUrl: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  copyButton: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  copyButtonText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary },

  // Section
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  commissionTable: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden' },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  commissionLabel: { fontSize: 14, color: Colors.text },
  commissionValue: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  // Conversions / payouts
  conversionRow: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversionPlan: { fontSize: 14, fontWeight: '600', color: Colors.text },
  conversionDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  conversionRight: { alignItems: 'flex-end', gap: 2 },
  conversionAmount: { fontSize: 15, fontWeight: '700', color: Colors.success },
  conversionStatus: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Payout info
  payoutInfo: { backgroundColor: Colors.info + '18', borderWidth: 1, borderColor: Colors.info + '44', borderRadius: 12, padding: 14 },
  payoutInfoText: { fontSize: 13, color: Colors.info, lineHeight: 20 },

  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
})
