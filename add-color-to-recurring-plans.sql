-- Add color column to recurring_plans table
-- This allows recurring plans to have a color that gets inherited by scheduled activities

-- Add color column to recurring_plans
ALTER TABLE recurring_plans
ADD COLUMN IF NOT EXISTS color TEXT;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'recurring_plans'
AND column_name = 'color';
