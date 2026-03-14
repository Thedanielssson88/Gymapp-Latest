import { supabase } from './supabase';
import { INITIAL_EXERCISES } from '../data/initialExercises';

/**
 * Import base exercises to Supabase as public exercises
 * This should only be run ONCE by an admin/first user
 */
export async function importBaseExercisesToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log('🚀 Importing base exercises to Supabase...');

    // Convert to database format
    const baseExercises = INITIAL_EXERCISES.map(ex => ({
      id: ex.id,
      name: ex.name,
      english_name: ex.englishName,
      pattern: ex.pattern,
      tier: ex.tier,
      muscle_groups: ex.muscleGroups,
      primary_muscles: ex.primaryMuscles,
      secondary_muscles: ex.secondaryMuscles,
      equipment: ex.equipment,
      equipment_requirements: ex.equipmentRequirements,
      difficulty_multiplier: ex.difficultyMultiplier,
      bodyweight_coefficient: ex.bodyweightCoefficient,
      tracking_type: ex.trackingType,
      image_url: ex.imageUrl,
      image: ex.image,
      description: ex.description,
      instructions: ex.instructions,
      alternative_ex_ids: ex.alternativeExIds,
      user_modified: false,
      score: 0,
      user_rating: null,
      is_public: true, // Mark as public
      user_id: null // No owner
    }));

    // Import in batches of 100
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < baseExercises.length; i += batchSize) {
      const batch = baseExercises.slice(i, i + batchSize);

      const { error } = await supabase
        .from('exercises')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`Error importing batch ${i / batchSize + 1}:`, error);
        return { success: false, count: imported, error: error.message };
      }

      imported += batch.length;
      console.log(`✅ Imported ${imported}/${baseExercises.length} exercises`);
    }

    console.log('🎉 Done! Base exercises imported.');
    return { success: true, count: imported };
  } catch (error: any) {
    console.error('❌ Import failed:', error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Check if base exercises have already been imported
 */
export async function checkBaseExercisesImported(): Promise<boolean> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id')
    .eq('is_public', true)
    .limit(1);

  if (error) {
    console.error('Error checking base exercises:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}
