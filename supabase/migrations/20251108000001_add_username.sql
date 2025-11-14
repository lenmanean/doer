-- Add username column to user_settings table
-- Username will be used for login instead of email, allowing users to change their email later

-- Add username column (nullable initially for migration, will be made required)
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index on lowercase username for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_username_lower 
ON public.user_settings (LOWER(username));

-- Add constraint to ensure username meets requirements
ALTER TABLE public.user_settings ADD CONSTRAINT username_format_check 
CHECK (username ~ '^[a-zA-Z0-9_-]{3,20}$');

-- Add comment to document the username field
COMMENT ON COLUMN public.user_settings.username IS 'Unique username for login. 3-20 characters, alphanumeric with underscores and hyphens allowed. Case-insensitive for uniqueness.';








