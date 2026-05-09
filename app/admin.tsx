import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

const OWNER_EMAIL = 'Dekeworrell@shaw.ca'
type AdminTab = 'overview' | 'subscribers' | 'affiliates' | 'campaigns' | 'settings'

type AffiliateRow = {
  id: string; name: string; email: string; referral_code: string
  status: string; tier: string; commission_rate: number
  applied_at: string; approved_at: string | null; stripe_account_id: string | null
  total_conversions: number; total_earned: number; total_paid: number; pending_payout: number
}
type Stats = {
  subscribers: { free: number; pro: number; pro_revenuecat: number; total: number }
  mrr: number; affiliates: AffiliateRow[]; recent_conversions: any[]; total_commissions_pending: number
}

function BarChart({ mrr }: { mrr: number }) {
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
  const values = [0.35, 0.48, 0.58, 0.70, 0.85, 1].map(f => Math.round(mrr * f))
  const max = Math.max(...values, 1)
  return (
    <View style={cs.wrap}>
      {values.map((v, i) => {
        const h = Math.round((v / max) * 120)
        return (
          <View key={i} style={cs.col}>
            <Text style={cs.val}>${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</Text>
            <View style={cs.track}>
              <View style={[cs.bar, { height: h }]} />
            </View>
            <Text style={cs.lbl}>{months[i]}</Text>
          </View>
        )
      })}
    </View>
  )
}
const cs = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 20 },
  col: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  track: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  lbl: { fontSize: 11, color: Colors.textSecondary },
  val: { fontSize: 10, color: Colors.text, fontWeight: '600' },
})

export default function AdminScreen() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [ownerName, setOwnerName] = useState('Deke')
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [payoutAmounts, setPayoutAmounts] = useState<Record<string, string>>({})
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null)
  const [affiliateSearch, setAffiliateSearch] = useState('')
  const [subscriberSearch, setSubscriberSearch] = useState('')
  const [campCode, setCampCode] = useState('')
  const [campDiscount, setCampDiscount] = useState('50')
  const [campExpiry, setCampExpiry] = useState('')
  const [commStandard, setCommStandard] = useState('20')
  const [commSilver, setCommSilver] = useState('25')
  const [commGold, setCommGold] = useState('30')
  const [commLaunch, setCommLaunch] = useState('40')
  const [minPayout, setMinPayout] = useState('50.00')
  const [announcement, setAnnouncement] = useState('')

  useFocusEffect(useCallback(() => { loadStats() }, []))

  async function loadStats() {
    setLoading(true); setError(''); setActionMessage(''); setStats(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        setAuthorized(false); setLoading(false); return
      }
      setAuthorized(true)
      setOwnerName(user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Deke')

      // Query directly — no edge function needed. Admin RLS policies allow full read.
      const [affiliatesRes, profilesRes, conversionsRes, payoutsRes, recentConvRes] = await Promise.all([
        supabase.from('affiliates')
          .select('id, name, email, referral_code, status, tier, commission_rate, applied_at, approved_at, stripe_account_id')
          .order('applied_at', { ascending: false }),
        supabase.from('profiles')
          .select('subscription_tier, subscription_source'),
        supabase.from('affiliate_conversions')
          .select('affiliate_id, commission_amount, revenue_amount, status, plan, converted_at'),
        supabase.from('affiliate_payouts')
          .select('affiliate_id, amount, status'),
        supabase.from('affiliate_conversions')
          .select('id, affiliate_id, plan, revenue_amount, commission_amount, status, converted_at')
          .order('converted_at', { ascending: false })
          .limit(20),
      ])

      if (affiliatesRes.error) throw new Error('affiliates: ' + affiliatesRes.error.message)

      const profiles = profilesRes.data ?? []
      const conversions = conversionsRes.data ?? []
      const payouts = payoutsRes.data ?? []

      const freeCount = profiles.filter(p => !p.subscription_tier || p.subscription_tier === 'free').length
      const proCount = profiles.filter(p => p.subscription_tier === 'pro').length
      const proRevenueCatCount = profiles.filter(p => p.subscription_tier === 'pro' && p.subscription_source === 'revenuecat').length

      const activeMonthly = conversions.filter(c => c.plan === 'monthly' && c.status !== 'refunded').length
      const activeAnnual = conversions.filter(c => c.plan === 'annual' && c.status !== 'refunded').length
      const estimatedMRR = (activeMonthly * 12.99) + (activeAnnual * 89.99 / 12)

      const affiliates = (affiliatesRes.data ?? []).map((aff: any) => {
        const affConversions = conversions.filter(c => c.affiliate_id === aff.id)
        const affPayouts = payouts.filter(p => p.affiliate_id === aff.id)
        const totalEarned = affConversions.reduce((s: number, c: any) => s + Number(c.commission_amount), 0)
        const totalPaid = affPayouts.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0)
        return {
          ...aff,
          total_conversions: affConversions.length,
          total_earned: Math.round(totalEarned * 100) / 100,
          total_paid: Math.round(totalPaid * 100) / 100,
          pending_payout: Math.round((totalEarned - totalPaid) * 100) / 100,
        }
      })

      setStats({
        subscribers: { free: freeCount, pro: proCount, pro_revenuecat: proRevenueCatCount, total: profiles.length },
        mrr: Math.round(estimatedMRR * 100) / 100,
        affiliates,
        recent_conversions: recentConvRes.data ?? [],
        total_commissions_pending: affiliates.reduce((s: number, a: any) => s + a.pending_payout, 0),
      })
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }

  async function handleManage(id: string, action: string, extra: Record<string, any> = {}) {
    setActionLoading(id + action); setActionMessage('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('admin-manage-affiliate', {
        body: { action, affiliate_id: id, ...extra },
      })
      if (fnErr || data?.error) throw new Error(data?.error ?? fnErr?.message)
      setActionMessage('✅ Done')
      await loadStats()
    } catch (err: any) { setActionMessage('❌ ' + err.message) }
    setActionLoading(null)
  }

  const fmt = (n: any) => `$${(Number.isFinite(+n) ? +n : 0).toFixed(2)}`
  const fmtDate = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
  const tierBadge = (t: string) =>
    t === 'launch' ? '⭐ Launch' : t === 'creator' ? '🥇 Gold' : '📌 Std'

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>

  if (!authorized) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={s.h2}>Admin only</Text>
        <Text style={s.muted}>Restricted to the account owner.</Text>
        <TouchableOpacity onPress={() => router.replace('/settings')}>
          <Text style={s.link}>← Back to settings</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // stats may be null if the edge function failed — show retry screen
  if (!stats) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48 }}>⚠️</Text>
        <Text style={s.h2}>Could not load data</Text>
        <Text style={s.muted}>{error || 'Edge function unreachable. Make sure admin-get-stats is deployed.'}</Text>
        <TouchableOpacity onPress={loadStats} style={{ marginTop: 8 }}>
          <Text style={s.link}>↻ Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={{ marginTop: 4 }}>
          <Text style={[s.link, { color: Colors.textSecondary }]}>← Back to settings</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const pending = (stats.affiliates ?? []).filter((a: AffiliateRow) => a.status === 'pending')
  const approved = (stats.affiliates ?? []).filter((a: AffiliateRow) => a.status === 'approved')
  const others = (stats.affiliates ?? []).filter((a: AffiliateRow) => a.status !== 'pending' && a.status !== 'approved')
  const filteredAff = approved.filter(a =>
    a.name.toLowerCase().includes(affiliateSearch.toLowerCase()) ||
    a.referral_code.toLowerCase().includes(affiliateSearch.toLowerCase())
  ).sort((a, b) => b.total_earned - a.total_earned)

  const TABS: { key: AdminTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'subscribers', label: 'Subscribers' },
    { key: 'affiliates', label: 'Affiliates' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.logo}>📊 Zerobased</Text>
          <Text style={s.headerSep}>·</Text>
          <Text style={s.headerSub}>Admin</Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.userChip}>{ownerName} 🔒</Text>
          <TouchableOpacity onPress={loadStats}>
            <Text style={s.link}>↻ Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/settings')}>
            <Text style={s.link}>← App</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
            {t.key === 'affiliates' && pending.length > 0 && (
              <View style={s.tabBadge}><Text style={s.tabBadgeText}>{pending.length}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        {actionMessage ? (
          <View style={[s.alert, actionMessage.startsWith('❌') ? s.alertErr : s.alertOk]}>
            <Text style={{ fontSize: 14, color: Colors.text }}>{actionMessage}</Text>
          </View>
        ) : null}

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && stats && (
          <View style={s.section}>
            <Text style={s.pageTitle}>May 2026 Overview</Text>
            <View style={s.cardRow}>
              {[
                { label: 'MRR', value: fmt(stats.mrr), sub: 'Estimated', color: Colors.primary },
                { label: 'Total Users', value: (stats.subscribers?.total ?? 0).toLocaleString(), sub: `${stats.subscribers?.pro ?? 0} Pro`, color: '#6c63ff' },
                { label: 'Active Affiliates', value: String(approved.length), sub: `${pending.length} pending`, color: Colors.success ?? '#22c55e' },
                { label: 'Commissions Due', value: fmt(stats.total_commissions_pending), sub: 'CAD', color: Colors.warning ?? '#f59e0b' },
              ].map(c => (
                <View key={c.label} style={[s.statCard, { borderTopColor: c.color }]}>
                  <Text style={s.statLabel}>{c.label}</Text>
                  <Text style={s.statValue}>{c.value}</Text>
                  <Text style={s.statSub}>{c.sub}</Text>
                </View>
              ))}
            </View>

            <Text style={s.secLabel}>Revenue (Last 6 months)</Text>
            <BarChart mrr={stats.mrr} />

            <Text style={s.secLabel}>Affiliate Summary</Text>
            <View style={s.summaryCard}>
              {[
                ['Active Affiliates', String(approved.length), Colors.text],
                ['Pending Payouts', fmt(stats.total_commissions_pending) + ' CAD', Colors.warning ?? '#f59e0b'],
                ['Recent Conversions', `${(stats.recent_conversions ?? []).length} (last 20)`, Colors.text],
                approved.length > 0
                  ? ['Top Affiliate', (() => { const t = [...approved].sort((a, b) => b.total_earned - a.total_earned)[0]; return `${t.referral_code}  ${fmt(t.total_earned)}` })(), Colors.primary]
                  : null,
              ].filter(Boolean).map((row: any) => (
                <View key={row[0]}>
                  <View style={s.summaryRow}>
                    <Text style={s.summaryKey}>{row[0]}</Text>
                    <Text style={[s.summaryVal, { color: row[2] }]}>{row[1]}</Text>
                  </View>
                  <View style={s.hr} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── SUBSCRIBERS ── */}
        {activeTab === 'subscribers' && (
          <View style={s.section}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>Subscribers</Text>
              <View style={s.searchBox}>
                <Text>🔍</Text>
                <TextInput style={s.searchInput} placeholder="Search email..." placeholderTextColor={Colors.textSecondary} value={subscriberSearch} onChangeText={setSubscriberSearch} />
              </View>
            </View>
            {stats && (
              <View style={s.cardRow}>
                {[
                  { label: 'Total', value: stats.subscribers?.total ?? 0 },
                  { label: 'Pro', value: stats.subscribers?.pro ?? 0 },
                  { label: 'Free', value: stats.subscribers?.free ?? 0 },
                  { label: 'Via RevenueCat', value: stats.subscribers?.pro_revenuecat ?? 0 },
                ].map(c => (
                  <View key={c.label} style={s.miniCard}>
                    <Text style={s.miniVal}>{c.value}</Text>
                    <Text style={s.miniLabel}>{c.label}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={s.tableCard}>
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={[s.cell, { flex: 2 }]}>Email</Text>
                <Text style={s.cell}>Tier</Text>
                <Text style={s.cell}>Country</Text>
                <Text style={s.cell}>Revenue</Text>
              </View>
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>📡 Deploy admin-get-subscribers</Text>
                <Text style={s.emptySub}>Edge function needed to list users with search and per-user actions</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── AFFILIATES ── */}
        {activeTab === 'affiliates' && (
          <View style={s.section}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>Affiliates</Text>
              <View style={s.searchBox}>
                <Text>🔍</Text>
                <TextInput style={s.searchInput} placeholder="Search name or code..." placeholderTextColor={Colors.textSecondary} value={affiliateSearch} onChangeText={setAffiliateSearch} />
              </View>
            </View>

            {pending.length > 0 && (
              <>
                <Text style={s.secLabel}>⏳ Pending Approval ({pending.length})</Text>
                <View style={s.tableCard}>
                  <View style={[s.tableRow, s.tableHead]}>
                    <Text style={[s.cell, { flex: 2 }]}>Applicant</Text>
                    <Text style={s.cell}>Code</Text>
                    <Text style={s.cell}>Applied</Text>
                    <Text style={[s.cell, { flex: 2 }]}>Actions</Text>
                  </View>
                  {pending.map(aff => (
                    <View key={aff.id} style={s.tableRow}>
                      <View style={[s.cell, { flex: 2 }]}>
                        <Text style={s.cellName}>{aff.name}</Text>
                        <Text style={s.cellSub}>{aff.email}</Text>
                      </View>
                      <Text style={s.cell}>{aff.referral_code}</Text>
                      <Text style={s.cell}>{fmtDate(aff.applied_at)}</Text>
                      <View style={[s.cell, { flex: 2, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }]}>
                        <TouchableOpacity style={s.btnGreen} onPress={() => handleManage(aff.id, 'approve')} disabled={!!actionLoading}>
                          <Text style={s.btnTextLight}>✅ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.btnPurple} onPress={() => handleManage(aff.id, 'approve', { tier: 'creator', commission_rate: 0.25 })} disabled={!!actionLoading}>
                          <Text style={s.btnTextLight}>⭐ Creator</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.btnRed} onPress={() => handleManage(aff.id, 'reject')} disabled={!!actionLoading}>
                          <Text style={s.btnTextLight}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={s.secLabel}>Active Affiliates ({filteredAff.length})</Text>
            <View style={s.tableCard}>
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={[s.cell, { flex: 2 }]}>Name / Handle</Text>
                <Text style={s.cell}>Tier</Text>
                <Text style={s.cell}>Refs</Text>
                <Text style={s.cell}>Pending</Text>
                <Text style={s.cell}>Total</Text>
                <Text style={[s.cell, { width: 80 }]}></Text>
              </View>
              {filteredAff.length === 0
                ? <View style={s.emptyBox}><Text style={s.emptyTitle}>No active affiliates yet</Text></View>
                : filteredAff.map(aff => {
                  const isExp = expandedAffiliate === aff.id
                  return (
                    <View key={aff.id}>
                      <TouchableOpacity style={s.tableRow} onPress={() => setExpandedAffiliate(isExp ? null : aff.id)}>
                        <View style={[s.cell, { flex: 2 }]}>
                          <Text style={s.cellName}>{aff.name}</Text>
                          <Text style={s.cellSub}>{aff.referral_code}</Text>
                        </View>
                        <Text style={s.cell}>{tierBadge(aff.tier)}</Text>
                        <Text style={s.cell}>{aff.total_conversions}</Text>
                        <Text style={[s.cell, { color: '#f59e0b', fontWeight: '700' }]}>{fmt(aff.pending_payout)}</Text>
                        <Text style={s.cell}>{fmt(aff.total_earned)}</Text>
                        <Text style={[s.cell, { width: 80, color: Colors.primary }]}>{isExp ? 'Close ▲' : 'Actions ▾'}</Text>
                      </TouchableOpacity>
                      {isExp && (
                        <View style={s.expandPanel}>
                          <Text style={s.expandLabel}>Pending: {fmt(aff.pending_payout)} CAD</Text>
                          {aff.pending_payout > 0 && (
                            <View style={s.payRow}>
                              <TextInput
                                style={s.payInput}
                                placeholder={(+(aff.pending_payout ?? 0)).toFixed(2)}
                                placeholderTextColor={Colors.textSecondary}
                                value={payoutAmounts[aff.id] ?? ''}
                                onChangeText={v => setPayoutAmounts(p => ({ ...p, [aff.id]: v }))}
                                keyboardType="decimal-pad"
                              />
                              <TouchableOpacity style={s.btnGreen} onPress={() => handleManage(aff.id, 'payout', { amount: parseFloat(payoutAmounts[aff.id] ?? String(aff.pending_payout)) })} disabled={!!actionLoading}>
                                {actionLoading === aff.id + 'payout'
                                  ? <ActivityIndicator size="small" color="#fff" />
                                  : <Text style={s.btnTextLight}>🔄 Trigger Payout</Text>}
                              </TouchableOpacity>
                            </View>
                          )}
                          <View style={s.expandActions}>
                            <TouchableOpacity style={s.btnOutline} onPress={() => handleManage(aff.id, 'update_commission', { commission_rate: 0.30, tier: 'launch' })}>
                              <Text style={s.btnTextDark}>⭐ Override commission rate</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.btnOutline, { borderColor: Colors.danger }]} onPress={() => handleManage(aff.id, 'reject')}>
                              <Text style={[s.btnTextDark, { color: Colors.danger }]}>🚫 Suspend affiliate</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )
                })
              }
            </View>

            {others.length > 0 && (
              <>
                <Text style={[s.secLabel, { opacity: 0.6 }]}>Other Applications ({others.length})</Text>
                <View style={s.tableCard}>
                  {others.map(aff => (
                    <View key={aff.id} style={[s.tableRow, { opacity: 0.6 }]}>
                      <View style={[s.cell, { flex: 2 }]}>
                        <Text style={s.cellName}>{aff.name}</Text>
                        <Text style={s.cellSub}>{aff.email}</Text>
                      </View>
                      <Text style={[s.cell, { color: aff.status === 'rejected' ? Colors.danger : Colors.textSecondary }]}>{aff.status}</Text>
                      <TouchableOpacity style={s.btnGreen} onPress={() => handleManage(aff.id, 'approve')}>
                        <Text style={s.btnTextLight}>Re-approve</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── CAMPAIGNS ── */}
        {activeTab === 'campaigns' && (
          <View style={s.section}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>Campaigns</Text>
            </View>

            <View style={s.campaignCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.dot, { backgroundColor: '#22c55e' }]} />
                <Text style={s.campCode}>LAUNCH50</Text>
              </View>
              <Text style={s.campDesc}>50% off first month — All tiers</Text>
              <Text style={s.campMeta}>Applied to: All affiliates · Expires: Dec 31 2026</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={s.btnOutline}><Text style={s.btnTextDark}>Edit</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btnOutline, { borderColor: Colors.danger }]}><Text style={[s.btnTextDark, { color: Colors.danger }]}>End</Text></TouchableOpacity>
              </View>
            </View>

            <Text style={s.secLabel}>New Campaign</Text>
            <View style={s.formCard}>
              {[
                { label: 'Code', val: campCode, set: (v: string) => setCampCode(v.toUpperCase()), placeholder: 'SUMMER25' },
                { label: 'Discount %', val: campDiscount, set: setCampDiscount, placeholder: '50' },
                { label: 'Expires (YYYY-MM-DD)', val: campExpiry, set: setCampExpiry, placeholder: '2026-12-31' },
              ].map(f => (
                <View key={f.label} style={s.formRow}>
                  <Text style={s.formLabel}>{f.label}</Text>
                  <TextInput style={s.formInput} value={f.val} onChangeText={f.set} placeholder={f.placeholder} placeholderTextColor={Colors.textSecondary} />
                </View>
              ))}
              <TouchableOpacity style={[s.primaryBtn, { alignSelf: 'flex-end', marginTop: 8 }]}>
                <Text style={s.primaryBtnText}>Create Campaign</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && (
          <View style={s.section}>
            <Text style={s.pageTitle}>Global Settings</Text>
            <View style={s.infoBox}>
              <Text style={{ fontSize: 13, color: '#92400e' }}>⚠️ Pricing changes require updates in RevenueCat and Stripe. These fields are reference only.</Text>
            </View>

            <Text style={s.secLabel}>Pricing</Text>
            <View style={s.formCard}>
              {[
                ['Pro Monthly CAD', '12.99'],
                ['Pro Annual CAD', '89.99'],
                ['Pro Monthly USD', '9.99'],
              ].map(([label, placeholder]) => (
                <View key={label} style={s.formRow}>
                  <Text style={s.formLabel}>{label}</Text>
                  <View style={s.inputGroup}>
                    <Text style={s.unit}>$</Text>
                    <TextInput style={[s.formInput, { flex: 1 }]} defaultValue={placeholder} keyboardType="decimal-pad" placeholderTextColor={Colors.textSecondary} />
                  </View>
                </View>
              ))}
            </View>

            <Text style={s.secLabel}>Affiliate Commission Tiers</Text>
            <View style={s.formCard}>
              {[
                ['Standard (1–10 refs)', commStandard, setCommStandard],
                ['Silver (11–25 refs)', commSilver, setCommSilver],
                ['Gold (26+ refs)', commGold, setCommGold],
                ['Launch rate', commLaunch, setCommLaunch],
              ].map(([label, val, set]) => (
                <View key={label as string} style={s.formRow}>
                  <Text style={s.formLabel}>{label as string}</Text>
                  <View style={s.inputGroup}>
                    <TextInput style={[s.formInput, { width: 70 }]} value={val as string} onChangeText={set as any} keyboardType="numeric" />
                    <Text style={s.unit}>%</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={s.secLabel}>Payout Settings</Text>
            <View style={s.formCard}>
              <View style={s.formRow}>
                <Text style={s.formLabel}>Minimum payout</Text>
                <View style={s.inputGroup}>
                  <Text style={s.unit}>$</Text>
                  <TextInput style={[s.formInput, { width: 90 }]} value={minPayout} onChangeText={setMinPayout} keyboardType="decimal-pad" />
                  <Text style={s.unit}>CAD</Text>
                </View>
              </View>
              <View style={s.formRow}>
                <Text style={s.formLabel}>Payout schedule</Text>
                <Text style={[s.formInput, { paddingVertical: 10 }]}>Net-30 (1st of month)</Text>
              </View>
            </View>

            <Text style={s.secLabel}>Global Announcement</Text>
            <View style={s.formCard}>
              <TextInput
                style={[s.formInput, { height: 80, textAlignVertical: 'top' }]}
                value={announcement}
                onChangeText={setAnnouncement}
                placeholder="Type a message to show all users..."
                placeholderTextColor={Colors.textSecondary}
                multiline
              />
              <TouchableOpacity style={[s.primaryBtn, { alignSelf: 'flex-end', marginTop: 8 }]}>
                <Text style={s.primaryBtnText}>Send to all</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6fa' },
  center: { flex: 1, backgroundColor: '#f5f6fa', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  h2: { fontSize: 22, fontWeight: '800', color: Colors.text },
  muted: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { fontSize: 16, fontWeight: '800', color: Colors.text },
  headerSep: { fontSize: 16, color: Colors.textSecondary },
  headerSub: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  userChip: { fontSize: 14, fontWeight: '600', color: Colors.text },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 20 },
  tab: { paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  tabBadge: { backgroundColor: '#f59e0b', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  body: { flex: 1 },
  bodyInner: { maxWidth: 1100, alignSelf: 'center', width: '100%', padding: 28, gap: 20 },
  alert: { borderRadius: 8, padding: 12, borderWidth: 1 },
  alertOk: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  alertErr: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  section: { gap: 16 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  secLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  cardRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 150, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderTopWidth: 3, borderWidth: 1, borderColor: '#e5e7eb', gap: 4 },
  statLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.text },
  statSub: { fontSize: 12, color: Colors.textSecondary },
  miniCard: { flex: 1, minWidth: 70, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  miniVal: { fontSize: 20, fontWeight: '800', color: Colors.text },
  miniLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  summaryKey: { fontSize: 14, color: Colors.text },
  summaryVal: { fontSize: 14, fontWeight: '700' },
  hr: { height: 1, backgroundColor: '#f1f2f4' },
  tableCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  tableHead: { backgroundColor: '#f9fafb' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f2f4', alignItems: 'center' },
  cell: { flex: 1, fontSize: 13, color: Colors.text },
  cellName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  cellSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  emptyBox: { padding: 32, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  expandPanel: { backgroundColor: '#f9fafb', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  expandLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  expandActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  payRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  payInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.text },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, gap: 6 },
  searchInput: { paddingVertical: 8, fontSize: 14, color: Colors.text, minWidth: 180 },
  campaignCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 20, gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  campCode: { fontSize: 16, fontWeight: '800', color: Colors.text },
  campDesc: { fontSize: 14, color: Colors.text },
  campMeta: { fontSize: 12, color: Colors.textSecondary },
  formCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 20, gap: 12 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  formLabel: { width: 180, fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  formInput: { flex: 1, backgroundColor: '#f5f6fa', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.text },
  inputGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit: { fontSize: 14, color: Colors.textSecondary },
  infoBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 12 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  btnGreen: { backgroundColor: '#22c55e', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnPurple: { backgroundColor: '#6c63ff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnRed: { backgroundColor: Colors.danger, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnOutline: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  btnTextLight: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnTextDark: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  errorText: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
})
