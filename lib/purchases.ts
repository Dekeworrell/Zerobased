import { Platform } from 'react-native'

// React Native Purchases is a native-only module — all entry points guard web.
// On web, every function returns safe defaults so the app stays functional.
let RC: typeof import('react-native-purchases').default | null = null
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RC = require('react-native-purchases').default
}

const RC_API_KEY = 'appl_ZjIQHUWSoAvCiHIfVeeYnzwmTLz'

export function initRevenueCat(userId?: string): void {
  if (!RC) return
  RC.setLogLevel(require('react-native-purchases').LOG_LEVEL.WARN)
  RC.configure({ apiKey: RC_API_KEY })
  if (userId) {
    RC.logIn(userId).catch(() => {})
  }
}

export async function getSubscriptionTier(): Promise<'free' | 'pro'> {
  if (!RC) return 'free'
  try {
    const info = await RC.getCustomerInfo()
    return info.entitlements.active['pro'] ? 'pro' : 'free'
  } catch {
    return 'free'
  }
}

export async function purchaseMonthly(): Promise<'free' | 'pro'> {
  if (!RC) throw new Error('Purchases not available on this platform')
  const offerings = await RC.getOfferings()
  const pkg = offerings.current?.availablePackages.find(
    p => p.product.identifier === 'monthly'
  )
  if (!pkg) throw new Error('Monthly plan not available. Please try again.')
  const { customerInfo } = await RC.purchasePackage(pkg)
  return customerInfo.entitlements.active['pro'] ? 'pro' : 'free'
}

export async function purchaseAnnual(): Promise<'free' | 'pro'> {
  if (!RC) throw new Error('Purchases not available on this platform')
  const offerings = await RC.getOfferings()
  const pkg = offerings.current?.availablePackages.find(
    p => p.product.identifier === 'yearly'
  )
  if (!pkg) throw new Error('Annual plan not available. Please try again.')
  const { customerInfo } = await RC.purchasePackage(pkg)
  return customerInfo.entitlements.active['pro'] ? 'pro' : 'free'
}

export async function restorePurchases(): Promise<'free' | 'pro'> {
  if (!RC) return 'free'
  const info = await RC.restorePurchases()
  return info.entitlements.active['pro'] ? 'pro' : 'free'
}
