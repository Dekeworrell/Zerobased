type TrackingMethod = 'bank' | 'manual'

type Account = {
  type: string
  label: string
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

function getStorage(): OnboardingData {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    }
  } catch {}
  return {
    trackingMethod: null,
    accounts: [],
    incomeSources: [],
    expenses: [],
  }
}

function saveStorage(data: OnboardingData) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch {}
}

export function setTrackingMethod(method: TrackingMethod) {
  const data = getStorage()
  data.trackingMethod = method
  saveStorage(data)
}

export function setAccounts(accounts: Account[]) {
  const data = getStorage()
  data.accounts = accounts
  saveStorage(data)
}

export function setIncomeSources(sources: IncomeSource[]) {
  const data = getStorage()
  data.incomeSources = sources
  saveStorage(data)
}

export function setExpenses(expenses: Expense[]) {
  const data = getStorage()
  data.expenses = expenses
  saveStorage(data)
}

export function getOnboardingData(): OnboardingData {
  return getStorage()
}

export function clearOnboardingData() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}

export function toMonthly(amount: string | number, frequency: string): number {
  const val = typeof amount === 'number' ? amount : parseFloat(amount) || 0
  if (frequency === 'biweekly') return (val * 26) / 12
  if (frequency === 'weekly') return (val * 52) / 12
  if (frequency === 'semimonthly') return val * 2
  return val
}