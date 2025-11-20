-- Username Security Enhancements
-- Ensures comprehensive username uniqueness and validation

-- 1. Ensure the unique index exists (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_username_lower 
ON public.user_settings (LOWER(username));

-- 2. Add trigger function to prevent username changes after initial set
CREATE OR REPLACE FUNCTION prevent_username_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow setting username if it's currently NULL
  IF OLD.username IS NOT NULL AND NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'Username cannot be changed once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger to enforce username immutability
DROP TRIGGER IF EXISTS trigger_prevent_username_change ON public.user_settings;
CREATE TRIGGER trigger_prevent_username_change
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_username_change();

-- 4. Add function to check username availability (case-insensitive)
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_settings 
    WHERE LOWER(username) = LOWER(check_username)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add comment documenting the security measures
COMMENT ON FUNCTION prevent_username_change() IS 'Prevents username changes after initial set to maintain username stability and security';
COMMENT ON FUNCTION is_username_available(TEXT) IS 'Checks if a username is available (case-insensitive check)';

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_username_available(TEXT) TO authenticated;










