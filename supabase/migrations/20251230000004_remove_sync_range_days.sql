-- Remove sync_range_days column from calendar_connections
-- We now use sync type (full vs basic) instead of date ranges

ALTER TABLE public.calendar_connections
DROP COLUMN IF EXISTS sync_range_days;

COMMENT ON TABLE public.calendar_connections IS 
  'Stores OAuth connections to calendar providers. Sync type (full/basic) is now specified per sync operation rather than stored as a setting.';

