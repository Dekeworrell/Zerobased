import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  const token = (await Notifications.getExpoPushTokenAsync()).data

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({ push_token: token }).eq('id', user.id)
  }

  return token
}

export async function scheduleBudgetWarning(
  categoryLabel: string,
  percentUsed: number,
  thresholdPercent: number
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ Budget Warning — ${categoryLabel}`,
      body: `You've used ${percentUsed.toFixed(0)}% of your ${categoryLabel} budget (warning set at ${thresholdPercent}%)`,
      sound: true,
    },
    trigger: null,
  })
}

export async function scheduleBudgetFull(categoryLabel: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🚨 Budget Reached — ${categoryLabel}`,
      body: `You've hit 100% of your ${categoryLabel} budget!`,
      sound: true,
    },
    trigger: null,
  })
}

export async function scheduleBudgetOver(categoryLabel: string, percentOver: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔴 Over Budget — ${categoryLabel}`,
      body: `You're ${percentOver.toFixed(0)}% over your ${categoryLabel} budget!`,
      sound: true,
    },
    trigger: null,
  })
}

export async function schedulePaydayReminder(nextPayday: string) {
  let payday = new Date(nextPayday + 'T09:00:00')
  const now = new Date()

  // If payday already passed, try to advance by the most common cycles
  // until we find a future date
  if (payday <= now) {
    const diff = now.getTime() - payday.getTime()
    const daysPast = Math.ceil(diff / (1000 * 60 * 60 * 24))
    // Advance by 14 days (biweekly) until future
    let advances = 0
    while (payday <= now && advances < 52) {
      payday = new Date(payday.getTime() + 14 * 24 * 60 * 60 * 1000)
      advances++
    }
  }

  if (payday <= now) return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💰 Payday! Update your balances',
      body: 'Tap to update your account balances and start your new pay period.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: payday,
    },
  })
}

export async function checkBudgetAndNotify(
  categories: any[],
  transactions: any[],
  notifyAt1: number,
  notifyAt2: number,
  notificationsEnabled: boolean,
  periodStart?: Date | null,
  periodEnd?: Date | null,
) {
  if (!notificationsEnabled) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_notified_category, last_notified_threshold')
    .eq('id', user.id)
    .single()

  // last_notified_category stores a JSON map: { _period: "2026-05-01", catId: threshold, ... }
  // Legacy format (plain category ID string) is migrated on first write.
  const periodKey = periodStart ? periodStart.toISOString().split('T')[0] : 'all'
  let notifiedMap: Record<string, any> = {}
  try {
    const raw = profile?.last_notified_category || ''
    if (raw.startsWith('{')) {
      notifiedMap = JSON.parse(raw)
    } else if (raw) {
      // Migrate legacy single-category format
      notifiedMap = { _period: periodKey, [raw]: profile?.last_notified_threshold || 0 }
    }
  } catch {}

  // Reset map when a new budget period starts
  if (notifiedMap._period !== periodKey) {
    notifiedMap = { _period: periodKey }
  }

  let mapUpdated = false

  for (const cat of categories) {
    if (cat.category_type === 'fixed') continue

    const spent = transactions
      .filter((t: any) => t.category_id === cat.id)
      .reduce((sum: number, t: any) => sum + t.amount, 0)

    const budgeted = parseFloat(cat.budgeted_amount) || 0
    if (budgeted === 0) continue

    const percentUsed = (spent / budgeted) * 100

    // Build all milestones: user-set alerts + app-programmed 10% increments from 100%.
    const milestoneSet = new Set<number>()
    if (notifyAt1) milestoneSet.add(notifyAt1)
    if (notifyAt2) milestoneSet.add(notifyAt2)
    const highestIncrement = Math.floor(percentUsed / 10) * 10
    for (let t = 100; t <= highestIncrement; t += 10) milestoneSet.add(t)
    const milestones = Array.from(milestoneSet).sort((a, b) => a - b)

    // Find the highest milestone already crossed at the current spend level.
    const crossed = milestones.filter(t => t <= percentUsed)
    if (crossed.length === 0) continue
    const thresholdToFire = crossed[crossed.length - 1]

    // Only fire if this is a new high — i.e. not yet notified at this level this period.
    const alreadyNotified: number = notifiedMap[cat.id] || 0
    if (thresholdToFire <= alreadyNotified) continue

    if (thresholdToFire > 100) {
      await scheduleBudgetOver(cat.label, percentUsed - 100)
    } else if (thresholdToFire === 100) {
      await scheduleBudgetFull(cat.label)
    } else {
      await scheduleBudgetWarning(cat.label, percentUsed, thresholdToFire)
    }

    notifiedMap[cat.id] = thresholdToFire
    mapUpdated = true
  }

  if (mapUpdated) {
    await supabase.from('profiles').update({
      last_notified_category: JSON.stringify(notifiedMap),
      last_notified_threshold: 0,
    }).eq('id', user.id)
  }
}