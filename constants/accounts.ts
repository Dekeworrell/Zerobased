// Single source of truth for all account types across the app

export type AccountTypeOption = {
  id: string
  label: string
  icon: string
  multi?: boolean
}

// Everyday accounts
export const EVERYDAY_ACCOUNTS: AccountTypeOption[] = [
  { id: 'chequing', label: 'Chequing', icon: '💳', multi: true },
  { id: 'savings', label: 'Savings', icon: '🏦', multi: true },
  { id: 'cash', label: 'Cash', icon: '💵', multi: true },
  { id: 'other_everyday', label: 'Other', icon: '➕', multi: true },
]

// Canadian investment/registered accounts
export const CA_INVESTMENT_ACCOUNTS: AccountTypeOption[] = [
  { id: 'rrsp', label: 'RRSP', icon: '📈' },
  { id: 'tfsa', label: 'TFSA', icon: '🌱' },
  { id: 'fhsa', label: 'FHSA', icon: '🏡' },
  { id: 'resp', label: 'RESP', icon: '🎓' },
  { id: 'pension', label: 'Pension', icon: '👴' },
  { id: 'margin', label: 'Margin account', icon: '📊' },
  { id: 'brokerage', label: 'Brokerage', icon: '📈' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'other_investment', label: 'Other investment', icon: '💰' },
]

// US investment/registered accounts
export const US_INVESTMENT_ACCOUNTS: AccountTypeOption[] = [
  { id: '401k', label: '401(k)', icon: '📈' },
  { id: 'ira', label: 'IRA', icon: '🏦' },
  { id: 'roth_ira', label: 'Roth IRA', icon: '🌱' },
  { id: 'hsa', label: 'HSA', icon: '💊' },
  { id: '529', label: '529 Plan', icon: '🎓' },
  { id: 'brokerage', label: 'Brokerage', icon: '📈' },
  { id: 'margin', label: 'Margin account', icon: '📊' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'other_investment', label: 'Other investment', icon: '💰' },
]

// Asset accounts (physical assets)
export const ASSET_ACCOUNTS: AccountTypeOption[] = [
  { id: 'home', label: 'Home value', icon: '🏡' },
  { id: 'vehicle', label: 'Vehicle value', icon: '🚗' },
  { id: 'recreation_vehicle', label: 'Recreation vehicle', icon: '🚤' },
  { id: 'cottage', label: 'Cottage/cabin', icon: '🏕️' },
  { id: 'rental', label: 'Rental property', icon: '🏘️' },
  { id: 'other_asset', label: 'Other asset', icon: '➕' },
]

// Liability accounts
export const LIABILITY_ACCOUNTS: AccountTypeOption[] = [
  { id: 'mortgage', label: 'Mortgage', icon: '🏦' },
  { id: 'heloc', label: 'HELOC', icon: '🏠' },
  { id: 'line_of_credit', label: 'Line of credit', icon: '💸' },
  { id: 'car_loan', label: 'Car loan', icon: '🚗' },
  { id: 'student_loan', label: 'Student loan', icon: '🎓' },
  { id: 'credit_card', label: 'Credit card', icon: '💳' },
  { id: 'personal_loan', label: 'Personal loan', icon: '💳' },
  { id: 'other_liability', label: 'Other liability', icon: '📋' },
]

// Combined asset options for the accounts screen (non-liability)
export const ASSET_TYPE_OPTIONS: AccountTypeOption[] = [
  ...EVERYDAY_ACCOUNTS.map(a => ({ ...a, multi: undefined })),
  ...CA_INVESTMENT_ACCOUNTS,
  ...ASSET_ACCOUNTS,
]

// Icon lookup — derives from all account types
export const ACCOUNT_ICONS: { [key: string]: string } = {}
;[
  ...EVERYDAY_ACCOUNTS,
  ...CA_INVESTMENT_ACCOUNTS,
  ...US_INVESTMENT_ACCOUNTS,
  ...ASSET_ACCOUNTS,
  ...LIABILITY_ACCOUNTS,
].forEach(a => { ACCOUNT_ICONS[a.id] = a.icon })

// Helper to get icon for any account type including timestamp variants
export function getAccountIcon(type: string): string {
  const clean = type.replace(/_\d+$/, '').toLowerCase()
  for (const key of Object.keys(ACCOUNT_ICONS)) {
    if (clean === key || clean.startsWith(key)) return ACCOUNT_ICONS[key]
  }
  return '💳'
}

// Helper to get label for any account type
export function getAccountLabel(type: string): string {
  const clean = type.replace(/_\d+$/, '').toLowerCase()
  const all = [
    ...EVERYDAY_ACCOUNTS,
    ...CA_INVESTMENT_ACCOUNTS,
    ...US_INVESTMENT_ACCOUNTS,
    ...ASSET_ACCOUNTS,
    ...LIABILITY_ACCOUNTS,
  ]
  const match = all.find(a => clean === a.id || clean.startsWith(a.id))
  return match?.label || type
}