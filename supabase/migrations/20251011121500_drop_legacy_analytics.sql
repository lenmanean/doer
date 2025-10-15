-- Migration: Drop Legacy Analytics Infrastructure
-- Purpose: Remove deprecated analytics functions and tables that reference non-existent structures
-- Date: 2025-10-11

-- Drop legacy analytics functions
DROP FUNCTION IF EXISTS public.generate_daily_analytics_snapshots() CASCADE;
DROP FUNCTION IF EXISTS public.update_analytics_snapshots() CASCADE;

-- Drop legacy analytics tables
DROP TABLE IF EXISTS public.analytics_snapshots CASCADE;
DROP TABLE IF EXISTS public._backup_analytics_snapshots CASCADE;

-- Note: analytics_*_7d views are preserved for potential legacy debugging
-- These views can be removed in a future migration if confirmed unused



