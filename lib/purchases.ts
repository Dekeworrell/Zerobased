import { Platform } from 'react-native'

let RC: typeof import('react-native-purchases').default | null = null
if (Platform.OS !== 'web') {
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

export async function getOfferings(): Promise<{
  monthlyPrice: string
  annualPrice: string
  currencyCode: string
} | null> {
  if (!RC) return null
  try {
    const { PACKAGE_TYPE } = require('react-native-purchases')
    const offerings = await RC.getOfferings()
    const packages = offerings.current?.availablePackages ?? []
    const monthly = packages.find(p => p.packageType === PACKAGE_TYPE.MONTHLY)
    const annual = packages.find(p => p.packageType === PACKAGE_TYPE.ANNUAL)
    return {
      monthlyPrice: monthly?.product.priceString ?? '$12.99',
      annualPrice: annual?.product.priceString ?? '$89.99',
      currencyCode: monthly?.product.currencyCode ?? 'CAD',
    }
  } catch {
    return null
  }
}

export async function purchaseMonthly(): Promise<'free' | 'pro'> {
  if (!RC) throw new Error('Purchases not available on this platform')
  const { PACKAGE_TYPE } = require('react-native-purchases')
  const offerings = await RC.getOfferings()
  const pkg = offerings.current?.availablePackages.find(
    p => p.packageType === PACKAGE_TYPE.MONTHLY
  )
  if (!pkg) throw new Error('Monthly plan not available. Please try again.')
  const { customerInfo } = await RC.purchasePackage(pkg)
  return customerInfo.entitlements.active['pro'] ? 'pro' : 'free'
}

export async function purchaseAnnual(): Promise<'free' | 'pro'> {
  if (!RC) throw new Error('Purchases not available on this platform')
  const { PACKAGE_TYPE } = require('react-native-purchases')
  const offerings = await RC.getOfferings()
  const packages = offerings.current?.availablePackages ?? []
  const types = packages.map(p => p.packageType).join(', ')
  const pkg = packages.find(p => p.packageType === PACKAGE_TYPE.ANNUAL)
  if (!pkg) throw new Error(`Annual not found. Types: ${types}. ANNUAL=${PACKAGE_TYPE.ANNUAL}`)
  const { customerInfo } = await RC.purchasePackage(pkg)
  return customerInfo.entitlements.active['pro'] ? 'pro' : 'free'
}

export async function restorePurchases(): Promise<'free' | 'pro'> {
  if (!RC) return 'free'
  const info = await RC.restorePurchases()
  return info.entitlements.active['pro'] ? 'pro' : 'free'
}