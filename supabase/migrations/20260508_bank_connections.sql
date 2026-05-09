-- ============================================================
-- Phase 2: Bank connections (Plaid sandbox)
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Plaid items (one row per connected institution)
CREATE TABLE IF NOT EXISTS plaid_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       text NOT NULL UNIQUE,
  access_token  text NOT NULL,          -- encrypted at rest by Supabase; never sent to client
  institution_id   text,
  institution_name text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_synced_at   timestamptz,
  cursor        text                    -- Plaid /transactions/sync cursor
);

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own items; access_token never leaves the server
CREATE POLICY "plaid_items_select" ON plaid_items
  FOR SELECT USING (auth.uid() = user_id);

-- Only edge functions (service role) may insert/update/delete
-- (no client-side INSERT policy — intentional)

-- 2. Plaid accounts (individual bank accounts within an item)
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  plaid_account_id text NOT NULL UNIQUE,
  name            text NOT NULL,
  official_name   text,
  type            text,                 -- depository, credit, loan, investment
  subtype         text,                 -- checking, savings, credit card, etc.
  balance_current numeric(12,2),
  balance_available numeric(12,2),
  currency_code   text DEFAULT 'CAD',
  mask            text,                 -- last 4 digits
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plaid_accounts_select" ON plaid_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Extend transactions table for imported transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source          text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'plaid')),
  ADD COLUMN IF NOT EXISTS plaid_transaction_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS merchant_name   text,
  ADD COLUMN IF NOT EXISTS pending         boolean DEFAULT false;

-- Index for fast dedup on import
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_id
  ON transactions (plaid_transaction_id)
  WHERE plaid_transaction_id IS NOT NULL;

-- ============================================================
-- Helper view: connected institutions per user
-- (safe to expose — no access_token)
-- ============================================================
CREATE OR REPLACE VIEW connected_banks AS
  SELECT
    pi.id,
    pi.user_id,
    pi.item_id,
    pi.institution_id,
    pi.institution_name,
    pi.last_synced_at,
    COUNT(pa.id)::int AS account_count
  FROM plaid_items pi
  LEFT JOIN plaid_accounts pa ON pa.item_id = pi.id
  GROUP BY pi.id, pi.user_id, pi.item_id, pi.institution_id, pi.institution_name, pi.last_synced_at;

-- RLS on the view
ALTER VIEW connected_banks OWNER TO postgres;
