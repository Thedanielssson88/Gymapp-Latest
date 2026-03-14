
export enum MovementPattern {
  SQUAT = 'Knäböj',
  HINGE = 'Höftfällning',
  HORIZONTAL_PUSH = 'Horisontell Press',
  VERTICAL_PUSH = 'Vertikal Press',
  HORIZONTAL_PULL = 'Horisontell Drag',
  VERTICAL_PULL = 'Vertikal Drag',
  LUNGE = 'Utfall',
  CORE = 'Bål',
  ISOLATION = 'Isolering',
  MOBILITY = 'Rörlighet / Stretch',
  REHAB = 'Rehab / Prehab',
  CARDIO = 'Kondition',
  EXPLOSIVE = 'Explosiv / Olympisk'
}

export type TrackingType = 'reps_weight' | 'time_distance' | 'time_only' | 'reps_only' | 'reps_time_weight' | 'distance_weight';

export type ExerciseTier = 'tier_1' | 'tier_2' | 'tier_3';

export type ProgressionRate = 'conservative' | 'normal' | 'aggressive';

export type MagazineTone = 'friend' | 'coach' | 'scientist';

export type MuscleGroup = 
  | 'Mage' 
  | 'Rygg' 
  | 'Biceps' 
  | 'Bröst' 
  | 'Säte' 
  | 'Baksida lår' 
  | 'Framsida lår' 
  | 'Axlar' 
  | 'Triceps' 
  | 'Ryggslut'
  | 'Vader' 
  | 'Trapezius' 
  | 'Abduktorer' 
  | 'Adduktorer' 
  | 'Underarmar' 
  | 'Nacke'
  | 'Höftböjare'
  | 'Tibialis'
  | 'Rotatorcuff'
  | 'Hela kroppen'
  | 'Rörlighet'
  | 'Balans'
  | 'Hamstrings'
  | 'Bröstrygg'
  | 'Greppstyrka';

export enum Equipment {
  BARBELL = 'Skivstång',
  EZ_BAR = 'EZ-stång',
  TRAP_BAR = 'Trap-bar / Hex-bar',
  DUMBBELL = 'Hantlar',
  KETTLEBELL = 'Kettlebell',
  PLATE = 'Viktskiva',
  LEG_PRESS = 'Benpress',
  HACK_SQUAT = 'Hack Squat',
  LEG_EXTENSION = 'Benspark',
  LEG_CURL = 'Lårcurl',
  CALF_RAISE = 'Vadpress',
  SMITH_MACHINE = 'Smith-maskin',
  CABLES = 'Kabelmaskin',
  LAT_PULLDOWN = 'Latsdrag',
  SEATED_ROW = 'Sittande Rodd',
  CHEST_PRESS = 'Bröstpress',
  SHOULDER_PRESS = 'Axelpress',
  PEC_DECK = 'Pec Deck / Flyes',
  ASSISTED_MACHINE = 'Assisterad Chins/Dips',
  BODYWEIGHT = 'Kroppsvikt',
  PULLUP_BAR = 'Räckhävsstång',
  DIP_STATION = 'Dipsställning',
  TRX = 'TRX / Ringar',
  BANDS = 'Gummiband',
  MEDICINE_BALL = 'Medicinboll',
  SANDBAG = 'Sandbag',
  BOX = 'Box / Låda',
  BENCH = 'Träningsbänk',
  SKI_ERG = 'SkiErg',
  ROWER = 'Roddmaskin',
  SLED = 'Släde',
  TREADMILL = 'Löpband',
  ASSAULT_BIKE = 'Assault Bike / Echo Bike',
  BIKE_ERG = 'BikeErg',
  TECHNOGYM_SKILLMILL = 'Kurvband / Skillmill',
  BOSU_BALL = 'Bosuboll / Balansplatta',
  FOAM_ROLLER = 'Foam Roller',
  ROPE = 'Klätterrep',
  JUMP_ROPE = 'Hopprep',
  LANDMINE = 'Landmine / Skivstångshörna',
  MACHINES = 'Maskiner (Övriga)',
  HARNESS = 'Sele',
  AB_WHEEL = 'Maghjul',
  WALL = 'Vägg',
}

export enum Goal {
  HYPERTROPHY = 'Muskelbygge',
  STRENGTH = 'Styrka (1RM Fokus)',
  ENDURANCE = 'Uthållighet',
  REHAB = 'Rehab'
}

export interface GoalTarget {
  id: string;
  name: string;
  targetSets: number;
  muscleGroups: MuscleGroup[];
}

export interface Exercise {
  id: string;
  name: string;
  englishName?: string;
  pattern: MovementPattern;
  tier: ExerciseTier;
  muscleGroups: MuscleGroup[]; 
  primaryMuscles: MuscleGroup[]; 
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment[];
  /**
   * Logical requirement groups for equipment.
   * Inner arrays are OR (at least one must be present).
   * Outer array is AND (all groups must be satisfied).
   * Example: [[BENCH], [BARBELL, DUMBBELL]] means Bench AND (Barbell OR Dumbbell).
   */
  equipmentRequirements?: Equipment[][];
  difficultyMultiplier: number;
  bodyweightCoefficient: number;
  trackingType?: TrackingType;
  imageUrl?: string;
  image?: string;
  description?: string;
  instructions?: string[];
  alternativeExIds?: string[];
  userModified?: boolean;
  score?: number;
  userRating?: 'up' | 'down' | null;
}

export interface BodyMeasurements {
  neck?: number;
  shoulders?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  bicepsL?: number;
  bicepsR?: number;
  thighL?: number;
  thighR?: number; 
  calvesL?: number;
  calvesR?: number;
  bodyFat?: number;
}

export interface UserSettings {
  includeWarmupInStats: boolean;
  restTimer?: number;
  keepAwake?: boolean;
  bodyViewMode?: 'list' | 'map';
  barbellWeight?: number; 
  dumbbellBaseWeight?: number; 
  vibrateButtons?: boolean;
  vibrateTimer?: boolean;
  googleDriveLinked?: boolean;
  autoSyncMode?: 'after_workout' | 'manual' | 'startup';
  restoreOnStartup?: boolean;
  lastCloudSync?: string;
  geminiApiKey?: string;
  magazineTone?: MagazineTone;
}

export interface UserProfile {
  id?: string;
  name: string;
  weight: number;
  height: number;
  level: 'Nybörjare' | 'Medel' | 'Avancerad' | 'Elit';
  goal: Goal;
  injuries: MuscleGroup[];
  measurements: BodyMeasurements;
  settings?: UserSettings;
}

export interface Zone {
  id: string;
  name: string;
  inventory: Equipment[];
  icon: string;
  availablePlates?: number[];
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  reps: number;
  weight: number;
  distance?: number;
  duration?: number;
  completed: boolean;
  rpe?: number;
  type?: SetType;
  fatigue?: number; 
}

export interface PlannedExercise {
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
  supersetId?: string; // Ett unikt ID som delas av övningar i samma superset
  trackingTypeOverride?: TrackingType;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  exercises: PlannedExercise[];
  category?: string;
  isAiGenerated?: boolean;
  programId?: string; // NYTT: Länkar rutinen till ett AI-program
}

export interface WorkoutSession {
  id: string;
  date: string;
  name: string;
  zoneId: string;
  locationName?: string;
  exercises: PlannedExercise[];
  isCompleted: boolean;
  duration?: number;
  rpe?: number;
  feeling?: string;
  isManual?: boolean;
  sourceActivityId?: string; // FIX: Länkar tillbaka till den planerade aktiviteten
}

export interface BiometricLog {
  id: string;
  date: string;
  weight: number;
  measurements: BodyMeasurements;
}

export type ActivityType = 'gym' | 'cardio' | 'rehab' | 'mobility' | 'rest';

export interface ScheduledActivity {
  id: string;
  date: string; 
  type: ActivityType;
  title: string;
  isCompleted: boolean;
  linkedSessionId?: string;
  exercises?: PlannedExercise[];
  recurrenceId?: string;
  programId?: string; // NYTT: Länkar till ett AI-program
  weekNumber?: number; // NYTT: Vilken vecka i programmet
}

export interface RecurringPlan {
  id: string;
  type: ActivityType;
  title: string;
  daysOfWeek: number[]; 
  startDate: string; 
  endDate?: string; 
  exercises?: PlannedExercise[];
}

export interface RecurringPlanForDisplay extends RecurringPlan {
  isTemplate: true;
  date: string;
  isCompleted: boolean;
}

export type PlannedActivityForLogDisplay = ScheduledActivity | RecurringPlanForDisplay;

// Strategier för hur målet ska nås
export type ProgressionStrategy = 'linear' | 'undulating' | 'peaking';

// Vad målet gäller
export type SmartGoalTarget = 'exercise' | 'body_weight' | 'body_measurement';

// Konfiguration för det smarta målet
export interface SmartGoalConfig {
  targetType: SmartGoalTarget;
  
  // Om det gäller en övning
  exerciseId?: string;
  
  // Om det gäller kroppsmått (t.ex. 'waist', 'bicepsL')
  measurementKey?: keyof BodyMeasurements | 'weight'; 

  startValue: number;    // Vikt (kg)
  targetValue: number;   // Målvikt (kg)
  
  // För progressionsmål med övningar
  startReps?: number;    // T.ex. 8
  targetReps?: number;   // T.ex. 5
  
  deadline: string;      // ISO datum
  strategy: ProgressionStrategy;
}

// Uppdaterad UserMission (Bakåtkompatibel)
export interface UserMission {
  id: string;
  title: string;
  // Vi lägger till 'smart_goal' som en giltig typ
  type: 'quest' | 'smart_goal'; 
  
  // Detta fält finns bara om type === 'smart_goal'
  smartConfig?: SmartGoalConfig;
  
  // Behålls för quests/habits
  isCompleted: boolean;
  progress: number;
  total: number;
  
  // Viktigt för grafer
  createdAt: string;
  completedAt?: string;
  exerciseId?: string; // För snabb åtkomst
}

// NY DATAMODELL FÖR AI-PROGRAM
export interface AIProgram {
  id: string;
  name: string;
  createdAt: string;
  status: 'active' | 'completed' | 'cancelled';
  motivation: string; // Analysen från AI
  goalIds: string[]; // Kopplade Smart Goals
  weeks: number; // Hur många veckor som är planerade hittills
  phaseNumber?: number; // VILKEN fas i ett längre program
  longTermGoalDescription?: string; // Det ursprungliga, långsiktiga målet
  startStats?: any; // Sparar PPL stats vid start
}

// FIX: Add AIPlanResponse and related types
// NYTT: DATAMODELLER FÖR AI-PLANERINGS-SVAR
export interface AIPlanSmartGoal {
  title: string;
  startValue: number;
  targetValue: number;
  targetType: 'exercise' | 'body_weight' | 'body_measurement';
  exerciseId?: string;
  deadline: string;
  strategy: 'linear' | 'undulating' | 'peaking';
}

export interface AIPlanExercise {
  id: string;
  targetSets: number;
  targetReps: string;
  estimatedWeight: number;
}

export interface AIPlanRoutine {
  name: string;
  description: string;
  scheduledDay: number;
  exercises: AIPlanExercise[];
  weekNumber: number;
}

export interface AIPlanResponse {
  motivation: string;
  smartGoals?: AIPlanSmartGoal[];
  routines: AIPlanRoutine[];
}

export interface Plate {
  weight: number;
  count: number;
  color: string;
}
