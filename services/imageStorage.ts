import { supabase } from './supabase';

const BUCKET_NAME = 'exercise-images';

/**
 * Upload an image to Supabase Storage
 * @param file - The image file to upload
 * @param exerciseId - The exercise ID (used as filename)
 * @returns The public URL of the uploaded image
 */
export const uploadExerciseImage = async (
  file: File,
  exerciseId: string
): Promise<string> => {
  try {
    // Create a unique filename using exercise ID and timestamp
    const fileExt = file.name.split('.').pop();
    const fileName = `${exerciseId}-${Date.now()}.${fileExt}`;

    // Upload the file
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true // Replace if exists
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Upload a base64 image to Supabase Storage
 * @param base64String - The base64 encoded image
 * @param exerciseId - The exercise ID
 * @returns The public URL of the uploaded image
 */
export const uploadBase64Image = async (
  base64String: string,
  exerciseId: string
): Promise<string> => {
  try {
    // Convert base64 to Blob
    const base64Data = base64String.split(',')[1] || base64String;
    const mimeMatch = base64String.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Create a file extension from mime type
    const fileExt = mimeType.split('/')[1] || 'jpg';
    const fileName = `${exerciseId}-${Date.now()}.${fileExt}`;

    // Upload the blob
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading base64 image:', error);
    throw error;
  }
};

/**
 * Delete an exercise image from Supabase Storage
 * @param imageUrl - The public URL of the image
 */
export const deleteExerciseImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteExerciseImage:', error);
    // Don't throw - deletion errors shouldn't block other operations
  }
};
