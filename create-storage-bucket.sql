-- Create Supabase Storage bucket for exercise images
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/maviagpzwdjywatckgii/editor

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload exercise images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exercise-images');

-- Create storage policy to allow everyone to read (public bucket)
CREATE POLICY "Anyone can view exercise images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'exercise-images');

-- Create storage policy to allow admins to delete
CREATE POLICY "Admins can delete exercise images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()::text
    AND is_admin = true
  )
);

-- Done! 🎉
-- Storage bucket 'exercise-images' is now ready
-- Public URL format: https://maviagpzwdjywatckgii.supabase.co/storage/v1/object/public/exercise-images/[filename]
