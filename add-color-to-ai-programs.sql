-- Add color column to ai_programs table
-- This allows AI programs to have a color that gets inherited by all scheduled activities

-- Add color column to ai_programs
ALTER TABLE ai_programs
ADD COLUMN IF NOT EXISTS color TEXT;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_programs'
AND column_name = 'color';
