-- Backfill usernames from auth.users metadata to user_settings table
-- This migration copies usernames from auth user_metadata to user_settings for existing users

-- Update user_settings with username from auth metadata where username is NULL
UPDATE public.user_settings us
SET username = au.raw_user_meta_data->>'username',
    updated_at = NOW()
FROM auth.users au
WHERE us.user_id = au.id
  AND us.username IS NULL
  AND au.raw_user_meta_data->>'username' IS NOT NULL
  AND au.raw_user_meta_data->>'username' != '';

-- Log the number of records updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % usernames from auth metadata', updated_count;
END $$;









