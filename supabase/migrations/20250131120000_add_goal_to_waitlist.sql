-- Add goal column to waitlist table
-- This allows us to capture user goals during waitlist signup for pre-population on launch

ALTER TABLE "public"."waitlist" 
ADD COLUMN IF NOT EXISTS "goal" text;

-- Add comment
COMMENT ON COLUMN "public"."waitlist"."goal" IS 'User goal/dream captured during waitlist signup, will be pre-populated during account creation on launch';

-- Add index on goal for potential queries (though optional)
CREATE INDEX IF NOT EXISTS "idx_waitlist_goal" ON "public"."waitlist" ("goal") WHERE "goal" IS NOT NULL;

