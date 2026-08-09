export type Side = 'left' | 'right';

export type CreatureState =
  | 'idle'
  | 'charge'
  | 'strike'
  | 'brace'
  | 'hit'
  | 'special-charge'
  | 'special-cast'
  | 'death';

export interface CreatureData {
  id: string;
  name: string;
  side: Side;
  maxHp: number;
  hp: number;
}

export const CYCLOPS_DAMAGE = 18;
export const MEDUSA_DAMAGE = 12;
export const SPECIAL_DAMAGE_MULTIPLIER = 2;
export const MAX_POWER = 100;

// Tuned so each creature charges in ~4 rounds (3-5 range).
export const CYCLOPS_POWER_RATE = 1.4; // 18 * 1.4 = 25.2 per round
export const MEDUSA_POWER_RATE = 2.1; // 12 * 2.1 = 25.2 per round
