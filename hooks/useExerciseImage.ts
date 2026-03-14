import { Exercise } from '../types';

export const useExerciseImage = (exercise?: Exercise) => {
  if (!exercise) return null;

  // 1. Prioritera Supabase URL (admin-uppladdade bilder, tillgängliga för alla)
  if (exercise.imageUrl) {
    return exercise.imageUrl;
  }

  // 2. Fallback till lokal base64 bild (localStorage, endast för användaren som laddade upp)
  if (exercise.image) {
    return exercise.image;
  }

  // 3. Ingen bild
  return null;
};
