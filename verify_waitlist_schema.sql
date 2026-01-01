-- PHASE 0: Live Database Verification Queries
-- Run these in Supabase SQL Editor or via psql

-- 1. Check if waitlist table exists and get all columns
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'waitlist' 
ORDER BY ordinal_position;

-- 2. Get all constraints (including unique, primary key, foreign key, check)
SELECT 
    conname as constraint_name, 
    contype as constraint_type,
    CASE contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'c' THEN 'CHECK'
        WHEN 'x' THEN 'EXCLUDE'
        ELSE contype::text
    END as constraint_type_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.waitlist'::regclass
ORDER BY contype, conname;

-- 3. Get all indexes
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 'waitlist' 
  AND schemaname = 'public'
ORDER BY indexname;

-- 4. Check RLS status
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'waitlist';

-- 5. Check for any UTM-like columns (case-insensitive search)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'waitlist'
  AND (
    LOWER(column_name) LIKE '%utm%' 
    OR LOWER(column_name) LIKE '%ad%' 
    OR LOWER(column_name) LIKE '%campaign%' 
    OR LOWER(column_name) LIKE '%source%' 
    OR LOWER(column_name) LIKE '%medium%' 
    OR LOWER(column_name) LIKE '%content%' 
    OR LOWER(column_name) LIKE '%term%'
    OR LOWER(column_name) LIKE '%attribution%'
    OR LOWER(column_name) LIKE '%referrer%'
  )
ORDER BY column_name;

-- 6. Get RLS policies if RLS is enabled
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'waitlist'
ORDER BY policyname;














