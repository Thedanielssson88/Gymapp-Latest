

import { Zone, GoalTarget, Equipment, UserProfile, Goal } from './types';

export const INITIAL_GOAL_TARGETS: GoalTarget[] = [
  { id: 'target-push', name: 'PUSH-MUSKLER', targetSets: 50, muscleGroups: ['Bröst', 'Axlar', 'Triceps'] },
  { id: 'target-pull', name: 'PULL-MUSKLER', targetSets: 27, muscleGroups: ['Rygg', 'Biceps', 'Underarmar', 'Trapezius'] },
  { id: 'target-legs', name: 'BEN-MUSKLER', targetSets: 45, muscleGroups: ['Framsida lår', 'Baksida lår', 'Säte', 'Vader'] }
];

export const INITIAL_ZONES: Zone[] = [
  { id: 'zone-a', name: 'Hemma', inventory: [Equipment.DUMBBELL, Equipment.BANDS, Equipment.BODYWEIGHT, Equipment.PULLUP_BAR, Equipment.BENCH], icon: 'home' },
  { id: 'zone-b', name: 'Gymmet', inventory: Object.values(Equipment), icon: 'building' },
  { id: 'zone-c', name: 'Resa', inventory: [Equipment.BODYWEIGHT, Equipment.BANDS], icon: 'briefcase' }
];

export const DEFAULT_PROFILE: UserProfile = {
  name: "Atlet",
  weight: 80,
  height: 180,
  level: "Medel",
  goal: Goal.HYPERTROPHY,
  injuries: [],
  measurements: {},
  settings: {
    includeWarmupInStats: false,
    barbellWeight: 20,
    dumbbellBaseWeight: 2,
    bodyViewMode: 'list',
    vibrateButtons: true,
    vibrateTimer: true
  }
};

export const GOOGLE_CLIENT_ID = '780206293738-sk4o73pko8gu6at1qtpma3ifg9noq9k1.apps.googleusercontent.com';
export const DRIVE_BACKUP_FILENAME = 'morphfit_backup.json';