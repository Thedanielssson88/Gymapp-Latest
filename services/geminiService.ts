
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, WorkoutSession, Exercise, MovementPattern, MuscleGroup, AIProgram, AIPlanResponse, Equipment, PlannedExercise, Zone, ProgressionRate, BiometricLog, UserMission, MagazineTone } from "../types";
import { ALL_MUSCLE_GROUPS } from '../utils/recovery';
import { storage } from './storage';
import { ProgressionRules } from "../utils/progression";
import { calculateVolumeByMuscleGroup, analyzeConsistency } from '../utils/analysis';
import { calculate1RM } from "../utils/fitness";

export interface ExerciseRecommendation {
  existingId?: string;
  isNew: boolean;
  reason: string;
  data: Exercise;
}

export interface ExerciseSearchResponse {
  motivation: string;
  recommendations: ExerciseRecommendation[];
}

// Hjälpfunktion för att hämta nyckel
const getApiKey = async (): Promise<string> => {
  // 1. Kolla inställningar först
  const profile = await storage.getUserProfile();
  if (profile.settings?.geminiApiKey) {
    return profile.settings.geminiApiKey;
  }
  
  // 2. Fallback till .env
  const envKey = process.env.API_KEY;
  if (envKey) return envKey;

  throw new Error("Ingen API-nyckel hittad. Gå till Inställningar och lägg in din Gemini API Key.");
};


/**
 * Genererar personliga träningsinsikter med Gemini API.
 */
export const getWorkoutInsights = async (
  profile: UserProfile, 
  session: WorkoutSession,
  exerciseHistory: string
): Promise<string> => {
  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analysera följande atletprofil och ge ett kort, motiverande tips:
Namn: ${profile.name}
Vikt: ${profile.weight} kg
Mål: ${profile.goal}
Nuvarande pass: ${session.name || 'Uppvärmning'}
Historik: ${exerciseHistory}`,
      config: {
        systemInstruction: "Du är en expertcoach inom styrketräning och biomekanik. Svara på svenska. Ditt tips ska vara professionellt, kortfattat (max 20 ord) och direkt applicerbart på användarens mål och profil.",
        temperature: 0.7,
      },
    });

    const text = response.text;
    return text || "Fokusera på kontakten i varje repetition idag för maximal muskelaktivering.";
  } catch (error) {
    if (error instanceof Error && error.message.includes("Ingen API-nyckel hittad")) {
        console.error("Gemini API-nyckel saknas:", error);
        return "Ange API-nyckel i Inställningar för AI-tips.";
    }
    console.error("Kunde inte hämta insikter från Gemini API:", error);
    return "Fokusera på kontrollerade excentriska faser idag för att maximera muskelkontakten.";
  }
};

/**
 * Rekommenderar övningar baserat på användarens önskemål och befintliga bibliotek.
 */
export const recommendExercises = async (
  userRequest: string,
  existingExercises: Exercise[]
): Promise<ExerciseSearchResponse> => {
  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const exerciseIndex = existingExercises.map(e => `${e.id}: ${e.name}`).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Användaren vill ha övningsförslag för: "${userRequest}".
      
      NUVARANDE BIBLIOTEK (ID: Namn):
      ${exerciseIndex}`,
      config: {
        systemInstruction: `Du är en expertcoach. 
        UPPGIFT:
        1. Skriv en kort motivation (max 2 meningar) till varför övningarna valts.
        2. Identifiera de 5-8 bästa övningarna för användarens önskemål.
        3. Sök först i biblioteket. Om en övning finns, använd dess exakta ID.
        4. Om en viktig övning SAKNAS, skapa den som en ny övning med ALL teknisk data enligt reglerna nedan.

        REGLER FÖR NYA ÖVNINGAR:
        1. ID: Skapa ett unikt slug-id (t.ex. 'hyrox-sled-push').
        2. BESKRIVNING: Skriv en tydlig steg-för-steg instruktion på SVENSKA. Fokusera på rörelsen ("Sänk stången till bröstet", "Håll ryggen rak"). Undvik för mycket medicinska termer.
        3. MUSKLER: Identifiera 'primaryMuscles' (de som gör grovjobbet) och 'secondaryMuscles' (hjälpmuskler).
        4. KATEGORISERING: 
          - Pattern: Välj ett passande rörelsemönster.
          - Tier: Tier 1 (Tunga basövningar), Tier 2 (Komplement), Tier 3 (Isolering/Småövningar).
        5. BALANSERING AV POÄNG (KRITISKT):
          - bodyweightCoefficient: Hur mycket av kroppsvikten som räknas. 
            * 0.0: För alla övningar med externa vikter (Bänkpress, Knäböj med stång).
            * 0.2 - 0.4: För lätta kroppsviktsövningar på golvet (Ab-wheel, Rygglyft, Situps). 
            * 0.6 - 0.7: För medeltunga kroppsviktsövningar (Armhävningar, Benböj utan vikt).
            * 1.0: Endast för övningar där man lyfter hela sin vikt (Chins, Pullups, Dips).
          - difficultyMultiplier: Sätt mellan 0.5 (lätt) och 1.5 (krävande). En tung basövning bör ligga runt 1.0-1.2. Ab-wheel bör vara ca 0.8.
        6. UTRUSTNINGSLOGIK:
          - equipmentRequirements: En array av grupper (arrays). Varje inre grupp är ett 'ELLER'-krav. Flera grupper är 'OCH'-krav.
            Exempel 1: Kräver Skivstång OCH Bänk: [["Skivstång"], ["Träningsbänk"]].
            Exempel 2: Kräver Skivstång ELLER Hantlar: [["Skivstång", "Hantlar"]].`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            motivation: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  isNew: { type: Type.BOOLEAN },
                  existingId: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  data: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      englishName: { type: Type.STRING },
                      pattern: { type: Type.STRING, enum: Object.values(MovementPattern) },
                      primaryMuscles: { type: Type.ARRAY, items: { type: Type.STRING, enum: ALL_MUSCLE_GROUPS } },
                      secondaryMuscles: { type: Type.ARRAY, items: { type: Type.STRING, enum: ALL_MUSCLE_GROUPS } },
                      muscleGroups: { type: Type.ARRAY, items: { type: Type.STRING, enum: ALL_MUSCLE_GROUPS } },
                      equipment: { type: Type.ARRAY, items: { type: Type.STRING, enum: Object.values(Equipment) } },
                      equipmentRequirements: { 
                        type: Type.ARRAY, 
                        items: { 
                          type: Type.ARRAY, 
                          items: { type: Type.STRING, enum: Object.values(Equipment) } 
                        } 
                      },
                      description: { type: Type.STRING },
                      tier: { type: Type.STRING, enum: ['tier_1', 'tier_2', 'tier_3'] },
                      trackingType: { type: Type.STRING, enum: ['reps_weight', 'time_distance', 'reps_only', 'time_only', 'distance_weight', 'reps_time_weight'] },
                      difficultyMultiplier: { type: Type.NUMBER },
                      bodyweightCoefficient: { type: Type.NUMBER }
                    },
                    required: ["id", "name", "pattern", "primaryMuscles", "muscleGroups", "equipment", "tier", "trackingType", "difficultyMultiplier", "bodyweightCoefficient"]
                  }
                },
                required: ["isNew", "reason", "data"]
              }
            }
          },
          required: ["motivation", "recommendations"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");
    return JSON.parse(jsonText.trim());
  } catch (error) {
    console.error("Gemini Exercise Error:", error);
    if (error instanceof Error && error.message.includes("Ingen API-nyckel hittad")) {
        throw error;
    }
    throw new Error("Kunde inte hämta förslag från AI.");
  }
};

/**
 * Genererar detaljerad övningsdata från ett namn.
 */
export const generateExerciseDetailsFromGemini = async (
  exerciseName: string,
  allExercises: Exercise[]
): Promise<Partial<Exercise>> => {
  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const exerciseIndex = allExercises.map(e => `ID: ${e.id}, Namn: ${e.name}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Fyll i data för övningen: "${exerciseName}"
      
      EXISTERANDE BIBLIOTEK:
      ${exerciseIndex}`,
      config: {
        systemInstruction: `Du är en expert på biomekanik och styrketräning. Din uppgift är att fylla i data för en träningsövning i en app.

INSTRUKTIONER:
1. BESKRIVNING: Skriv en tydlig steg-för-steg instruktion på SVENSKA. Fokusera på rörelsen ("Sänk stången till bröstet", "Håll ryggen rak").
2. MUSKLER: Identifiera 'primaryMuscles' (de som gör grovjobbet) och 'secondaryMuscles' (hjälpmuskler).
3. KATEGORISERING: 
   - Pattern: Välj ett rörelsemönster.
   - Tier: Tier 1 (Tunga basövningar), Tier 2 (Komplement), Tier 3 (Isolering/Småövningar).
4. BALANSERING AV POÄNG (KRITISKT):
   - bodyweightCoefficient: Detta avgör hur mycket av användarens vikt som räknas. 
     * 0.0: För alla övningar med externa vikter (Bänkpress, Knäböj med stång).
     * 0.2 - 0.4: För lätta kroppsviktsövningar på golvet (Ab-wheel, Rygglyft, Situps). 
     * 0.6 - 0.7: För medeltunga övningar (Armhävningar, Benböj utan vikt).
     * 1.0: Endast för övningar där man lyfter hela sin vikt (Chins, Pullups, Dips).
   - difficultyMultiplier: Sätt mellan 0.5 (mycket enkelt) och 1.5 (extremt krävande). En tung basövning bör ligga runt 1.0-1.2. Ab-wheel bör vara ca 0.8.
5. UTRUSTNINGSLOGIK:
   - equipment: En platt lista på all utrustning som kan användas (för visning).
   - equipmentRequirements: En array av grupper (arrays). Varje inre grupp är ett 'ELLER'-krav. Flera grupper är 'OCH'-krav.
     Exempel 1: Kräver Skivstång OCH Bänk: [["Skivstång"], ["Träningsbänk"]].
     Exempel 2: Kräver Skivstång ELLER Hantlar: [["Skivstång", "Hantlar"]].
6. ALTERNATIVA ÖVNINGAR: Hitta 3-4 alternativa övningar från det existerande biblioteket som tränar samma primära muskler och har liknande rörelsemönster. Returnera deras exakta ID:n i fältet 'alternativeExIds'.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            englishName: { type: Type.STRING },
            description: { type: Type.STRING },
            primaryMuscles: { type: Type.ARRAY, items: { type: Type.STRING, enum: ALL_MUSCLE_GROUPS } },
            secondaryMuscles: { type: Type.ARRAY, items: { type: Type.STRING, enum: ALL_MUSCLE_GROUPS } },
            muscleGroups: { type: Type.ARRAY, items: { type: Type.STRING, enum: ALL_MUSCLE_GROUPS } },
            equipment: { type: Type.ARRAY, items: { type: Type.STRING, enum: Object.values(Equipment) } },
            equipmentRequirements: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING, enum: Object.values(Equipment) } 
              } 
            },
            pattern: { type: Type.STRING, enum: Object.values(MovementPattern) },
            tier: { type: Type.STRING, enum: ['tier_1', 'tier_2', 'tier_3'] },
            trackingType: { type: Type.STRING, enum: ['reps_weight', 'time_distance', 'reps_only', 'time_only', 'distance_weight', 'reps_time_weight'] },
            difficultyMultiplier: { type: Type.NUMBER },
            bodyweightCoefficient: { type: Type.NUMBER },
            alternativeExIds: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    if (error instanceof Error && error.message.includes("Ingen API-nyckel hittad")) {
        throw error;
    }
    throw new Error("AI-genereringen misslyckades.");
  }
};

export const generateProfessionalPlan = async (
  userRequest: string,
  userHistory: WorkoutSession[],
  availableExercises: Exercise[],
  currentProfile: UserProfile,
  pplStats: any,
  preferences: { daysPerWeek: number; durationMinutes: number; durationWeeks: number; progressionRate: ProgressionRate; }
): Promise<AIPlanResponse> => {
  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const { daysPerWeek, durationMinutes, durationWeeks, progressionRate } = preferences;
    const exerciseIndex = availableExercises.map(e => `ID: ${e.id}, Namn: ${e.name}, Utrustning: [${e.equipment.join(', ')}]`).join('\n');

    const today = new Date().toISOString().split('T')[0];

    const contents = `
      Du är en expert-PT och träningsfysiolog. Skapa ett detaljerat träningsprogram.
      
      CURRENT CONTEXT:
      - Today's Date: ${today}

      CRITICAL RULES:
      1. All new deadlines and scheduled workouts MUST be in the future relative to ${today}.
      2. NEVER use dates from past years (e.g. 2023).
      3. Format all dates as YYYY-MM-DD.
      4. STRICT RULE: For bodyweight isometric exercises (like Plank), NEVER set a weight target. Always set a TIME target (seconds). Keep target instructions under 5 words.

      VIKTIGT: Använd ENDAST övningar från listan nedan. Svara med det exakta ID:t för varje övning.
      TILLGÄNGLIGA ÖVNINGAR:
      ${exerciseIndex}

      MÅL: "${userRequest}"
      TIDSPERSPEKTIV: ${durationWeeks} veckor, ${daysPerWeek} pass/vecka, ${durationMinutes} min/pass.
      NUVARANDE STYRKA (Uppskattat 1RM): ${JSON.stringify(pplStats)}
      ÖKNINGSTAKT VALD AV ANVÄNDAREN: ${progressionRate.toUpperCase()}.

      INSTRUKTIONER FÖR VIKTER OCH PROGRESSION:
      Basera progressionen på den valda ökningstakten:
      - conservative: Minimal ökning. Fokus på teknik/rehab. (+0.5-1kg/vecka).
      - normal: Standard linjär progression. (+2.5kg/vecka för överkropp, +5kg/vecka för ben).
      - aggressive: Utmana användaren. Utnyttja "newbie gains" eller tuff periodisering. Öka snabbare om det är fysiologiskt möjligt (t.ex. +2.5kg per pass istället för per vecka för en nybörjare).
      
      VIKTIGT - REALISM:
      1. För SMART GOALS, använd NUVARANDE STYRKA för att sätta ett realistiskt 'startValue'.
      2. Bedöm om målet är fysiologiskt nåbart på ${durationWeeks} veckor med vald takt.
      3. Även vid 'aggressive', om målet är orealistiskt (t.ex. +60kg på 4v), designa programmet som "Fas 1" av en längre plan.
      4. Maximera då ökningen under denna fas (t.ex. gå från 40kg -> 55kg istället för 43kg) och skriv i 'motivation' att detta är en ambitiös start på en längre resa.
      5. Sätt målet (smartGoals) för sista veckan i detta program till en realistisk delvinst.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            motivation: { type: Type.STRING },
            smartGoals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  startValue: { type: Type.NUMBER },
                  targetValue: { type: Type.NUMBER },
                  targetType: { type: Type.STRING, enum: ['exercise', 'body_weight', 'body_measurement'] },
                  exerciseId: { type: Type.STRING },
                  deadline: { type: Type.STRING },
                  strategy: { type: Type.STRING, enum: ['linear', 'undulating', 'peaking'] }
                },
                required: ['title', 'startValue', 'targetValue', 'targetType', 'deadline', 'strategy']
              }
            },
            routines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  weekNumber: { type: Type.NUMBER },
                  scheduledDay: { type: Type.NUMBER },
                  exercises: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        targetSets: { type: Type.NUMBER },
                        targetReps: { type: Type.STRING },
                        estimatedWeight: { type: Type.NUMBER }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    if (error instanceof Error && error.message.includes("Ingen API-nyckel hittad")) {
        throw error;
    }
    throw new Error("AI-assistenten kunde inte skapa en plan.");
  }
};

export const generateNextPhase = async (
  currentProgram: AIProgram,
  programHistory: WorkoutSession[],
  availableExercises: Exercise[],
  pplStats: { start: any; current: any },
  preferences: {
    daysPerWeek: number;
    durationMinutes: number;
    weeks: number;
    progressionRate: ProgressionRate;
  },
  rules: ProgressionRules
): Promise<AIPlanResponse> => {
  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const { daysPerWeek, durationMinutes, weeks, progressionRate } = preferences;
    const exerciseIndex = availableExercises.map(e => `ID: ${e.id}, Namn: ${e.name}, Utrustning: [${e.equipment.join(', ')}]`).join('\n');

    const contents = `
      Skapa nästa fas (Fas ${ (currentProgram.phaseNumber || 1) + 1}) för programmet "${currentProgram.name}".
      
      VIKTIGT: Använd ENDAST övningar från listan nedan. Svara med det exakta ID:t för varje övning.
      TILLGÄNGLIGA ÖVNINGAR:
      ${exerciseIndex}

      LÅNGSIKTIGT MÅL: "${currentProgram.longTermGoalDescription}"
      TIDSPERSPEKTIV: ${weeks} veckor, ${daysPerWeek} pass/vecka, ${durationMinutes} min/pass.
      FÖREGÅENDE FAS START-1RM: ${JSON.stringify(pplStats.start)}
      NUVARANDE 1RM: ${JSON.stringify(pplStats.current)}
      ÖKNINGSTAKT VALD AV ANVÄNDAREN: ${progressionRate.toUpperCase()}.
      COACHENS AUTOMATISKA ANALYS: "${rules.feedback}"
      
      UPPGIFT:
      1. Designa nästa ${weeks}-veckors fas baserat på den nya styrkan (NUVARANDE 1RM) och coach-analysen.
      2. Använd en belastningsökning på cirka ${Math.round((rules.loadMultiplier - 1) * 100)}% från nuvarande 1RM för huvudlyften.
      3. ${rules.volumeAction === 'increase' ? 'Öka volymen (fler set/övningar)' : rules.volumeAction === 'decrease' ? 'Minska volymen (färre set/övningar)' : 'Behåll nuvarande volymstruktur'}.
      4. Variera gärna några assistansövningar för att undvika platåer, men behåll de stora baslyften.
      5. Skriv en kort, motiverande text för den nya fasen i "motivation"-fältet.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            motivation: { type: Type.STRING },
            routines: { 
                type: Type.ARRAY, 
                items: { 
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      weekNumber: { type: Type.NUMBER },
                      scheduledDay: { type: Type.NUMBER },
                      exercises: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            targetSets: { type: Type.NUMBER },
                            targetReps: { type: Type.STRING },
                            estimatedWeight: { type: Type.NUMBER }
                          }
                        }
                      }
                    }
                } 
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    if (error instanceof Error && error.message.includes("Ingen API-nyckel hittad")) {
        throw error;
    }
    throw new Error("Kunde inte generera nästa fas.");
  }
};

export async function generateWorkoutFromPrompt(
  prompt: string,
  allExercises: Exercise[],
  activeZone: Zone,
  history: WorkoutSession[]
): Promise<PlannedExercise[]> {
  const equipmentList = activeZone.inventory.join(", ");
  const exerciseList = JSON.stringify(allExercises.map(e => ({id: e.id, name: e.name, equipment: e.equipment})));

  const systemInstruction = `Du är en expert-PT. Skapa ett träningspass med 4-7 övningar baserat på användarens önskemål och tillgänglig utrustning. Använd ENDAST övningar från den angivna listan. Svara ENDAST med ett JSON-objekt enligt det specificerade formatet.`;
  const contents = `
    Önskemål: "${prompt}"
    Tillgänglig utrustning: ${equipmentList}
    Tillgängliga övningar: ${exerciseList}
  `;

  try {
    const apiKey = await getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            workout: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  exerciseId: { type: Type.STRING },
                  sets: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        reps: { type: Type.NUMBER },
                        weight: { type: Type.NUMBER },
                        targetRpe: { type: Type.NUMBER },
                      },
                      required: ["reps", "weight"]
                    }
                  }
                },
                required: ["exerciseId", "sets"]
              }
            }
          },
          required: ["workout"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Tomt svar från AI");

    const data = JSON.parse(jsonText.trim());
    return data.workout as PlannedExercise[];
  } catch (error) {
    console.error("AI Workout Generation failed", error);
    if (error instanceof Error && error.message.includes("Ingen API-nyckel hittad")) {
        throw error;
    }
    throw new Error("Kunde inte generera ett AI-pass.");
  }
}

// --- NEW ENHANCED MAGAZINE ARTICLE GENERATOR ---

export const generateMagazineArticle = async (
    history: WorkoutSession[],
    biometrics: BiometricLog[],
    missions: UserMission[],
    profile: UserProfile,
    programs: AIProgram[],
    allExercises: Exercise[]
): Promise<any> => {
    try {
        const apiKey = await getApiKey();
        const ai = new GoogleGenAI({ apiKey });

        const historySummary = history.map(s => ({
            date: s.date,
            name: s.name,
            rpe: s.rpe,
            feeling: s.feeling,
            exerciseCount: s.exercises.length,
            exercises: s.exercises.map(e => ({ 
              name: allExercises.find(ex => ex.id === e.exerciseId)?.name,
              max1RM: Math.max(...e.sets.map(set => calculate1RM(set.weight, set.reps)))
            }))
        }));

        const biometricsSummary = biometrics.map(b => ({ date: b.date, weight: b.weight }));
        const consistency = analyzeConsistency(history);
        const volume = calculateVolumeByMuscleGroup(history, allExercises);
        
        const toneMapping = {
            friend: "en peppig, stöttande och glad träningskompis.",
            coach: "en stenhård, no-nonsense 'drill sergeant'-coach som kräver disciplin.",
            scientist: "en datadriven, vetenskaplig analytiker som fokuserar på biomekanik och fysiologi."
        };
        const selectedTone = toneMapping[profile.settings?.magazineTone || 'friend'];

        const contents = `
          ANVÄNDARDATA (senaste 30d):
          - Profil: ${JSON.stringify({ name: profile.name, goal: profile.goal })}
          - Pass: ${JSON.stringify(historySummary)}
          - Viktlogg: ${JSON.stringify(biometricsSummary)}
          - Mål & Program: ${JSON.stringify({ missions, programs })}
          - Träningsfrekvens: ${JSON.stringify(consistency)}
          - Total Volym per Muskelgrupp (kg): ${JSON.stringify(volume)}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
              systemInstruction: `Du är en expert-redaktör för den personliga träningstidningen "MorphFit Magazine". Din ton ska vara som ${selectedTone}.
              UPPGIFT: Analysera datan och generera en engagerande, personlig artikel. Svara ENDAST med ett JSON-objekt enligt schemat.
              
              REGLER:
              1. Var specifik. Använd siffror från datan.
              2. Hitta "Månadens MVP": den övning med störst %-ökning i 1RM. Om ingen ökning, välj den mest tränade övningen.
              3. "Quick Fix" ska vara ett konkret, kort tips baserat på en svaghet (t.ex. oregelbunden träning, obalans i volym).
              4. Var kreativ och insiktsfull. Koppla samman olika datapunkter (t.ex. viktmål och träningsfrekvens).
              5. Den interaktiva frågan ska vara öppen och uppmuntra till reflektion.`,
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      title: { type: Type.STRING, description: "En personlig, catchy rubrik (max 8 ord)." },
                      ingress: { type: Type.STRING, description: "En kort, peppande inledning (2-3 meningar)." },
                      statusQuo: {
                          type: Type.OBJECT,
                          properties: {
                              title: { type: Type.STRING, default: "Status: Nulägesanalys" },
                              analysis: { type: Type.STRING, description: "Analys av träningsfrekvens och regelbundenhet." },
                              tip: { type: Type.STRING, description: "Ett konkret tips baserat på frekvensanalysen." }
                          }
                      },
                      deepDive: {
                          type: Type.OBJECT,
                          properties: {
                              title: { type: Type.STRING, default: "Statistik-dykning" },
                              analysis: { type: Type.STRING, description: "En insikt om volymfördelning mellan muskelgrupper eller progression mot mål." }
                          }
                      },
                      mvpExercise: {
                          type: Type.OBJECT,
                          properties: {
                              title: { type: Type.STRING, default: "Månadens MVP" },
                              name: { type: Type.STRING, description: "Namnet på övningen." },
                              reason: { type: Type.STRING, description: "Varför den är MVP (t.ex. '+5% i 1RM')." }
                          }
                      },
                      quickFix: {
                          type: Type.OBJECT,
                          properties: {
                              title: { type: Type.STRING, default: "Coachens Quick Fix" },
                              tip: { type: Type.STRING, description: "Ett kort, konkret tips för att fixa en svaghet." }
                          }
                      },
                      coachsCorner: {
                          type: Type.OBJECT,
                          properties: {
                              title: { type: Type.STRING, default: "Coachens Hörn" },
                              advice: { type: Type.STRING, description: "Ett personligt råd som kopplar ihop mål, biometri och träning." }
                          }
                      },
                      closingQuote: { type: Type.STRING, description: "Ett kort, inspirerande citat." },
                      interactiveQuestion: { type: Type.STRING, description: "En öppen fråga för användaren att reflektera över." }
                  },
                  required: ["title", "ingress", "statusQuo", "deepDive", "mvpExercise", "quickFix", "coachsCorner", "closingQuote", "interactiveQuestion"]
              }
            },
        });
        
        const jsonText = response.text;
        if (!jsonText) throw new Error("Tomt svar från AI:n.");
        return JSON.parse(jsonText.trim());

    } catch (error) {
        console.error("Magazine generation error", error);
        if (error instanceof Error && error.message.includes("Ingen API-nyckel hittad")) {
            throw error;
        }
        throw new Error("AI-redaktören kunde inte skapa en artikel.");
    }
};
