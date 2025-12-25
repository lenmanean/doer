-- Add UTM attribution and email lifecycle columns to waitlist table
-- This migration extends the waitlist table to support email automation and marketing attribution

-- UTM Attribution Columns
ALTER TABLE "public"."waitlist" 
ADD COLUMN IF NOT EXISTS "utm_source" text,
ADD COLUMN IF NOT EXISTS "utm_campaign" text,
ADD COLUMN IF NOT EXISTS "utm_medium" text,
ADD COLUMN IF NOT EXISTS "utm_content" text,
ADD COLUMN IF NOT EXISTS "utm_term" text,
ADD COLUMN IF NOT EXISTS "adset" text,
ADD COLUMN IF NOT EXISTS "ad_name" text;

-- Email Lifecycle Columns
ALTER TABLE "public"."waitlist" 
ADD COLUMN IF NOT EXISTS "welcome_sent_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "email_1_sent_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "email_2_sent_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "email_3_sent_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "launch_sent_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "unsubscribed_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "last_email_sent_at" timestamp with time zone;

-- Add comments for documentation
COMMENT ON COLUMN "public"."waitlist"."utm_source" IS 'UTM source parameter from marketing campaigns';
COMMENT ON COLUMN "public"."waitlist"."utm_campaign" IS 'UTM campaign parameter from marketing campaigns';
COMMENT ON COLUMN "public"."waitlist"."utm_medium" IS 'UTM medium parameter from marketing campaigns';
COMMENT ON COLUMN "public"."waitlist"."utm_content" IS 'UTM content parameter from marketing campaigns';
COMMENT ON COLUMN "public"."waitlist"."utm_term" IS 'UTM term parameter from marketing campaigns';
COMMENT ON COLUMN "public"."waitlist"."adset" IS 'Ad set identifier from advertising platforms';
COMMENT ON COLUMN "public"."waitlist"."ad_name" IS 'Ad name identifier from advertising platforms';

COMMENT ON COLUMN "public"."waitlist"."welcome_sent_at" IS 'Timestamp when welcome email was sent (immediately on signup)';
COMMENT ON COLUMN "public"."waitlist"."email_1_sent_at" IS 'NOT USED - Reserved for future use';
COMMENT ON COLUMN "public"."waitlist"."email_2_sent_at" IS 'NOT USED - Reserved for future use';
COMMENT ON COLUMN "public"."waitlist"."email_3_sent_at" IS 'NOT USED - Reserved for future use';
COMMENT ON COLUMN "public"."waitlist"."launch_sent_at" IS 'Timestamp when launch day email was sent';
COMMENT ON COLUMN "public"."waitlist"."unsubscribed_at" IS 'Timestamp when user unsubscribed from waitlist emails';
COMMENT ON COLUMN "public"."waitlist"."last_email_sent_at" IS 'Timestamp of the most recent email sent to this waitlist entry';







