-- Create misuse_reports table for storing abuse/misuse reports
CREATE TABLE IF NOT EXISTS public.misuse_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    description TEXT NOT NULL,
    reported_url TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for querying
CREATE INDEX IF NOT EXISTS idx_misuse_reports_created_at ON public.misuse_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_misuse_reports_status ON public.misuse_reports(status);
CREATE INDEX IF NOT EXISTS idx_misuse_reports_user_id ON public.misuse_reports(user_id) WHERE user_id IS NOT NULL;

-- Add RLS policies
ALTER TABLE public.misuse_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert reports (public form)
CREATE POLICY "Anyone can insert misuse reports"
    ON public.misuse_reports
    FOR INSERT
    WITH CHECK (true);

-- Policy: Service role can read all reports (for admin access)
CREATE POLICY "Service role can read all misuse reports"
    ON public.misuse_reports
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Policy: Service role can update reports (for admin access)
CREATE POLICY "Service role can update misuse reports"
    ON public.misuse_reports
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- Policy: Users can read their own reports (if user_id matches)
CREATE POLICY "Users can read their own misuse reports"
    ON public.misuse_reports
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_misuse_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_misuse_reports_updated_at
    BEFORE UPDATE ON public.misuse_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_misuse_reports_updated_at();

-- Add comment
COMMENT ON TABLE public.misuse_reports IS 'Stores misuse/abuse reports submitted by users';
