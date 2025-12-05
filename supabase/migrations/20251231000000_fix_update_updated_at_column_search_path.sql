-- Fix update_updated_at_column function search_path security issue
-- Addresses Supabase security warning: "Function public.update_updated_at_column has a role mutable search_path"
-- 
-- Security: Functions must set search_path to prevent search path injection attacks.
-- This ensures functions execute with a predictable schema search path regardless 
-- of the caller's search_path setting.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS 
  'Trigger function that automatically updates the updated_at column to the current timestamp. 
   Security: search_path is set to prevent search path injection attacks.';









