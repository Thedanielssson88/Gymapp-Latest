import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://maviagpzwdjywatckgii.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmlhZ3B6d2RqeXdhdGNrZ2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ3OTQ5MSwiZXhwIjoyMDg5MDU1NDkxfQ.RUVfRrAd6K9EUckLR6gouZe_w6-joISaO9F2P0EcvSc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixRLS() {
  console.log('🔧 Fixing RLS policies for user_profiles...\n');

  // 1. Check if table exists
  const { data: tables, error: tableError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  if (tableError && tableError.code === '42P01') {
    console.log('❌ Table user_profiles does not exist.');
    console.log('⚠️  You need to create it first in Supabase SQL Editor:\n');
    console.log(`
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  weight NUMERIC,
  height NUMERIC,
  age INTEGER,
  gender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE
  USING (auth.uid() = id);
`);
    return;
  }

  if (tableError) {
    console.error('❌ Error checking table:', tableError);
    return;
  }

  console.log('✅ Table user_profiles exists!');
  console.log('📊 Current data:', tables);

  console.log('\n⚠️  Note: I cannot modify RLS policies via the Supabase client.');
  console.log('You need to run the SQL in Supabase SQL Editor to add the policies.');
}

fixRLS();
