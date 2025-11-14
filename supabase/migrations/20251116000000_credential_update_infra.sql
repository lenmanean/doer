-- Credential update infrastructure for username/email changes

-- 1. Add username_last_changed_at column
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS username_last_changed_at timestamptz DEFAULT NOW();

UPDATE public.user_settings
SET username_last_changed_at = COALESCE(username_last_changed_at, updated_at, created_at, NOW())
WHERE username_last_changed_at IS NULL;

ALTER TABLE public.user_settings
  ALTER COLUMN username_last_changed_at SET NOT NULL;

COMMENT ON COLUMN public.user_settings.username_last_changed_at IS 'Tracks when the username was last changed to enforce cooldowns.';

-- 2. Replace legacy prevent_username_change trigger
DROP TRIGGER IF EXISTS trigger_prevent_username_change ON public.user_settings;
DROP FUNCTION IF EXISTS prevent_username_change();

CREATE OR REPLACE FUNCTION public.enforce_username_change_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_changed timestamptz;
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    v_last_changed := COALESCE(
      OLD.username_last_changed_at,
      OLD.updated_at,
      OLD.created_at,
      NOW() - INTERVAL '24 hours'
    );

    IF v_last_changed > (NOW() - INTERVAL '24 hours') THEN
      RAISE EXCEPTION USING
        MESSAGE = 'USERNAME_CHANGE_COOLDOWN',
        DETAIL = 'Username was changed within the last 24 hours.';
    END IF;

    NEW.username_last_changed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_username_change_policy
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_change_policy();

COMMENT ON FUNCTION public.enforce_username_change_policy() IS 'Enforces 24-hour cooldowns between username updates.';

-- 3. Username change audit table
CREATE TABLE IF NOT EXISTS public.username_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  old_username text,
  new_username text NOT NULL,
  change_ip text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  changed_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.username_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their username audit" ON public.username_change_audit;
CREATE POLICY "Users can view their username audit"
  ON public.username_change_audit
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages username audit" ON public.username_change_audit;
CREATE POLICY "Service role manages username audit"
  ON public.username_change_audit
  USING (auth.role() = 'service_role');

-- 4. Email change request + audit tables
CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  new_email text NOT NULL,
  otp_hash text NOT NULL,
  otp_salt text NOT NULL,
  otp_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  requested_ip text,
  user_agent text,
  verified_at timestamptz,
  verification_ip text,
  verification_user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT email_change_requests_status_check CHECK (
    status = ANY (ARRAY['pending','confirmed','expired','cancelled'])
  )
);

CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_status
  ON public.email_change_requests (user_id, status);

CREATE TRIGGER update_email_change_requests_updated_at
  BEFORE UPDATE ON public.email_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their email change requests" ON public.email_change_requests;
CREATE POLICY "Users can view their email change requests"
  ON public.email_change_requests
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their email change requests" ON public.email_change_requests;
CREATE POLICY "Users can create their email change requests"
  ON public.email_change_requests
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their email change requests" ON public.email_change_requests;
CREATE POLICY "Users can update their email change requests"
  ON public.email_change_requests
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their email change requests" ON public.email_change_requests;
CREATE POLICY "Users can delete their email change requests"
  ON public.email_change_requests
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages email change requests" ON public.email_change_requests;
CREATE POLICY "Service role manages email change requests"
  ON public.email_change_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Email change audit table
CREATE TABLE IF NOT EXISTS public.email_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  old_email text NOT NULL,
  new_email text NOT NULL,
  status text NOT NULL,
  request_ip text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their email audit" ON public.email_change_audit;
CREATE POLICY "Users can view their email audit"
  ON public.email_change_audit
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages email audit" ON public.email_change_audit;
CREATE POLICY "Service role manages email audit"
  ON public.email_change_audit
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.email_change_requests IS 'Tracks pending email change validations with OTP enforcement.';
COMMENT ON TABLE public.email_change_audit IS 'Immutable record of completed email change operations.';

