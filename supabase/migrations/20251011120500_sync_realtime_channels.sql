-- Migration: Unify Realtime Channels
-- Purpose: Standardize all notifications under 'plan_update' channel to fix mismatch with frontend
-- Date: 2025-10-11

-- Update refresh_plan_state to use unified channel
CREATE OR REPLACE FUNCTION public.refresh_plan_state(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_notify(
    'plan_update',
    jsonb_build_object(
      'action', 'manual_refresh',
      'plan_id', p_plan_id,
      'timestamp', NOW()
    )::TEXT
  );
END;
$$;

COMMENT ON FUNCTION public.refresh_plan_state IS 
'Manually trigger a plan state refresh notification on the unified plan_update channel';

-- Update trigger function to use unified channel
CREATE OR REPLACE FUNCTION public.notify_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_notify(
    'plan_update',
    jsonb_build_object(
      'user_id', COALESCE(NEW.user_id, OLD.user_id),
      'plan_id', COALESCE(NEW.plan_id, OLD.plan_id),
      'task_id', COALESCE(NEW.task_id, OLD.task_id),
      'action', TG_OP,
      'timestamp', NOW()
    )::TEXT
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.notify_plan_update IS 
'Trigger function that emits plan update notifications on the unified plan_update channel';



