-- Document unused indexes
-- These indexes are currently unused but may be needed for future queries
-- Consider monitoring query patterns and removing truly unused indexes if they impact write performance

-- ============================================================================
-- Unused Indexes (as of 2025-11-07)
-- ============================================================================
-- 
-- The following indexes have been identified as unused by Supabase linter:
-- 
-- 1. idx_plans_end_date - May be useful for filtering plans by end date
-- 2. idx_tasks_duration - May be useful for duration-based queries
-- 3. idx_task_schedule_start_time - May be useful for time-based queries
-- 4. idx_health_snapshots_created_at - May be useful for time-series analysis
-- 5. idx_pending_reschedules_created_at - May be useful for sorting by creation time
-- 6. idx_task_schedule_pending_reschedule - May be useful for finding pending reschedules
-- 7. idx_pending_reschedules_user_free_mode - May be useful for free-mode queries
-- 8. idx_pending_reschedules_user_plan - May be useful for user+plan queries
-- 9. idx_task_completions_scheduled_date - May be useful for date-based queries
-- 10. idx_user_settings_display_name - May be useful for user search
-- 11. idx_onboarding_responses_plan_id - May be useful for plan-based queries
-- 12. idx_user_settings_avatar_url - May be useful for avatar queries
-- 13. idx_scheduling_history_adjustment_date - May be useful for date-based queries
--
-- Recommendation: Monitor query patterns and remove indexes that:
-- - Are not used within 30-60 days
-- - Impact write performance significantly
-- - Are clearly redundant with other indexes
--
-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan;

-- ============================================================================
-- Note: No indexes are being removed in this migration
-- ============================================================================
-- Keeping indexes for now as they may be needed for:
-- - Future features that haven't been implemented yet
-- - Performance optimization for specific query patterns
-- - Backup/recovery scenarios
--
-- If you want to remove unused indexes, create a separate migration after
-- confirming they're not needed for at least 30-60 days.











