-- ============================================================
-- Phase 4: Affiliate / influencer program
-- Run in Supabase SQL editor AFTER 20260508_bank_connections.sql
-- ============================================================

-- 1. Affiliate accounts (one row per affiliate partner)
CREATE TABLE IF NOT EXISTS affiliates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- their Supabase account
  name              text NOT NULL,
  email             text NOT NULL UNIQUE,
  referral_code     text NOT NULL UNIQUE,  -- e.g. 'SARAH20'
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  tier              text NOT NULL DEFAULT 'standard'
    CHECK (tier IN ('standard', 'creator', 'launch')),
  commission_rate   numeric(5,4) NOT NULL DEFAULT 0.20,  -- 0.20 = 20%
  stripe_account_id text,                                -- Stripe Connect ID for payouts
  notes             text,
  applied_at        timestamptz NOT NULL DEFAULT now(),
  approved_at       timestamptz,
  -- Running counters (updated by triggers / edge functions for fast reads)
  total_clicks      integer NOT NULL DEFAULT 0,
  total_conversions integer NOT NULL DEFAULT 0,
  total_earned      numeric(10,2) NOT NULL DEFAULT 0,
  total_paid        numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Affiliate can read their own row; admin reads via service role
CREATE POLICY "affiliates_own_select" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Click tracking (one row per referral link click)
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  clicked_at   timestamptz NOT NULL DEFAULT now(),
  ip_hash      text,   -- SHA-256 of IP for dedup; never store raw IP
  user_agent   text,
  converted    boolean NOT NULL DEFAULT false
);

ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_clicks_own_select" ON affiliate_clicks
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- 3. Payouts (created before conversions so FK can reference it)
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id       uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount             numeric(10,2) NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  stripe_transfer_id text,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz
);

ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_payouts_own_select" ON affiliate_payouts
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- 4. Conversions (when a referred user subscribes)
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id        uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  subscriber_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  click_id            uuid REFERENCES affiliate_clicks(id) ON DELETE SET NULL,
  payout_id           uuid REFERENCES affiliate_payouts(id) ON DELETE SET NULL,
  plan                text NOT NULL CHECK (plan IN ('monthly', 'annual')),
  revenue_amount      numeric(10,2) NOT NULL,   -- what subscriber paid (CAD)
  commission_rate     numeric(5,4) NOT NULL,
  commission_amount   numeric(10,2) NOT NULL,   -- revenue_amount * commission_rate
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'refunded')),
  converted_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_conversions_own_select" ON affiliate_conversions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- 5. Track referral on user profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referred_by text;  -- referral_code of the affiliate who referred them

-- Index for fast referral code lookups
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates (referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles (referred_by);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate ON affiliate_clicks (affiliate_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_affiliate ON affiliate_conversions (affiliate_id, converted_at DESC);

-- ============================================================
-- Commission rate reference (for the UI to display)
-- standard: 20%  |  creator: 25%  |  launch: 30-40%
-- ============================================================
