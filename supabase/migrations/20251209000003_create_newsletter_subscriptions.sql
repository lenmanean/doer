-- Create newsletter_subscriptions table for storing blog newsletter signups
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'blog' CHECK (source IN ('blog', 'landing', 'other')),
    ip_address TEXT,
    user_agent TEXT,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- Add indexes for querying
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_email ON public.newsletter_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_subscribed_at ON public.newsletter_subscriptions(subscribed_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_is_active ON public.newsletter_subscriptions(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert subscriptions (public form)
CREATE POLICY "Anyone can insert newsletter subscriptions"
    ON public.newsletter_subscriptions
    FOR INSERT
    WITH CHECK (true);

-- Policy: Service role can read all subscriptions (for admin access)
CREATE POLICY "Service role can read all newsletter subscriptions"
    ON public.newsletter_subscriptions
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Policy: Service role can update subscriptions (for admin/unsubscribe)
CREATE POLICY "Service role can update newsletter subscriptions"
    ON public.newsletter_subscriptions
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE public.newsletter_subscriptions IS 'Stores newsletter email subscriptions from blog and other pages';
