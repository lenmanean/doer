-- =====================================================
-- USER PROFILES TABLE
-- =====================================================
-- Stores user profile information separate from auth data
-- This allows for structured profile data with proper RLS

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  bio text,
  avatar_url text,
  share_achievements boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_profiles_user_id_key UNIQUE (user_id)
);

-- Add helpful comment
COMMENT ON TABLE public.user_profiles IS 'Stores user profile information and preferences';

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can view profiles of users who share achievements
CREATE POLICY "Users can view public profiles"
  ON public.user_profiles
  FOR SELECT
  USING (share_achievements = true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Function: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

-- Trigger: Create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Update timestamp on profile update
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger: Update timestamp
DROP TRIGGER IF EXISTS on_profile_updated ON public.user_profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- BACKFILL EXISTING USERS
-- =====================================================
-- Create profiles for existing users who don't have one yet

INSERT INTO public.user_profiles (user_id, display_name)
SELECT 
  id,
  COALESCE(
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'full_name',
    split_part(email, '@', 1)
  )
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- INDEXES
-- =====================================================

-- Index on user_id for faster lookups (already unique, but explicit)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Index on share_achievements for public profile queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_share_achievements ON public.user_profiles(share_achievements) WHERE share_achievements = true;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;





