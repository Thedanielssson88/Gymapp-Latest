-- Add source_activity_color column to workout_history table
-- This preserves the color from planned activities when they are completed

-- Add source_activity_color column to workout_history
ALTER TABLE workout_history
ADD COLUMN IF NOT EXISTS source_activity_color TEXT;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workout_history'
AND column_name = 'source_activity_color';
