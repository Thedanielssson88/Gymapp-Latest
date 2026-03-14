
import { Plate } from '../types';

export const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25];
export const PLATE_COLORS: Record<number, string> = {
    25: '#ff2d55', // Röd
    20: '#3b82f6', // Blå
    15: '#ffcc00', // Gul
    10: '#2ed573', // Grön
    5: '#ffffff',  // Vit
    2.5: '#8e8c95', // Grå
    1.25: '#8e8c95', // Grå
    0.5: '#4b5563',  // Mörkgrå
    0.25: '#4b5563'  // Mörkgrå
};

/**
 * Beräknar antal skivor per sida för en given totalvikt.
 */
export const calculatePlates = (totalWeight: number, barWeight = 20, availablePlates: number[] = AVAILABLE_PLATES): Plate[] => {
  const weightPerSide = (totalWeight - barWeight) / 2;
  if (weightPerSide <= 0) return [];

  const result: Plate[] = [];
  let remaining = weightPerSide;

  // Sortera de tillgängliga plattorna från störst till minst
  const sortedPlates = [...availablePlates].sort((a, b) => b - a);

  for (const plate of sortedPlates) {
    // Använd en tolerans för att hantera flyttalsproblem
    const count = Math.floor(Math.round(remaining * 1000) / 1000 / plate);
    if (count > 0) {
      result.push({ weight: plate, count, color: PLATE_COLORS[plate] || '#8e8c95' });
      remaining = Math.round((remaining - count * plate) * 1000) / 1000;
    }
  }

  return result;
};
