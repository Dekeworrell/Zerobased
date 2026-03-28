import AsyncStorage from '@react-native-async-storage/async-storage'

type TrackingMethod = 'bank' | 'manual'

type Account = {
  type: string
  label: string
  icon: string
  balance: string
}

type IncomeSource = {
  label: string
  amount: string
  frequency: string
  type: string
}

type Expense = {
  id: string
  label: string
  icon: string
  amount: string
  frequency: 'monthly' | 'biweekly'
}

type OnboardingData = {
  trackingMethod: TrackingMethod | null
  accounts: Account[]
  incomeSources: IncomeSource[]
  expenses: Expense[]
}

const STORAGE_KEY = 'zerobased_onboarding'

let memoryCache: OnboardingData = {
  trackingMethod: null,
  accounts: [],
  incomeSources: [],
  expenses: [],
}

export async function initStore() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (stored) memoryCache = JSON.parse(stored)
  } catch {}
}

async function saveStorage(data: OnboardingData) {
  memoryCache = data
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function getOnboardingData(): OnboardingData {
  return memoryCache
}

export function setTrackingMethod(method: TrackingMethod) {
  const data = getOnboardingData()
  data.trackingMethod = method
  saveStorage(data)
}

export function setAccounts(accounts: Account[]) {
  const data = getOnboardingData()
  data.accounts = accounts
  saveStorage(data)
}

export function setIncomeSources(sources: IncomeSource[]) {
  const data = getOnboardingData()
  data.incomeSources = sources
  saveStorage(data)
}

export function setExpenses(expenses: Expense[]) {
  const data = getOnboardingData()
  data.expenses = expenses
  saveStorage(data)
}

export function clearOnboardingData() {
  memoryCache = {
    trackingMethod: null,
    accounts: [],
    incomeSources: [],
    expenses: [],
  }
  try {
    AsyncStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function toMonthly(amount: string | number, frequency: string): number {
  const val = typeof amount === 'number' ? amount : parseFloat(amount) || 0
  if (frequency === 'biweekly') return val * 2
  if (frequency === 'weekly') return val * 4
  if (frequency === 'semimonthly') return val * 2
  return val
}
