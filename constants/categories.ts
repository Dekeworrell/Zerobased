export type CategoryType = 'fixed' | 'variable' | 'priority'

export type Category = {
  id: string
  label: string
  icon: string
  type: CategoryType
  permanent?: boolean
}

export const ASSET_ACCOUNT_TYPES = [
  'home', 'vehicle', 'recreation_vehicle', 'cottage', 'rental', 'business', 'other_asset'
]

export const INVESTMENT_ACCOUNT_TYPES = [
  'rrsp', 'tfsa', 'fhsa', 'resp', 'pension', 'margin',
  '401k', 'ira', 'roth_ira', 'hsa', '529'
]

export const LIABILITY_PAY_FROM_TYPES = [
  'credit_card', 'heloc', 'line_of_credit', 'student_loan', 'personal_loan', 'other_liability'
]

export const LIABILITY_PAY_TO_ONLY_TYPES = [
  'mortgage', 'car_loan'
]

export const PRIMARY_PAYABLE_TYPES = [
  'chequing', 'savings', 'cash', 'other'
]

export function baseType(type: string): string {
  return type.replace(/_\d+$/, '').toLowerCase().replace(/[\s-]/g, '_')
}

export function isAssetAccount(type: string): boolean {
  const t = baseType(type)
  return ASSET_ACCOUNT_TYPES.some(a => t === a || t.startsWith(a))
}

export function isInvestmentAccount(type: string): boolean {
  const t = baseType(type)
  return INVESTMENT_ACCOUNT_TYPES.some(a => t === a || t.startsWith(a))
}

export function isLiabilityAccount(type: string): boolean {
  const t = baseType(type)
  return [...LIABILITY_PAY_FROM_TYPES, ...LIABILITY_PAY_TO_ONLY_TYPES].some(a => t === a || t.startsWith(a))
}

export function isPayFromLiability(type: string): boolean {
  const t = baseType(type)
  return LIABILITY_PAY_FROM_TYPES.some(a => t === a || t.startsWith(a))
}

export function isPayToOnlyLiability(type: string): boolean {
  const t = baseType(type)
  return LIABILITY_PAY_TO_ONLY_TYPES.some(a => t === a || t.startsWith(a))
}

export function isPrimaryPayable(type: string): boolean {
  const t = baseType(type)
  if (ASSET_ACCOUNT_TYPES.some(a => t === a || t.startsWith(a))) return false
  if (INVESTMENT_ACCOUNT_TYPES.some(a => t === a || t.startsWith(a))) return false
  return PRIMARY_PAYABLE_TYPES.some(a => t === a || t.startsWith(a))
}

export function isPayableFromAccount(type: string): boolean {
  const t = baseType(type)
  if (ASSET_ACCOUNT_TYPES.some(a => t === a || t.startsWith(a))) return false
  if (INVESTMENT_ACCOUNT_TYPES.some(a => t === a || t.startsWith(a))) return false
  return isPrimaryPayable(type) || isPayFromLiability(type)
}

export function balanceChangeOnExpense(type: string, amount: number): number {
  // Returns the new balance delta for an expense transaction
  // Liability pay-from = balance goes UP (more debt)
  // Asset/payable = balance goes DOWN
  return isPayFromLiability(type) ? amount : -amount
}

export function balanceChangeOnIncome(type: string, amount: number): number {
  // Returns the new balance delta for an income transaction
  // Liability = balance goes DOWN (cash advance repaid)
  // Asset/payable = balance goes UP
  return isLiabilityAccount(type) ? -amount : amount
}

export function balanceChangeOnTransferFrom(type: string, amount: number): number {
  // Sending money out
  // Liability source = cash advance, balance goes UP
  // Asset/payable source = balance goes DOWN
  return isLiabilityAccount(type) ? amount : -amount
}

export function balanceChangeOnTransferTo(type: string, amount: number): number {
  // Receiving money
  // Liability destination = paying it off, balance goes DOWN
  // Asset/payable destination = balance goes UP
  return isLiabilityAccount(type) ? -amount : amount
}

export const EXPENSE_CATEGORIES: Category[] = [
  // Fixed
  { id: 'mortgage', label: 'Mortgage/Rent', icon: '🏠', type: 'fixed' },
  { id: 'internet', label: 'Internet', icon: '📶', type: 'fixed' },
  { id: 'phone', label: 'Phone', icon: '📱', type: 'fixed' },
  { id: 'home_insurance', label: 'Home insurance', icon: '🏡', type: 'fixed' },
  { id: 'auto_insurance', label: 'Auto insurance', icon: '🚘', type: 'fixed' },
  { id: 'property_tax', label: 'Property tax', icon: '🏛️', type: 'fixed' },
  { id: 'water_sewer', label: 'Water & sewer', icon: '💧', type: 'fixed' },
  { id: 'car_loan', label: 'Car loan', icon: '🔑', type: 'fixed' },
  { id: 'loc', label: 'Line of credit', icon: '💸', type: 'fixed' },
  { id: 'studentloan', label: 'Student loan', icon: '🎓', type: 'fixed' },
  { id: 'life_insurance', label: 'Life insurance', icon: '🛡️', type: 'fixed' },
  { id: 'cable_tv', label: 'Cable TV', icon: '📡', type: 'fixed' },
  { id: 'childcare', label: 'Childcare', icon: '👶', type: 'fixed' },
  { id: 'credit_card', label: 'Credit card', icon: '💳', type: 'fixed' },
  { id: 'recreation_vehicles', label: 'Recreation vehicles', icon: '🚤', type: 'fixed' },
  { id: 'loan_repayment', label: 'Loan repayment', icon: '💳', type: 'fixed', permanent: true },

  // Variable
  { id: 'groceries', label: 'Groceries', icon: '🛒', type: 'variable' },
  { id: 'transport', label: 'Transport', icon: '🚗', type: 'variable' },
  { id: 'utilities', label: 'Utilities', icon: '💡', type: 'variable' },
  { id: 'fuel', label: 'Fuel', icon: '⛽', type: 'variable' },
  { id: 'vehicle_maintenance', label: 'Vehicle maintenance', icon: '🔧', type: 'variable' },
  { id: 'dining', label: 'Dining out', icon: '🍽️', type: 'variable' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺', type: 'variable' },
  { id: 'fitness', label: 'Fitness', icon: '💪', type: 'variable' },
  { id: 'health', label: 'Health', icon: '💊', type: 'variable' },
  { id: 'clothing', label: 'Clothing', icon: '👕', type: 'variable' },
  { id: 'education', label: 'Education', icon: '📚', type: 'variable' },
  { id: 'pets', label: 'Pets', icon: '🐾', type: 'variable' },
  { id: 'sports', label: 'Sports', icon: '⚽', type: 'variable' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', type: 'variable', permanent: true },
  { id: 'other', label: 'Other', icon: '➕', type: 'variable', permanent: true },

  // Priority
  { id: 'savings', label: 'Savings', icon: '💰', type: 'priority' },
  { id: 'investments', label: 'Investments', icon: '📈', type: 'priority' },
  { id: 'rrsp', label: 'RRSP', icon: '📈', type: 'priority' },
  { id: 'tfsa', label: 'TFSA', icon: '🌱', type: 'priority' },
  { id: 'fhsa', label: 'FHSA', icon: '🏠', type: 'priority' },
  { id: 'mortgage_extra', label: 'Mortgage overpayment', icon: '🏦', type: 'priority' },
  { id: 'emergency_fund', label: 'Emergency fund', icon: '🆘', type: 'priority' },
]