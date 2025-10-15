-- =====================================================
-- RLS STATUS VERIFICATION SCRIPT
-- =====================================================
-- Run this script to check which tables have RLS enabled
-- and what policies exist on each table
-- =====================================================

-- Check RLS status for all tables in public schema
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✓ ENABLED'
    ELSE '✗ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Separator
SELECT '========================================' as separator;
SELECT 'DETAILED POLICY INFORMATION' as section;
SELECT '========================================' as separator;

-- List all RLS policies for public schema tables
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as policy_type,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Separator
SELECT '========================================' as separator;
SELECT 'CRITICAL TABLES STATUS' as section;
SELECT '========================================' as separator;

-- Check specific critical tables
WITH critical_tables AS (
  SELECT unnest(ARRAY[
    'plans',
    'milestones', 
    'tasks',
    'task_completions',
    'onboarding_responses',
    'user_profiles',
    'health_snapshots'
  ]) as table_name
)
SELECT 
  ct.table_name,
  CASE 
    WHEN pt.rowsecurity THEN '✓ RLS ENABLED'
    ELSE '✗ RLS DISABLED - SECURITY RISK!'
  END as status,
  COALESCE(
    (SELECT COUNT(*)::text || ' policies'
     FROM pg_policies pp 
     WHERE pp.tablename = ct.table_name 
     AND pp.schemaname = 'public'),
    '0 policies'
  ) as policy_count
FROM critical_tables ct
LEFT JOIN pg_tables pt 
  ON pt.tablename = ct.table_name 
  AND pt.schemaname = 'public'
ORDER BY ct.table_name;

-- Separator
SELECT '========================================' as separator;
SELECT 'GRANT PERMISSIONS CHECK' as section;
SELECT '========================================' as separator;

-- Check what permissions authenticated users have
SELECT 
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN (
    'plans', 'milestones', 'tasks', 'task_completions', 
    'onboarding_responses', 'user_profiles', 'health_snapshots'
  )
ORDER BY table_name, privilege_type;

-- Separator
SELECT '========================================' as separator;
SELECT 'SECURITY ASSESSMENT' as section;
SELECT '========================================' as separator;

-- Security risk assessment
WITH rls_check AS (
  SELECT 
    tablename,
    rowsecurity,
    (SELECT COUNT(*) FROM pg_policies pp WHERE pp.tablename = pt.tablename AND pp.schemaname = 'public') as policy_count
  FROM pg_tables pt
  WHERE schemaname = 'public'
    AND tablename IN ('plans', 'milestones', 'tasks', 'task_completions', 'onboarding_responses', 'user_profiles', 'health_snapshots')
)
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity AND policy_count > 0 THEN '✓ SECURE (RLS + Policies)'
    WHEN rowsecurity AND policy_count = 0 THEN '⚠ WARNING (RLS enabled but NO policies - blocks all access)'
    WHEN NOT rowsecurity THEN '✗ INSECURE (No RLS - all authenticated users can access ALL data)'
  END as security_status
FROM rls_check
ORDER BY 
  CASE 
    WHEN rowsecurity AND policy_count > 0 THEN 1
    WHEN rowsecurity AND policy_count = 0 THEN 2
    ELSE 3
  END,
  tablename;

-- Separator
SELECT '========================================' as separator;
SELECT 'VERIFICATION COMPLETE' as section;
SELECT '========================================' as separator;





