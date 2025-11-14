-- Add unmetered_access flag to user settings for admin overrides

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS unmetered_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.unmetered_access IS 'When true, bypasses plan credit enforcement (admin use only).';

CREATE OR REPLACE FUNCTION public.enforce_unmetered_access_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.unmetered_access := false;
    ELSE
      NEW.unmetered_access := COALESCE(OLD.unmetered_access, false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_unmetered_access_default ON public.user_settings;

CREATE TRIGGER enforce_unmetered_access_default
  BEFORE INSERT OR UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_unmetered_access_default();







