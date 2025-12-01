-- Create contact_sales_submissions table for storing sales inquiry form submissions
CREATE TABLE IF NOT EXISTS public.contact_sales_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    solution_type TEXT NOT NULL CHECK (solution_type IN ('teams', 'educators', 'coaches')),
    
    -- Teams-specific fields
    company_name TEXT,
    team_size TEXT,
    industry TEXT,
    use_case TEXT,
    
    -- Educators-specific fields
    school_name TEXT,
    number_of_students TEXT,
    grade_level TEXT,
    subject_area TEXT,
    
    -- Coaches-specific fields
    business_name TEXT,
    number_of_clients TEXT,
    coaching_type TEXT,
    specialization TEXT,
    
    -- General message field
    message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add index for querying by solution type and date
CREATE INDEX IF NOT EXISTS idx_contact_sales_submissions_solution_type ON public.contact_sales_submissions(solution_type);
CREATE INDEX IF NOT EXISTS idx_contact_sales_submissions_created_at ON public.contact_sales_submissions(created_at DESC);

-- Add RLS policies
ALTER TABLE public.contact_sales_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can read submissions (for admin access)
CREATE POLICY "Service role can read all submissions"
    ON public.contact_sales_submissions
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Policy: Anyone can insert submissions (public form)
CREATE POLICY "Anyone can insert submissions"
    ON public.contact_sales_submissions
    FOR INSERT
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.contact_sales_submissions IS 'Stores contact sales form submissions from solutions pages';

