-- Fix biometric_logs: Add user_id to existing logs
-- Problem: Can't delete biometric logs because they lack user_id

-- Show current logs without user_id (for debugging)
SELECT id, date, weight, user_id
FROM biometric_logs
WHERE user_id IS NULL
LIMIT 10;

-- Update all logs without user_id to current user
-- NOTE: Run this WHILE LOGGED IN as the user who owns the logs
UPDATE biometric_logs
SET user_id = auth.uid()::text
WHERE user_id IS NULL;

-- Verify fix
SELECT COUNT(*) as logs_without_user_id
FROM biometric_logs
WHERE user_id IS NULL;

-- Should return 0 if successful
