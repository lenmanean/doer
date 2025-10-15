-- Migration: Add Milestone Auto-Fill Trigger
-- Purpose: Ensure milestone_id is automatically populated in task_completions for data integrity
-- Date: 2025-10-11

CREATE OR REPLACE FUNCTION public.auto_fill_milestone_in_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.milestone_id IS NULL THEN
    SELECT t.milestone_id INTO NEW.milestone_id
    FROM public.tasks t
    WHERE t.id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_fill_milestone_in_completion IS 
'Automatically populates milestone_id in task_completions based on the associated task';

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trg_fill_milestone_in_completion ON public.task_completions;
CREATE TRIGGER trg_fill_milestone_in_completion
BEFORE INSERT ON public.task_completions
FOR EACH ROW
EXECUTE FUNCTION public.auto_fill_milestone_in_completion();

COMMENT ON TRIGGER trg_fill_milestone_in_completion ON public.task_completions IS 
'Ensures milestone_id is populated before inserting task completions';



