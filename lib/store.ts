import AsyncStorage from '@react-native-async-storage/async-storage'

type TrackingMethod = 'bank' | 'manual'
type BudgetCycle = 'monthly' | 'paycycle'

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
  next_payday?: string
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
  budgetCycle: BudgetCycle
  accounts: Account[]
  incomeSources: IncomeSource[]
  expenses: Expense[]
}

const STORAGE_KEY = 'zerobased_onboarding'

let memoryCache: OnboardingData = {
  trackingMethod: null,
  budgetCycle: 'monthly',
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

export function setBudgetCycle(cycle: BudgetCycle) {
  const data = getOnboardingData()
  data.budgetCycle = cycle
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
    budgetCycle: 'monthly',
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

export function getPayPeriodDates(nextPayday: string, frequency: string): { start: Date, end: Date } {
  const payday = new Date(nextPayday + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  let periodDays = 14
  if (frequency === 'weekly') periodDays = 7
  if (frequency === 'monthly') periodDays = 30
  if (frequency === 'semimonthly') periodDays = 15

  while (payday > today) {
    payday.setDate(payday.getDate() - periodDays)
  }
  while (payday <= today) {
    const next = new Date(payday)
    next.setDate(next.getDate() + periodDays)
    if (next > today) break
    payday.setDate(payday.getDate() + periodDays)
  }

  const start = new Date(payday)
  start.setDate(start.getDate() - periodDays)
  const end = new Date(payday)
  end.setDate(end.getDate() - 1)

  return { start, end }
  
}export function calculateBudgetStatus(
  monthlyIncome: number,
  categories: { budgeted_amount: string | number, frequency: string }[]
) {
  const totalBudgeted = categories.reduce((sum, c) => {
    const amount = parseFloat(c.budgeted_amount.toString()) || 0
    return sum + toMonthly(amount, c.frequency)
  }, 0)
  const remaining = Math.round((monthlyIncome - totalBudgeted) * 100) / 100
  return { totalBudgeted, remaining }
}