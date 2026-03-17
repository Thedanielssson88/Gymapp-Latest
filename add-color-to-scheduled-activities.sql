-- Add color column to scheduled_activities table
-- This allows scheduled activities to have a color just like recurring plans

-- Add color column to scheduled_activities
ALTER TABLE scheduled_activities
ADD COLUMN IF NOT EXISTS color TEXT;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scheduled_activities'
AND column_name = 'color';
