-- Add improve_model_enabled setting to user_settings
-- This allows users to opt-in/opt-out of model improvement data collection
-- We'll store this in a new column or in preferences JSONB

-- Check if privacy column exists, if not we'll add improve_model_enabled to preferences
-- For now, we'll just ensure the preferences column can handle this
-- The application will handle storing this in preferences JSONB under privacy.improve_model_enabled

