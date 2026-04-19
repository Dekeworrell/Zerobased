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
  notificationsEnabled: boolean
) {
  if (!notificationsEnabled) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_notified_category, last_notified_threshold')
    .eq('id', user.id)
    .single()

  const lastNotifiedCategory = profile?.last_notified_category || ''
  const lastNotifiedThreshold = profile?.last_notified_threshold || 0

  for (const cat of categories) {
    if (cat.category_type === 'fixed') continue

    const spent = transactions
      .filter((t: any) => t.category_id === cat.id)
      .reduce((sum: number, t: any) => sum + t.amount, 0)

    const budgeted = parseFloat(cat.budgeted_amount) || 0
    if (budgeted === 0) continue

    const percentUsed = (spent / budgeted) * 100

    let thresholdReached = 0
    if (percentUsed >= 100) thresholdReached = 100
    else if (notifyAt2 && percentUsed >= notifyAt2) thresholdReached = notifyAt2
    else if (notifyAt1 && percentUsed >= notifyAt1) thresholdReached = notifyAt1

    if (thresholdReached === 0) continue

    // Skip if already notified for this category + threshold combo
    if (lastNotifiedCategory === cat.id && lastNotifiedThreshold >= thresholdReached) continue

    // Fire the notification
    if (thresholdReached >= 100) {
      const overPercent = percentUsed - 100
      if (overPercent > 0) {
        await scheduleBudgetOver(cat.label, overPercent)
      } else {
        await scheduleBudgetFull(cat.label)
      }
    } else {
      await scheduleBudgetWarning(cat.label, percentUsed, thresholdReached)
    }

    // Save that we notified for this category + threshold
    await supabase.from('profiles').update({
      last_notified_category: cat.id,
      last_notified_threshold: thresholdReached,
    }).eq('id', user.id)

    break // One notification per transaction save to avoid spam
  }
}