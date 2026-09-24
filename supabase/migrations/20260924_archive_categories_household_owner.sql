-- Sep 24, 2026: Archive categories + household owner + owner-only budget reset
BEGIN;

-- 1. Archive marker on categories (empty = active)
ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2. Household owner (the person who created it / sent the invite)
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fill in owners for existing households: the current member who sent an invite
UPDATE public.households h
SET owner_id = (
  SELECT i.invited_by
  FROM public.household_invitations i
  JOIN public.profiles p ON p.id = i.invited_by AND p.household_id = h.id
  WHERE i.household_id = h.id
  LIMIT 1
)
WHERE h.owner_id IS NULL;

-- 3. Invite function: record the owner when a new household is created
--    (identical to the current version except the INSERT line)
CREATE OR REPLACE FUNCTION public.create_household_and_invite(invited_email_param text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  new_household_id uuid;
  existing_household_id uuid;
  invite_token text;
  result json;
BEGIN
  SELECT household_id INTO existing_household_id
  FROM public.profiles WHERE id = auth.uid();
  IF existing_household_id IS NULL THEN
    INSERT INTO public.households (owner_id) VALUES (auth.uid()) RETURNING id INTO new_household_id;
    UPDATE public.profiles SET household_id = new_household_id WHERE id = auth.uid();
  ELSE
    new_household_id := existing_household_id;
  END IF;

  DELETE FROM public.household_invitations
  WHERE household_id = new_household_id
    AND invited_email = lower(invited_email_param)
    AND accepted = false;

  invite_token := upper(substring(md5(random()::text) from 1 for 8));
  INSERT INTO public.household_invitations (household_id, invited_by, invited_email, token)
  VALUES (new_household_id, auth.uid(), lower(invited_email_param), invite_token);
  result := json_build_object('household_id', new_household_id, 'token', invite_token);
  RETURN result;
END;
$function$;

-- 4. Can the logged-in user start the budget over?
--    Yes if not in a household, or if they own their household.
CREATE OR REPLACE FUNCTION public.can_reset_budget()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  my_household uuid;
  household_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT household_id INTO my_household
  FROM public.profiles WHERE id = auth.uid();

  IF my_household IS NULL THEN
    RETURN true;
  END IF;

  SELECT owner_id INTO household_owner
  FROM public.households WHERE id = my_household;

  RETURN COALESCE(household_owner = auth.uid(), false);
END;
$function$;

-- 5. Wipe the whole household's budget data (owner only, all-or-nothing)
CREATE OR REPLACE FUNCTION public.reset_household_budget()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  my_household uuid;
  member_ids uuid[];
BEGIN
  IF NOT public.can_reset_budget() THEN
    RAISE EXCEPTION 'Only the household owner can start the budget over';
  END IF;

  SELECT household_id INTO my_household
  FROM public.profiles WHERE id = auth.uid();

  IF my_household IS NULL THEN
    member_ids := ARRAY[auth.uid()];
  ELSE
    SELECT ARRAY_AGG(id) INTO member_ids
    FROM public.profiles WHERE household_id = my_household;
  END IF;

  DELETE FROM public.transactions              WHERE user_id = ANY(member_ids);
  DELETE FROM public.budget_overrides          WHERE user_id = ANY(member_ids);
  DELETE FROM public.category_account_defaults WHERE user_id = ANY(member_ids);
  DELETE FROM public.budget_categories         WHERE user_id = ANY(member_ids);
  DELETE FROM public.income_sources            WHERE user_id = ANY(member_ids);
  DELETE FROM public.accounts                  WHERE user_id = ANY(member_ids);
  DELETE FROM public.monthly_snapshots         WHERE user_id = ANY(member_ids);
END;
$function$;

-- Only logged-in users can call the two new functions
REVOKE ALL ON FUNCTION public.can_reset_budget() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_household_budget() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_reset_budget() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_household_budget() TO authenticated;

COMMIT;