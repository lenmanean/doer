-- Add week_out_sent_at column to waitlist table
-- This column tracks when the week-out email (December 25 UTC) was sent

ALTER TABLE "public"."waitlist" 
ADD COLUMN IF NOT EXISTS "week_out_sent_at" timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN "public"."waitlist"."week_out_sent_at" IS 'Timestamp when week-out email was sent (December 25 UTC)';

