# Zerobased — Project Memory

## What This App Is
A zero-based budgeting app built with **Expo (React Native)** + **Supabase** + **RevenueCat**.
- iOS first, Android planned later
- Supports household sharing (partner accounts)
- Free tier + Pro tier subscription
- Plaid integration for bank connections (production access pending)

**Owner:** Deke Worrell (Dekeworrell@shaw.ca)
**Bundle ID:** `com.dekeworrel.zerobased`
**EAS Project ID:** `bf1765b2-9ba5-44b4-b687-32f2a779059b`
**Supabase Project Ref:** `tkldjaqcovjdiwjpnphf`

---

## Tech Stack
| Layer | Tool |
|---|---|
| Framework | Expo SDK + Expo Router (file-based routing) |
| UI | React Native (no UI library, custom styles) |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) |
| Subscriptions | RevenueCat (`react-native-purchases`) |
| Bank connections | Plaid via Supabase Edge Function |
| Push notifications | Expo Notifications |
| Build/Deploy | EAS Build + EAS Submit |

---

## Navigation Structure
```
app/
  _layout.tsx          ← Root Stack (headerShown: false)
  index.tsx            ← Auth gate (redirects to /welcome or /(tabs)/dashboard)
  welcome.tsx
  login.tsx
  signup.tsx
  upgrade.tsx          ← presentation: 'modal', slide_from_bottom
  settings.tsx
  add-transaction.tsx
  budget-adjust.tsx
  connect-bank.tsx
  partner.tsx
  admin.tsx
  terms.tsx
  privacy.tsx
  onboarding/
    _layout.tsx
    income.tsx
    expenses.tsx
    accounts.tsx / accounts-everyday.tsx / accounts-debt.tsx / accounts-investment.tsx
    assets.tsx
    goals.tsx
    assign.tsx
    tracking-method.tsx
  (tabs)/
    _layout.tsx        ← Tabs (5 tabs only — no terms/privacy here)
    dashboard.tsx
    budget.tsx
    transactions.tsx
    accounts.tsx
    reports.tsx
```

### Tab Bar
Only 5 tabs: Budget 📋, Transactions 💳, Dashboard 💰, Accounts 🏦, Reports 📊.
Terms/Privacy/Admin are Stack screens (no tab bar).

---

## Key Files

### `app/_layout.tsx`
- Root Stack with `headerShown: false`
- `upgrade` screen uses `presentation: 'modal'` so it slides up from bottom
- Initializes: `initStore()`, `registerForPushNotifications()`, `initRevenueCat(userId)`

### `app/(tabs)/dashboard.tsx`
- Loads all data in parallel via `Promise.all`
- **Tier check:** combines DB tier + RevenueCat tier: `dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free'`
- **Pay period toggle:** free users get redirected to `/upgrade` when they tap it; free users see `'📅 Pay period 🔒'`
- **Pro pill:** shown in header for free users — tapping opens `/upgrade`
- **Payday modal:** fires when `next_payday <= today` and not yet logged (`lastCheck`). Supports `SKIP:` prefix for reminder flow. Uses `paydayShownRef` to prevent double-showing per session.
- `summaryView` defaults to `'monthly'`

### `app/(tabs)/transactions.tsx`
- Loads transactions, categories, and accounts in parallel
- Passes `allAccounts` to `TransactionEditSheet`
- Transaction query: last 500, ordered by date desc

### `components/TransactionEditSheet.tsx`
- Edit + delete a transaction
- Supports changing the **account** — balance logic reverses old delta, applies new delta
- `handleSave`: if account or amount changed → reverse old account balance, apply to new account
- `handleDelete`: reverses account balance before deleting
- Visual: `borderWidth: 1.5`, shadow (`shadowOffset: { height: -6 }`), overlay `rgba(0,0,0,0.55)`

### `lib/purchases.ts`
- RevenueCat API key: `appl_ZjIQHUWSoAvCiHIfVeeYnzwmTLz`
- `initRevenueCat(userId)` — called at app start
- `getSubscriptionTier()` — returns `'pro' | 'free'` from RC entitlement named `'pro'`
- `purchaseMonthly()` / `purchaseAnnual()` — looks up package by identifier `'monthly'` / `'yearly'`
- Web guard: all RC calls are no-ops on web (returns safe defaults)

### `lib/store.ts`
- `toMonthly(amount, frequency)` — converts any frequency to monthly equivalent
- `toPeriodAmount(amount, frequency)` — converts monthly to pay-period amount
- `getPayPeriodDates(nextPayday, frequency)` — returns `{ start, end }` for current pay period
- `calculateBudgetStatus(income, categories)` — returns `{ totalBudgeted, remaining }`

### `lib/userCache.ts`
- `getCachedUserId()` — cached Supabase auth user ID
- `getCachedHouseholdIds(userId)` — returns array of user IDs in the household (self + partner)

### `constants/categories.ts`
- Account type arrays: `ASSET_ACCOUNT_TYPES`, `INVESTMENT_ACCOUNT_TYPES`, `LIABILITY_PAY_FROM_TYPES`, etc.
- `balanceChangeOnIncome(accountType, amount)` — how much balance changes on income transaction
- `balanceChangeOnExpense(accountType, amount)` — how much balance changes on expense transaction

---

## Subscription / Pro Tier

### Free vs Pro
| Feature | Free | Pro |
|---|---|---|
| Core budgeting | ✅ | ✅ |
| Pay cycle budgeting | ❌ (shows paywall) | ✅ |
| Household sharing | ❌ | ✅ |
| Accounts, debts & net worth | ❌ | ✅ |
| Reports & insights | ❌ | ✅ |
| Bank connections (Plaid) | ❌ | ✅ |

### Pricing (hardcoded in `app/upgrade.tsx`)
- Monthly: **$12.99 CAD/month**
- Annual: **$89.99 CAD/year** (Save 42%)

### Tier Resolution
```ts
const dbTier = profile?.subscription_tier ?? 'free'
const rcTier = await getSubscriptionTier()  // from RevenueCat
const tier = dbTier === 'pro' || rcTier === 'pro' ? 'pro' : 'free'
```

---

## Supabase

### Key Tables
- `profiles` — user settings: `name`, `budget_cycle`, `subscription_tier`, `last_payday_check`, `paycheque_reminders`, `household_id`, `default_account_id`
- `income_sources` — `amount`, `frequency`, `next_payday` (pipe-separated for semi-monthly), `income_type`, `user_id`
- `budget_categories` — `label`, `icon`, `budgeted_amount`, `frequency`, `category_type`, `sort_order`
- `transactions` — `label`, `amount`, `date`, `type` (income/expense/transfer), `is_unexpected`, `category_id`, `account_id`, `user_id`
- `accounts` — `label`, `type`, `balance`, `user_id`
- `category_account_defaults` — maps `category_id` → `account_id` per user

### Edge Functions
- `plaid-create-link-token` — creates Plaid Link token for bank connection
  - Requires secrets: `PLAID_CLIENT_ID`, `PLAID_SECRET` (set via Supabase dashboard → Settings → Edge Function Secrets)
  - Deploy: `npx supabase functions deploy plaid-create-link-token --project-ref tkldjaqcovjdiwjpnphf`

### RPC
- `get_household_members` — returns partner's profile info

---

## Payday Modal Logic
1. On dashboard focus, check `myIncome` (current user's income sources only)
2. If `tier === 'pro'` and `remindersOn`:
   - Check for `SKIP:` prefix in `last_payday_check` → show reminder modal
   - Else: find any `next_payday` date ≤ today that isn't equal to `last_payday_check`
   - Show modal with the most recent triggered date
3. `PaydayModal` on confirm: advances `next_payday` past today using `while (current <= todayMid)` loop
4. `PaydayModal` on skip: sets `last_payday_check = 'SKIP:' + paydayDate`

---

## Build & Deploy

### Dev Build
```bash
eas build --platform ios --profile development
```
Scan QR code with the Expo Go / dev client app.

### Production Build + Submit to App Store
```bash
eas build --platform ios --profile production --auto-submit
```
- Auto-increments build number (`autoIncrement: true` in `eas.json`)
- Submits to App Store Connect automatically
- Takes ~15–20 minutes

### EAS Submit credentials
- Key ID: `759GCW24FM`
- Issuer ID: `8c4ad583-4730-4b3c-bfc6-02ffff798de4`
- Key file: `AuthKey_759GCW24FM.p8`

---

## Known Issues / Pending Before Launch

### Must-do before taking payments
1. **RevenueCat products not configured** — no App Store products linked to RC offerings yet
   - Step 1: App Store Connect → Monetization → In-App Purchases → create two Auto-Renewable Subscriptions
     - `com.zerobased.pro.monthly` — $12.99 CAD/month
     - `com.zerobased.pro.annual` — $89.99 CAD/year
   - Step 2: RevenueCat dashboard → Products → add both IDs
   - Step 3: Entitlements → create `pro` → attach both products
   - Step 4: Offerings → create `default` offering → add packages

### Pending / Nice to have
- **Android build** — Google Play Console setup, RevenueCat Android key, EAS Android build
- **Plaid production access** — complete Plaid questionnaires for production (currently sandbox)
- **App Store listing** — screenshots, description, keywords, support URL
- **Legal contact emails** — update `privacy@zerobased.ca` and `legal@zerobased.ca` in terms/privacy screens
- **Onboarding pop-ups** — currently kept as-is, revisit post-launch

---

## PowerShell / Windows Gotchas
- **UTF-8 BOM issue:** `System.Text.Encoding.UTF8` adds BOM — always use `New-Object System.Text.UTF8Encoding $false`
- **git show returns array:** pipe through `| Out-String` before writing to file to preserve newlines
- **Emoji corruption:** never use PowerShell `-replace` on file content with emojis — use `[System.IO.File]::ReadAllText/WriteAllText` with explicit UTF8 encoding

---

## Architecture Decisions
- **Stack + Tabs:** Root is a `Stack`, tabs live in `(tabs)/` group. Upgrade screen uses `presentation: 'modal'` so it slides up from bottom and has a natural dismiss gesture. Terms/Privacy are Stack screens (not tabs).
- **Tier check:** Always combine DB tier + RevenueCat tier with OR — RevenueCat is the source of truth for active subscribers, DB tier is a fallback/override.
- **Balance updates:** Done client-side at transaction save/delete/edit time (not via DB triggers). Handles account changes on edit by reversing old delta + applying new delta.
- **Payday logic:** Simple date comparison (`next_payday <= today`), not a complex lookback window. Semi-monthly uses pipe-separated dates in `next_payday` field.
