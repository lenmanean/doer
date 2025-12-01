-- Create waitlist table for email signups
-- This table stores email addresses and metadata for waitlist tracking

CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "source" text,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "waitlist_email_unique" UNIQUE ("email")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_waitlist_email" ON "public"."waitlist" ("email");
CREATE INDEX IF NOT EXISTS "idx_waitlist_created_at" ON "public"."waitlist" ("created_at" DESC);

-- Add comments
COMMENT ON TABLE "public"."waitlist" IS 'Stores email addresses for waitlist signups with source tracking';
COMMENT ON COLUMN "public"."waitlist"."email" IS 'User email address (unique)';
COMMENT ON COLUMN "public"."waitlist"."source" IS 'Source of signup (e.g., landing_page_hero, pricing_card, header_button)';
COMMENT ON COLUMN "public"."waitlist"."ip_address" IS 'IP address for analytics (optional)';
COMMENT ON COLUMN "public"."waitlist"."user_agent" IS 'User agent string for analytics (optional)';
COMMENT ON COLUMN "public"."waitlist"."created_at" IS 'Timestamp when user joined waitlist';

-- Enable RLS (Row Level Security)
ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public inserts (for waitlist signups)
CREATE POLICY "Allow public waitlist inserts"
    ON "public"."waitlist"
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Create policy to prevent public reads (admin-only access)
CREATE POLICY "Prevent public waitlist reads"
    ON "public"."waitlist"
    FOR SELECT
    TO anon, authenticated
    USING (false);

-- Service role can do everything (for admin operations)
-- This is the default behavior, but we can make it explicit
-- Service role bypasses RLS by default

