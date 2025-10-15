-- =====================================================
-- AVATARS STORAGE BUCKET
-- =====================================================
-- Creates a public storage bucket for user avatar images

-- Create the avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES
-- Note: Storage policies must be created through Supabase Dashboard
-- or using the storage API, not via SQL migrations
-- =====================================================

-- The following policies need to be created in Supabase Studio:
-- Go to Storage > avatars bucket > Policies

/*
Policy 1: "Users can upload their own avatar"
  Operation: INSERT
  Target roles: authenticated
  WITH CHECK expression:
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text

Policy 2: "Users can update their own avatar"  
  Operation: UPDATE
  Target roles: authenticated
  USING expression:
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text

Policy 3: "Users can delete their own avatar"
  Operation: DELETE
  Target roles: authenticated
  USING expression:
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text

Policy 4: "Public avatar access"
  Operation: SELECT
  Target roles: public
  USING expression:
    bucket_id = 'avatars'
*/

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify bucket was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    RAISE NOTICE 'Storage bucket "avatars" created successfully!';
    RAISE NOTICE 'IMPORTANT: You must now create storage policies in Supabase Studio';
    RAISE NOTICE 'Go to: Storage > avatars bucket > Policies';
  ELSE
    RAISE WARNING 'Failed to create storage bucket "avatars"';
  END IF;
END $$;

