-- Add is_cancelled column to scheduled_activities table
-- This allows AI program tracking to distinguish between completed and cancelled passes

-- Add is_cancelled column to scheduled_activities
ALTER TABLE scheduled_activities
ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;

-- Verify the change
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'scheduled_activities'
AND column_name = 'is_cancelled';
