import { createClient } from '@supabase/supabase-js';
import { INITIAL_EXERCISES } from './data/initialExercises.ts';

const supabaseUrl = 'https://maviagpzwdjywatckgii.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmlhZ3B6d2RqeXdhdGNrZ2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ3OTQ5MSwiZXhwIjoyMDg5MDU1NDkxfQ.RUVfRrAd6K9EUckLR6gouZe_w6-joISaO9F2P0EcvSc';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function importBaseExercises() {
  console.log('🚀 Importing base exercises to Supabase...\n');

  // Convert INITIAL_EXERCISES to database format
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
    user_modified: ex.userModified || false,
    score: ex.score || 0,
    user_rating: ex.userRating || null,
    is_public: true, // Mark as public base exercise
    user_id: null // No specific user owns these
  }));

  console.log(`📊 Total exercises to import: ${baseExercises.length}`);

  // Import in batches of 100 (Supabase limit)
  const batchSize = 100;
  let imported = 0;

  for (let i = 0; i < baseExercises.length; i += batchSize) {
    const batch = baseExercises.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('exercises')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Error importing batch ${i / batchSize + 1}:`, error.message);
      continue;
    }

    imported += batch.length;
    console.log(`✅ Imported ${imported}/${baseExercises.length} exercises`);
  }

  console.log('\n🎉 Done! Base exercises imported to Supabase.');
  console.log('👉 All users will now see these exercises.');
}

importBaseExercises();
