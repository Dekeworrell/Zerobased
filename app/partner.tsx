import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Clipboard, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

const APP_URL = 'https://zerobased.app'
type PartnerTab = 'dashboard' | 'mylink' | 'payouts' | 'resources'

type AffiliateData = {
  id: string; name: string; email: string; referral_code: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  tier: 'standard' | 'creator' | 'launch'
  commission_rate: number; applied_at: string; approved_at: string | null
}

const TIERS = {
  standard: { label: 'Standard', emoji: '📌', rate: '20%', color: '#888',    maxRefs: 10,  nextLabel: 'Silver', nextRate: '25%' },
  creator:  { label: 'Silver',   emoji: '🥈', rate: '25%', color: '#6c63ff', maxRefs: 25,  nextLabel: 'Gold',   nextRate: '30%' },
  launch:   { label: 'Gold',     emoji: '🥇', rate: '30%+', color: '#f59e0b', maxRefs: null, nextLabel: null,    nextRate: null },
}

export default function PartnerScreen() {
  const [loading, setLoading] = useState(true)
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null)
  const [userName, setUserName] = useState('')
  const [activeTab, setActiveTab] = useState<PartnerTab>('dashboard')
  const [conversions, setConversions] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [clickCount, setClickCount] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)
  const [applying, setApplying] = useState(false)
  const [applyName, setApplyName] = useState('')
  const [applyCode, setApplyCode] = useState('')
  const [applyPlatform, setApplyPlatform] = useState('')
  const [applyAudience, setApplyAudience] = useState('')
  const [applyError, setApplyError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => { loadData() }, []))

  async function loadData() {
    setLoading(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      setUserName(user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Partner')

      const { data: aff } = await supabase
        .from('affiliates')
        .select('id, name, email, referral_code, status, tier, commission_rate, applied_at, approved_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (aff) {
        setAffiliate(aff)
        if (aff.status === 'approved') {
          const [clicksRes, convRes, payRes] = await Promise.all([
            supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('affiliate_id', aff.id),
            supabase.from('affiliate_conversions').select('id, plan, commission_amount, revenue_amount, status, converted_at').eq('affiliate_id', aff.id).order('converted_at', { ascending: false }).limit(100),
            supabase.from('affiliate_payouts').select('id, amount, status, requested_at, paid_at').eq('affiliate_id', aff.id).order('requested_at', { ascending: false }),
          ])
          const convData = convRes.data ?? []
          const payData = payRes.data ?? []
          setClickCount(clicksRes.count ?? 0)
          setConversions(convData)
          setPayouts(payData)
          const earned = convData.reduce((s, c) => s + Number(c.commission_amount), 0)
          const paid = payData.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0)
          setTotalEarned(Math.round(earned * 100) / 100)
          setTotalPaid(Math.round(paid * 100) / 100)
        }
      }
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }

  async function handleApply() {
    if (!applyName.trim() || !applyCode.trim()) { setApplyError('Name and referral code are required'); return }
    setApplying(true); setApplyError('')
    try {
      const { data, error } = await supabase.functions.invoke('affiliate-apply', {
        body: { name: applyName.trim(), referral_code: applyCode.trim(), platform_url: applyPlatform.trim() || null, audience_size: applyAudience.trim() || null },
      })
      if (error || data?.error) throw new Error(data?.error ?? error?.message)
      await loadData()
    } catch (err: any) { setApplyError(err.message) }
    setApplying(false)
  }

  function copy(text: string, key: string) {
    Clipboard.setString(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`
  const fmtDate = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  if (loading) return <View style={p.center}><ActivityIndicator size="large" color={Colors.primary} /></View>

  const referralLink = affiliate ? `${APP_URL}/?ref=${affiliate.referral_code}` : ''
  const pendingPayout = Math.max(0, totalEarned - totalPaid)
  const now = new Date()
  const thisMonthConv = conversions.filter(c => {
    const d = new Date(c.converted_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthEarned = thisMonthConv.reduce((s, c) => s + Number(c.commission_amount), 0)
  const refCount = conversions.length
  const convRate = clickCount > 0 ? ((refCount / clickCount) * 100).toFixed(1) : '0.0'
  const tierInfo = affiliate ? (TIERS[affiliate.tier] ?? TIERS.standard) : TIERS.standard
  const progressPct = tierInfo.maxRefs ? Math.min(100, Math.round((refCount / tierInfo.maxRefs) * 100)) : 100
  const toNext = tierInfo.maxRefs ? Math.max(0, tierInfo.maxRefs - refCount + 1) : 0

  const TABS: { key: PartnerTab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'mylink', label: 'My Link' },
    { key: 'payouts', label: 'Payouts' },
    { key: 'resources', label: 'Resources' },
  ]

  // ── Not an affiliate yet ──
  if (!affiliate) {
    return (
      <View style={p.root}>
        <View style={p.header}>
          <View style={p.headerLeft}>
            <Text style={p.logo}>📊 Zerobased</Text>
            <Text style={p.headerSep}>·</Text>
            <Text style={p.headerSub}>Affiliate Portal</Text>
          </View>
          <TouchableOpacity onPress={() => router.replace('/settings')}>
            <Text style={p.link}>← Back</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={p.body} contentContainerStyle={p.bodyInner}>
          <Text style={p.pageTitle}>Become a partner</Text>
          <Text style={p.pageSub}>Share Zerobased and earn commission on every subscriber you refer.</Text>

          <View style={p.tierRow}>
            {[
              { tier: 'standard', desc: 'Great for personal finance enthusiasts', req: 'Any audience size' },
              { tier: 'creator',  desc: 'For established personal finance creators', req: '50k+ followers' },
              { tier: 'launch',   desc: 'Exclusive rate for early launch partners', req: 'By invitation' },
            ].map(t => {
              const info = TIERS[t.tier as keyof typeof TIERS]
              return (
                <View key={t.tier} style={p.tierCard}>
                  <Text style={[p.tierRate, { color: info.color }]}>{info.rate}</Text>
                  <Text style={p.tierName}>{info.emoji} {info.label}</Text>
                  <Text style={p.tierDesc}>{t.desc}</Text>
                  <Text style={p.tierReq}>{t.req}</Text>
                </View>
              )
            })}
          </View>

          <View style={p.formCard}>
            <Text style={p.formTitle}>Apply now</Text>
            {applyError ? <Text style={p.errText}>{applyError}</Text> : null}
            {([
              { label: 'Your name', val: applyName, set: setApplyName, ph: 'Sarah Johnson', caps: 'words' },
              { label: 'Your referral code', val: applyCode, set: (v: string) => setApplyCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '')), ph: 'SARAH20', caps: 'characters', hint: '3–15 letters/numbers. Your followers use this to get a discount.' },
              { label: 'TikTok / Instagram / YouTube (optional)', val: applyPlatform, set: setApplyPlatform, ph: '@yourhandle or URL', caps: 'none' },
              { label: 'Approximate audience size (optional)', val: applyAudience, set: setApplyAudience, ph: 'e.g. 25000', caps: 'none' },
            ] as any[]).map((f: any) => (
              <View key={f.label} style={p.fieldGroup}>
                <Text style={p.fieldLabel}>{f.label}</Text>
                <TextInput style={p.fieldInput} value={f.val} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={Colors.textSecondary} autoCapitalize={f.caps as any} />
                {f.hint ? <Text style={p.fieldHint}>{f.hint}</Text> : null}
              </View>
            ))}
            <TouchableOpacity style={[p.submitBtn, applying && p.btnDisabled]} onPress={handleApply} disabled={applying}>
              {applying ? <ActivityIndicator color={Colors.text} /> : <Text style={p.submitBtnText}>Submit application</Text>}
            </TouchableOpacity>
          </View>

          {error ? <Text style={p.errText}>{error}</Text> : null}
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    )
  }

  // ── Pending ──
  if (affiliate.status === 'pending') {
    return (
      <View style={p.center}>
        <Text style={{ fontSize: 48 }}>⏳</Text>
        <Text style={p.pageTitle}>Application submitted!</Text>
        <Text style={[p.pageSub, { textAlign: 'center', maxWidth: 320 }]}>
          We'll review and get back to you within 2–3 business days.{'\n'}Code: {affiliate.referral_code}
        </Text>
        <TouchableOpacity onPress={() => router.replace('/settings')}>
          <Text style={p.link}>← Back to app</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Rejected / suspended ──
  if (affiliate.status === 'rejected' || affiliate.status === 'suspended') {
    return (
      <View style={p.center}>
        <Text style={{ fontSize: 48 }}>❌</Text>
        <Text style={p.pageTitle}>Application not approved</Text>
        <Text style={[p.pageSub, { textAlign: 'center', maxWidth: 320 }]}>
          Thank you for applying. Feel free to reach out with any questions.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/settings')}>
          <Text style={p.link}>← Back to app</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Approved — full portal ──
  return (
    <View style={p.root}>
      <View style={p.header}>
        <View style={p.headerLeft}>
          <Text style={p.logo}>📊 Zerobased</Text>
          <Text style={p.headerSep}>·</Text>
          <Text style={p.headerSub}>Affiliate Portal</Text>
        </View>
        <View style={p.headerRight}>
          <Text style={p.userChip}>{affiliate.name} ▾</Text>
          <TouchableOpacity onPress={() => router.replace('/settings')}>
            <Text style={p.link}>← App</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={p.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[p.tab, activeTab === t.key && p.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[p.tabText, activeTab === t.key && p.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={p.body} contentContainerStyle={p.bodyInner}>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <View style={p.section}>
            <View>
              <Text style={p.pageTitle}>👋 Welcome back, {affiliate.name}</Text>
              <View style={p.codeBar}>
                <Text style={p.codeBarText}>Your unique code: </Text>
                <Text style={p.codeBarCode}>{affiliate.referral_code}</Text>
                <TouchableOpacity onPress={() => copy(affiliate.referral_code, 'code')}>
                  <Text style={p.copyInline}>{copied === 'code' ? '✅' : '📋'}</Text>
                </TouchableOpacity>
                <Text style={p.codeBarText}>  Link: </Text>
                <Text style={p.codeBarLink} numberOfLines={1}>{referralLink}</Text>
                <TouchableOpacity onPress={() => copy(referralLink, 'link')}>
                  <Text style={p.copyInline}>{copied === 'link' ? '✅' : '📋'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={p.statRow}>
              <View style={p.statCard}>
                <Text style={p.statLabel}>This Month</Text>
                <Text style={p.statValue}>{fmt(thisMonthEarned)}</Text>
                <Text style={p.statSub}>{thisMonthConv.length} signups</Text>
              </View>
              <View style={p.statCard}>
                <Text style={p.statLabel}>Pending Payout</Text>
                <Text style={[p.statValue, { color: '#f59e0b' }]}>{fmt(pendingPayout)}</Text>
                <Text style={p.statSub}>Pays 1st of month</Text>
              </View>
              <View style={p.statCard}>
                <Text style={p.statLabel}>All Time Earned</Text>
                <Text style={[p.statValue, { color: '#22c55e' }]}>{fmt(totalEarned)}</Text>
                <Text style={p.statSub}>{refCount} signups total</Text>
              </View>
            </View>

            <View style={p.tierCard2}>
              <View style={p.tierCard2Top}>
                <Text style={p.tierCard2Title}>{tierInfo.emoji} {tierInfo.label} — {tierInfo.rate} commission</Text>
                {toNext > 0 && tierInfo.nextLabel && (
                  <Text style={p.tierCard2Next}>{toNext} more referrals to reach {tierInfo.nextLabel} ({tierInfo.nextRate})</Text>
                )}
              </View>
              <View style={p.progressTrack}>
                <View style={[p.progressBar, { width: (progressPct + '%') as any, backgroundColor: tierInfo.color }]} />
              </View>
              <Text style={p.progressLabel}>{refCount} / {tierInfo.maxRefs ?? refCount} referrals</Text>
            </View>

            <Text style={p.secLabel}>Recent Signups</Text>
            <View style={p.tableCard}>
              {conversions.length === 0 ? (
                <View style={p.emptyBox}><Text style={p.emptyText}>No conversions yet — share your link!</Text></View>
              ) : (
                <>
                  <View style={[p.tableRow, p.tableHead]}>
                    <Text style={[p.cell, { flex: 2 }]}>Subscriber</Text>
                    <Text style={p.cell}>Date</Text>
                    <Text style={p.cell}>Plan</Text>
                    <Text style={p.cell}>Revenue</Text>
                    <Text style={p.cell}>Commission</Text>
                  </View>
                  {conversions.slice(0, 5).map(c => (
                    <View key={c.id} style={p.tableRow}>
                      <Text style={[p.cell, { flex: 2, color: Colors.textSecondary }]}>••••@••••.com</Text>
                      <Text style={p.cell}>{fmtDate(c.converted_at)}</Text>
                      <Text style={p.cell}>{c.plan}</Text>
                      <Text style={p.cell}>{fmt(Number(c.revenue_amount))}</Text>
                      <Text style={[p.cell, { color: '#22c55e', fontWeight: '700' }]}>+{fmt(Number(c.commission_amount))}</Text>
                    </View>
                  ))}
                  {conversions.length > 5 && (
                    <TouchableOpacity style={p.viewAll} onPress={() => setActiveTab('payouts')}>
                      <Text style={p.viewAllText}>View all {conversions.length} conversions →</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* ── MY LINK ── */}
        {activeTab === 'mylink' && (
          <View style={p.section}>
            <Text style={p.pageTitle}>Your Referral Tools</Text>

            <View style={p.linkCard}>
              <Text style={p.linkCardLabel}>Your Link</Text>
              <View style={p.linkRow}>
                <Text style={p.linkText} numberOfLines={1}>{referralLink}</Text>
                <TouchableOpacity style={p.copyBtn} onPress={() => copy(referralLink, 'reflink')}>
                  <Text style={p.copyBtnText}>{copied === 'reflink' ? '✅ Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={p.linkCard}>
              <Text style={p.linkCardLabel}>Your Code</Text>
              <View style={p.linkRow}>
                <Text style={[p.linkText, { fontSize: 22, fontWeight: '800', letterSpacing: 3 }]}>{affiliate.referral_code}</Text>
                <TouchableOpacity style={p.copyBtn} onPress={() => copy(affiliate.referral_code, 'refcode')}>
                  <Text style={p.copyBtnText}>{copied === 'refcode' ? '✅ Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
              <View style={p.infoBox}>
                <Text style={p.infoText}>ℹ️ Your code gives new users a discount on their first month automatically.</Text>
              </View>
            </View>

            <View style={p.linkCard}>
              <Text style={p.linkCardLabel}>Link Performance</Text>
              <View style={p.perfRow}>
                <View style={p.perfItem}>
                  <Text style={p.perfVal}>{clickCount.toLocaleString()}</Text>
                  <Text style={p.perfLabel}>Clicks</Text>
                </View>
                <View style={p.perfDivider} />
                <View style={p.perfItem}>
                  <Text style={p.perfVal}>{refCount}</Text>
                  <Text style={p.perfLabel}>Signups</Text>
                </View>
                <View style={p.perfDivider} />
                <View style={p.perfItem}>
                  <Text style={p.perfVal}>{convRate}%</Text>
                  <Text style={p.perfLabel}>Conversion</Text>
                </View>
              </View>
            </View>

            <Text style={p.secLabel}>Resources</Text>
            <View style={p.resourceCard}>
              {[
                { icon: '📥', label: 'Download media kit', sub: 'Logos, banners, app icons' },
                { icon: '📋', label: 'TikTok caption templates', sub: 'Copy-paste scripts for your videos' },
                { icon: '🖼️', label: 'App screenshots', sub: 'High-res screenshots for reviews' },
              ].map(r => (
                <TouchableOpacity key={r.label} style={p.resourceRow}>
                  <Text style={{ fontSize: 20 }}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={p.resourceLabel}>{r.label}</Text>
                    <Text style={p.resourceSub}>{r.sub}</Text>
                  </View>
                  <Text style={{ color: Colors.primary, fontWeight: '600' }}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── PAYOUTS ── */}
        {activeTab === 'payouts' && (
          <View style={p.section}>
            <Text style={p.pageTitle}>Payouts</Text>

            <View style={p.nextPayCard}>
              <Text style={p.nextPayLabel}>Next Payout</Text>
              <Text style={p.nextPayAmt}>{fmt(pendingPayout)} CAD</Text>
              <Text style={p.nextPaySub}>Arrives 1st of next month · Paid to: Stripe</Text>
            </View>

            <Text style={p.secLabel}>All Conversions</Text>
            <View style={p.tableCard}>
              {conversions.length === 0 ? (
                <View style={p.emptyBox}><Text style={p.emptyText}>No conversions yet</Text></View>
              ) : (
                <>
                  <View style={[p.tableRow, p.tableHead]}>
                    <Text style={p.cell}>Date</Text>
                    <Text style={p.cell}>Plan</Text>
                    <Text style={p.cell}>Revenue</Text>
                    <Text style={p.cell}>Commission</Text>
                    <Text style={p.cell}>Status</Text>
                  </View>
                  {conversions.map(c => (
                    <View key={c.id} style={p.tableRow}>
                      <Text style={p.cell}>{fmtDate(c.converted_at)}</Text>
                      <Text style={p.cell}>{c.plan}</Text>
                      <Text style={p.cell}>{fmt(Number(c.revenue_amount))}</Text>
                      <Text style={[p.cell, { color: '#22c55e', fontWeight: '700' }]}>+{fmt(Number(c.commission_amount))}</Text>
                      <Text style={[p.cell, { color: c.status === 'paid' ? '#22c55e' : '#f59e0b' }]}>
                        {c.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <Text style={p.secLabel}>Payout History</Text>
            <View style={p.tableCard}>
              {payouts.length === 0 ? (
                <View style={p.emptyBox}><Text style={p.emptyText}>No payouts yet</Text></View>
              ) : (
                <>
                  <View style={[p.tableRow, p.tableHead]}>
                    <Text style={p.cell}>Date</Text>
                    <Text style={p.cell}>Amount</Text>
                    <Text style={p.cell}>Status</Text>
                  </View>
                  {payouts.map((pay: any) => (
                    <View key={pay.id} style={p.tableRow}>
                      <Text style={p.cell}>{fmtDate(pay.paid_at ?? pay.requested_at)}</Text>
                      <Text style={[p.cell, { fontWeight: '700' }]}>{fmt(Number(pay.amount))}</Text>
                      <Text style={[p.cell, { color: pay.status === 'paid' ? '#22c55e' : '#f59e0b' }]}>
                        {pay.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <View style={p.infoBox}>
              <Text style={p.infoText}>⚠️ Minimum payout threshold: $50.00 CAD. Payouts process net-30 on the 1st of each month.</Text>
            </View>
          </View>
        )}

        {/* ── RESOURCES ── */}
        {activeTab === 'resources' && (
          <View style={p.section}>
            <Text style={p.pageTitle}>Resources</Text>
            <View style={p.resourceCard}>
              {[
                { icon: '📥', label: 'Download media kit', sub: 'Logos, banners, app icons' },
                { icon: '📋', label: 'TikTok caption templates', sub: 'Copy-paste scripts for your videos' },
                { icon: '🖼️', label: 'App screenshots', sub: 'High-res screenshots for reviews' },
                { icon: '📧', label: 'Email swipe copy', sub: 'Newsletter templates for your list' },
                { icon: '📊', label: 'Promo graphics pack', sub: 'Instagram story and post templates' },
              ].map(r => (
                <TouchableOpacity key={r.label} style={p.resourceRow}>
                  <Text style={{ fontSize: 20 }}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={p.resourceLabel}>{r.label}</Text>
                    <Text style={p.resourceSub}>{r.sub}</Text>
                  </View>
                  <Text style={{ color: Colors.primary, fontWeight: '600' }}>Download</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={p.linkCard}>
              <Text style={p.linkCardLabel}>Getting started tips</Text>
              <Text style={{ fontSize: 14, color: Colors.text, lineHeight: 24 }}>
                {'1. Share your link in your bio or pinned post.\n2. Mention the app in your budgeting content.\n3. Use your code in captions — followers get a discount.\n4. Check your dashboard weekly to track signups.'}
              </Text>
            </View>
          </View>
        )}

        {error ? <Text style={p.errText}>{error}</Text> : null}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  )
}

const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6fa' },
  center: { flex: 1, backgroundColor: '#f5f6fa', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { fontSize: 16, fontWeight: '800', color: Colors.text },
  headerSep: { fontSize: 16, color: Colors.textSecondary },
  headerSub: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  userChip: { fontSize: 14, fontWeight: '600', color: Colors.text },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 20 },
  tab: { paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  body: { flex: 1 },
  bodyInner: { maxWidth: 900, alignSelf: 'center', width: '100%', padding: 28, gap: 20 },
  section: { gap: 16 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  pageSub: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  secLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  codeBar: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  codeBarText: { fontSize: 14, color: Colors.textSecondary },
  codeBarCode: { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 1 },
  codeBarLink: { fontSize: 14, color: Colors.primary, maxWidth: 260 },
  copyInline: { fontSize: 16 },
  statRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 160, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, gap: 4 },
  statLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 26, fontWeight: '800', color: Colors.text },
  statSub: { fontSize: 12, color: Colors.textSecondary },
  tierCard2: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, gap: 10 },
  tierCard2Top: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  tierCard2Title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  tierCard2Next: { fontSize: 13, color: Colors.textSecondary },
  progressTrack: { height: 10, backgroundColor: '#f1f2f4', borderRadius: 5, overflow: 'hidden' },
  progressBar: { height: '100%' as any, borderRadius: 5 },
  progressLabel: { fontSize: 12, color: Colors.textSecondary },
  tableCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  tableHead: { backgroundColor: '#f9fafb' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f2f4', alignItems: 'center' },
  cell: { flex: 1, fontSize: 13, color: Colors.text },
  emptyBox: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  viewAll: { padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f2f4' },
  viewAllText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  linkCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 20, gap: 12 },
  linkCardLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '600' },
  copyBtn: { backgroundColor: Colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  copyBtnText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  infoBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, padding: 12 },
  infoText: { fontSize: 13, color: '#1d4ed8', lineHeight: 20 },
  perfRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  perfItem: { alignItems: 'center', gap: 4 },
  perfVal: { fontSize: 22, fontWeight: '800', color: Colors.text },
  perfLabel: { fontSize: 12, color: Colors.textSecondary },
  perfDivider: { width: 1, backgroundColor: '#e5e7eb' },
  resourceCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  resourceRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f2f4' },
  resourceLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  resourceSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  nextPayCard: { backgroundColor: Colors.primary + '14', borderWidth: 1.5, borderColor: Colors.primary + '55', borderRadius: 12, padding: 20, gap: 6 },
  nextPayLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextPayAmt: { fontSize: 32, fontWeight: '800', color: Colors.text },
  nextPaySub: { fontSize: 13, color: Colors.textSecondary },
  tierRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  tierCard: { flex: 1, minWidth: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, gap: 4 },
  tierRate: { fontSize: 28, fontWeight: '800' },
  tierName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  tierDesc: { fontSize: 13, color: Colors.textSecondary },
  tierReq: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  formCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 24, gap: 14 },
  formTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  fieldInput: { backgroundColor: '#f5f6fa', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.text },
  fieldHint: { fontSize: 12, color: Colors.textSecondary },
  submitBtn: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
  errText: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
})
