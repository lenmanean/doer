# Storage Policies Setup Guide

## ⚠️ Important Note

Storage policies **cannot be created via SQL migrations** in Supabase. They must be created through the Supabase Dashboard UI.

The migration file (`20251012140000_create_avatars_storage.sql`) will create the storage bucket, but you need to manually create the policies.

---

## 📋 Step-by-Step Instructions

### Step 1: Run the Migration

First, run the migration to create the storage bucket:

1. Open **Supabase Studio** → **SQL Editor**
2. Copy contents of `supabase/migrations/20251012140000_create_avatars_storage.sql`
3. Paste and click **Run**
4. You should see: ✅ "Storage bucket 'avatars' created successfully!"

### Step 2: Create Storage Policies

Now create the 4 required policies:

1. In Supabase Studio, go to **Storage** (left sidebar)
2. Click on **avatars** bucket
3. Click **Policies** tab
4. Click **New Policy** button

---

## 🔒 Policy 1: Users can upload their own avatar

**Click:** "New Policy" → "For full customization"

- **Policy Name:** `Users can upload their own avatar`
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`
- **WITH CHECK expression:**
  ```sql
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  ```
- Click **Review** → **Save policy**

---

## ✏️ Policy 2: Users can update their own avatar

**Click:** "New Policy" → "For full customization"

- **Policy Name:** `Users can update their own avatar`
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`
- **USING expression:**
  ```sql
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  ```
- Click **Review** → **Save policy**

---

## 🗑️ Policy 3: Users can delete their own avatar

**Click:** "New Policy" → "For full customization"

- **Policy Name:** `Users can delete their own avatar`
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`
- **USING expression:**
  ```sql
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  ```
- Click **Review** → **Save policy**

---

## 👁️ Policy 4: Public avatar access

**Click:** "New Policy" → "For full customization"

- **Policy Name:** `Public avatar access`
- **Allowed operation:** `SELECT`
- **Target roles:** `public`
- **USING expression:**
  ```sql
  bucket_id = 'avatars'
  ```
- Click **Review** → **Save policy**

---

## ✅ Verification

After creating all 4 policies:

1. Go to **Storage** → **avatars** → **Policies**
2. You should see all 4 policies listed
3. Test by uploading an avatar in your app at `/community`

---

## 🎯 Quick Reference

| Policy | Operation | Role | Expression |
|--------|-----------|------|------------|
| Upload | INSERT | authenticated | `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text` |
| Update | UPDATE | authenticated | `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text` |
| Delete | DELETE | authenticated | `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text` |
| Public Read | SELECT | public | `bucket_id = 'avatars'` |

---

## 🐛 Troubleshooting

### Can't create policy
- Make sure you're in the **avatars** bucket
- Click **Policies** tab (not Configuration)
- Use "For full customization" option

### Policy not working
- Check the expression syntax is exactly as shown
- Verify role is set correctly
- Test with a fresh login

### Upload still fails
- Check browser console for errors
- Verify all 4 policies are created
- Check bucket is set to **Public**

---

## 📝 Why Manual Setup?

Supabase storage policies require special permissions that regular migration scripts don't have. This is a security feature to prevent unauthorized policy changes.

---

Need help? The policies are straightforward - just copy the expressions exactly as shown above!

