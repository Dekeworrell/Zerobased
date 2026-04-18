export type CategoryType = 'fixed' | 'variable' | 'priority'

export type Category = {
  id: string
  label: string
  icon: string
  type: CategoryType
  permanent?: boolean
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