// Färgpalett för övningar (20 vackra färger)
export const EXERCISE_COLORS = [
  { name: 'Standard', hex: '#1a1721', bg: 'bg-[#1a1721]', border: 'border-white/5' },
  { name: 'Rosa', hex: '#FF2D55', bg: 'bg-[#FF2D55]', border: 'border-[#FF2D55]' },
  { name: 'Röd', hex: '#FF3B30', bg: 'bg-[#FF3B30]', border: 'border-[#FF3B30]' },
  { name: 'Orange', hex: '#FF9500', bg: 'bg-[#FF9500]', border: 'border-[#FF9500]' },
  { name: 'Gul', hex: '#FFCC00', bg: 'bg-[#FFCC00]', border: 'border-[#FFCC00]' },
  { name: 'Grön', hex: '#34C759', bg: 'bg-[#34C759]', border: 'border-[#34C759]' },
  { name: 'Mint', hex: '#00C7BE', bg: 'bg-[#00C7BE]', border: 'border-[#00C7BE]' },
  { name: 'Cyan', hex: '#32ADE6', bg: 'bg-[#32ADE6]', border: 'border-[#32ADE6]' },
  { name: 'Blå', hex: '#007AFF', bg: 'bg-[#007AFF]', border: 'border-[#007AFF]' },
  { name: 'Indigo', hex: '#5856D6', bg: 'bg-[#5856D6]', border: 'border-[#5856D6]' },
  { name: 'Lila', hex: '#AF52DE', bg: 'bg-[#AF52DE]', border: 'border-[#AF52DE]' },
  { name: 'Magenta', hex: '#FF2D92', bg: 'bg-[#FF2D92]', border: 'border-[#FF2D92]' },
  { name: 'Korall', hex: '#FF6B6B', bg: 'bg-[#FF6B6B]', border: 'border-[#FF6B6B]' },
  { name: 'Persika', hex: '#FFB347', bg: 'bg-[#FFB347]', border: 'border-[#FFB347]' },
  { name: 'Lime', hex: '#A8E063', bg: 'bg-[#A8E063]', border: 'border-[#A8E063]' },
  { name: 'Turkos', hex: '#56B4D3', bg: 'bg-[#56B4D3]', border: 'border-[#56B4D3]' },
  { name: 'Lavendel', hex: '#9B59B6', bg: 'bg-[#9B59B6]', border: 'border-[#9B59B6]' },
  { name: 'Brun', hex: '#A0826D', bg: 'bg-[#A0826D]', border: 'border-[#A0826D]' },
  { name: 'Grå', hex: '#8E8E93', bg: 'bg-[#8E8E93]', border: 'border-[#8E8E93]' },
  { name: 'Svart', hex: '#000000', bg: 'bg-black', border: 'border-black' },
] as const;

export const getColorByHex = (hex?: string) => {
  if (!hex) return EXERCISE_COLORS[0]; // Default
  return EXERCISE_COLORS.find(c => c.hex === hex) || EXERCISE_COLORS[0];
};
