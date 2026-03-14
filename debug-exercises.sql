-- Debug exercises table schema and policies

-- 1. Check if is_public column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'exercises'
AND column_name IN ('id', 'user_id', 'is_public', 'name');

-- 2. Check current policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'exercises';

-- 3. Try to see if you can read exercises
SELECT COUNT(*) as total_exercises FROM exercises;

-- 4. Check your user_id and is_admin status
SELECT id, name, is_admin FROM user_profiles WHERE id = auth.uid()::text;
