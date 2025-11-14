-- Remove display_name and bio columns from user_settings table
-- This migration removes unused profile fields that are no longer part of the onboarding flow

-- Remove display_name column
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS display_name;

-- Remove bio column  
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS bio;

-- Drop associated indexes if they exist
DROP INDEX IF EXISTS public.idx_user_settings_display_name;

-- Add comment to document the change
COMMENT ON TABLE public.user_settings IS 'User preferences and settings - uses first_name instead of display_name';







