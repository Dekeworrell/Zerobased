import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

const OWNER_EMAIL = 'Dekeworrell@shaw.ca'

type AffiliateRow = {
  id: string
  name: string
  email: string
  referral_code: string
  status: string
  tier: string
  commission_rate: number
  applied_at: string
  approved_at: string | null
  stripe_account_id: string | null
  total_conversions: number
  total_earned: number
  total_paid: number
  pending_payout: number
}

type Stats = {
  subscribers: { free: number; pro: number; total: number }
  mrr: number
  affiliates: AffiliateRow[]
  recent_conversions: any[]
  total_commissions_pending: number
}

export default function AdminScreen() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [payoutAmounts, setPayoutAmounts] = useState<Record<string, string>>({})
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      loadStats()
    }, [])
  )

  async function loadStats() {
    setLoading(true)
    setError('')
    setActionMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        setAuthorized(false)
        setLoading(false)
        return
      }

      setAuthorized(true)

      const { data, error: fnErr } = await supabase.functions.invoke('admin-get-stats')
      if (fnErr || data?.error) throw new Error(data?.error ?? fnErr?.message)
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleManage(affiliateId: string, action: string, extra: Record<string, any> = {}) {
    setActionLoading(affiliateId + action)
    setActionMessage('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('admin-manage-affiliate', {
        body: { action, affiliate_id: affiliateId, ...extra },
      })
      if (fnErr || data?.error) throw new Error(data?.error ?? fnErr?.message)
      setActionMessage(`✅ ${action} successful`)
      await loadStats()
    } catch (err: any) {
      setActionMessage(`❌ ${err.message}`)
    }
    setActionLoading(null)
  }

  function formatCAD(amount: number) {
    return `$${amount.toFixed(2)}`
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function statusColor(status: string) {
    if (status === 'approved') return Colors.success
    if (status === 'pending') return Colors.warning
    if (status === 'rejected' || status === 'suspended') return Colors.danger
    return Colors.textSecondary
  }

  const tierLabel: Record<string, string> = {
    standard: 'Standard (20%)',
    creator: 'Creator (25%)',
    launch: 'Launch (30%+)',
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={styles.title}>Admin only</Text>
        <Text style={styles.subtitle}>This page is restricted to the account owner.</Text>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const pending = stats?.affiliates.filter(a => a.status === 'pending') ?? []
  const approved = stats?.affiliates.filter(a => a.status === 'approved') ?? []
  const others = stats?.affiliates.filter(a => a.status !== 'pending' && a.status !== 'approved') ?? []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Admin dashboard</Text>
      {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}

      {/* ── Subscriber overview ── */}
      {stats && (
        <>
          <Text style={styles.sectionTitle}>Subscribers</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statBig}>{stats.subscribers.pro}</Text>
              <Text style={styles.statLabel}>Pro</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statBig}>{stats.subscribers.free}</Text>
              <Text style={styles.statLabel}>Free</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statBig}>{stats.subscribers.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { borderColor: Colors.primary }]}>
              <Text style={[styles.statBig, { color: Colors.primary }]}>{formatCAD(stats.mrr)}</Text>
              <Text style={styles.statLabel}>Est. MRR</Text>
            </View>
          </View>

          <View style={styles.commissionSummary}>
            <Text style={styles.commissionSummaryText}>
              💸 Total affiliate commissions pending: <Text style={{ fontWeight: '700', color: Colors.warning }}>{formatCAD(stats.total_commissions_pending)} CAD</Text>
            </Text>
          </View>
        </>
      )}

      {/* ── Pending approvals ── */}
      {pending.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending applications</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pending.length}</Text>
            </View>
          </View>

          {pending.map(aff => (
            <View key={aff.id} style={[styles.affiliateCard, styles.pendingCard]}>
              <View style={styles.affiliateTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.affiliateName}>{aff.name}</Text>
                  <Text style={styles.affiliateMeta}>{aff.email} · Code: <Text style={{ fontWeight: '700' }}>{aff.referral_code}</Text></Text>
                  <Text style={styles.affiliateMeta}>Applied: {formatDate(aff.applied_at)} · Tier: {tierLabel[aff.tier]}</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: Colors.warning }]}>
                  <Text style={[styles.statusText, { color: Colors.warning }]}>Pending</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.approveBtn, actionLoading === aff.id + 'approve' && styles.btnDisabled]}
                  onPress={() => handleManage(aff.id, 'approve')}
                  disabled={!!actionLoading}
                >
                  {actionLoading === aff.id + 'approve'
                    ? <ActivityIndicator size="small" color={Colors.text} />
                    : <Text style={styles.approveBtnText}>✅ Approve (20%)</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, { backgroundColor: Colors.primary }, actionLoading === aff.id + 'approvecreator' && styles.btnDisabled]}
                  onPress={() => handleManage(aff.id, 'approve', { tier: 'creator', commission_rate: 0.25 })}
                  disabled={!!actionLoading}
                >
                  <Text style={styles.approveBtnText}>⭐ Creator (25%)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, actionLoading === aff.id + 'reject' && styles.btnDisabled]}
                  onPress={() => handleManage(aff.id, 'reject')}
                  disabled={!!actionLoading}
                >
                  {actionLoading === aff.id + 'reject'
                    ? <ActivityIndicator size="small" color={Colors.danger} />
                    : <Text style={styles.rejectBtnText}>✕ Reject</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── Active affiliates ── */}
      {approved.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active affiliates ({approved.length})</Text>
          {approved.map(aff => {
            const isExpanded = expandedAffiliate === aff.id
            return (
              <View key={aff.id} style={styles.affiliateCard}>
                <TouchableOpacity
                  style={styles.affiliateTopRow}
                  onPress={() => setExpandedAffiliate(isExpanded ? null : aff.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.affiliateName}>{aff.name}</Text>
                    <Text style={styles.affiliateMeta}>
                      {aff.referral_code} · {tierLabel[aff.tier]}
                    </Text>
                    <Text style={styles.affiliateMeta}>
                      {aff.total_conversions} conversions · {formatCAD(aff.total_earned)} earned · {formatCAD(aff.pending_payout)} pending
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, color: Colors.textSecondary }}>{isExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <Text style={styles.expandedLabel}>Payout pending: {formatCAD(aff.pending_payout)} CAD</Text>

                    {aff.pending_payout > 0 && (
                      <View style={styles.payoutRow}>
                        <TextInput
                          style={styles.payoutInput}
                          placeholder={formatCAD(aff.pending_payout)}
                          placeholderTextColor={Colors.textSecondary}
                          value={payoutAmounts[aff.id] ?? ''}
                          onChangeText={v => setPayoutAmounts(prev => ({ ...prev, [aff.id]: v }))}
                          keyboardType="decimal-pad"
                        />
                        <TouchableOpacity
                          style={[styles.payoutBtn, actionLoading === aff.id + 'payout' && styles.btnDisabled]}
                          onPress={() => handleManage(aff.id, 'payout', {
                            amount: parseFloat(payoutAmounts[aff.id] ?? aff.pending_payout.toString()),
                          })}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === aff.id + 'payout'
                            ? <ActivityIndicator size="small" color={Colors.text} />
                            : <Text style={styles.payoutBtnText}>Pay</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleManage(aff.id, 'update_commission', { commission_rate: 0.30, tier: 'launch' })}
                    >
                      <Text style={styles.rejectBtnText}>Upgrade to Launch (30%)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          })}
        </>
      )}

      {/* ── Recent conversions ── */}
      {(stats?.recent_conversions ?? []).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent conversions</Text>
          {stats!.recent_conversions.slice(0, 10).map((c: any) => (
            <View key={c.id} style={styles.conversionRow}>
              <View>
                <Text style={styles.conversionName}>{c.affiliates?.name ?? '—'} · {c.affiliates?.referral_code}</Text>
                <Text style={styles.conversionMeta}>{c.plan} · {formatDate(c.converted_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.conversionRevenue}>{formatCAD(Number(c.revenue_amount))} revenue</Text>
                <Text style={styles.conversionCommission}>+{formatCAD(Number(c.commission_amount))} commission</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── Rejected/suspended ── */}
      {others.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>Other applications ({others.length})</Text>
          {others.map(aff => (
            <View key={aff.id} style={[styles.affiliateCard, { opacity: 0.6 }]}>
              <Text style={styles.affiliateName}>{aff.name} — <Text style={{ color: statusColor(aff.status) }}>{aff.status}</Text></Text>
              <Text style={styles.affiliateMeta}>{aff.email} · {aff.referral_code}</Text>
              {aff.status !== 'approved' && (
                <TouchableOpacity
                  style={[styles.approveBtn, { marginTop: 8 }]}
                  onPress={() => handleManage(aff.id, 'approve')}
                >
                  <Text style={styles.approveBtnText}>Re-approve</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#f2f4f2', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  container: { flex: 1, backgroundColor: '#f2f4f2' },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40, maxWidth: 700, alignSelf: 'center', width: '100%', gap: 16 },
  backButton: { marginBottom: 4 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { backgroundColor: Colors.warning, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actionMessage: { fontSize: 14, textAlign: 'center', color: Colors.text },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: '22%', backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  statBig: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  commissionSummary: { backgroundColor: Colors.warning + '18', borderWidth: 1, borderColor: Colors.warning + '44', borderRadius: 10, padding: 14 },
  commissionSummaryText: { fontSize: 14, color: Colors.text },

  // Affiliate cards
  affiliateCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, gap: 12 },
  pendingCard: { borderColor: Colors.warning + '88' },
  affiliateTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  affiliateName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  affiliateMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  approveBtn: { backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rejectBtn: { borderWidth: 1, borderColor: Colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  rejectBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  // Expanded section
  expandedSection: { gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  expandedLabel: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  payoutRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  payoutInput: { flex: 1, backgroundColor: '#f2f4f2', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  payoutBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  payoutBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },

  // Conversions
  conversionRow: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversionName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  conversionMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  conversionRevenue: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  conversionCommission: { fontSize: 12, color: Colors.success },

  error: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
})
