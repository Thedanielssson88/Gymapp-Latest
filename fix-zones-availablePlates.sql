-- Add availablePlates column to zones table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- Add the column (JSONB to store array of numbers)
ALTER TABLE zones ADD COLUMN IF NOT EXISTS "availablePlates" JSONB;

-- Also add snake_case version for consistency
ALTER TABLE zones ADD COLUMN IF NOT EXISTS available_plates JSONB;

-- Done! 🎉
