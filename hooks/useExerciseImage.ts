import { Exercise } from '../types';

export const useExerciseImage = (exercise?: Exercise) => {
  if (!exercise) return null;

  // 1. Prioritera lokal base64 bild
  if (exercise.image) {
    return exercise.image;
  }

  // 2. Fallback till extern URL
  if (exercise.imageUrl) {
    return exercise.imageUrl;
  }
  
  // 3. Ingen bild
  return null;
};
