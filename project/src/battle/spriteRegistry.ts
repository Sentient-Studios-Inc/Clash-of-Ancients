import { createContext, useContext } from 'react';
import type { StateFrameMap } from './useFrameAnimation';

export type SpriteOverrides = Partial<Record<'cyclops' | 'medusa', StateFrameMap>>;

export interface SpriteRegistryValue {
  overrides: SpriteOverrides;
  setSlotFrames: (slot: 'cyclops' | 'medusa', frames: StateFrameMap | undefined) => void;
  clearSlot: (slot: 'cyclops' | 'medusa') => void;
}

export const SpriteRegistryContext = createContext<SpriteRegistryValue | null>(null);

export function useSpriteRegistry(): SpriteRegistryValue {
  const ctx = useContext(SpriteRegistryContext);
  if (!ctx) throw new Error('useSpriteRegistry must be used within SpriteRegistryProvider');
  return ctx;
}

export async function filesToFrameMap(
  files: File[],
  durationByState: Record<string, number> = { idle: 180, strike: 120, brace: 120, hit: 100, death: 200, special: 160, 'special-charge': 160, 'special-cast': 160 },
): Promise<StateFrameMap> {
  const buckets: Record<string, { n: number; url: string; label: string; name: string }[]> = {};

  await Promise.all(
    files.map(async (file) => {
      const url = await readFileAsDataURL(file);
      const base = file.name.replace(/\.[^.]+$/, '');

      const state = detectState(base);
      const n = detectFrameNumber(base);
      const label = `${state.replace(/-/g, ' ').toUpperCase()} ${n}`;
      (buckets[state] ??= []).push({ n, url, label, name: base });
    }),
  );

  const result: StateFrameMap = {};
  for (const [state, items] of Object.entries(buckets)) {
    items.sort((a, b) => a.n - b.n || a.name.localeCompare(b.name, undefined, { numeric: true }));
    const duration = durationByState[state] ?? 160;
    result[state] = items.map((it) => ({ src: it.url, label: it.label, duration }));
  }
  return result;
}

const STATE_ALIASES: Array<{ re: RegExp; state: string }> = [
  { re: /special[-_\s]?cast|cast/i, state: 'special-cast' },
  { re: /special[-_\s]?charge|charge/i, state: 'special-charge' },
  { re: /special/i, state: 'special-cast' },
  { re: /death|dead|die|corpse|fall/i, state: 'death' },
  { re: /brace|guard|block|defend/i, state: 'brace' },
  { re: /strike|attack|atk/i, state: 'strike' },
  { re: /hit|hurt|damage|preempt|prempt/i, state: 'hit' },
  { re: /idle|wait|stand|rest/i, state: 'idle' },
];

function detectState(name: string): string {
  for (const { re, state } of STATE_ALIASES) {
    if (re.test(name)) return state;
  }
  return 'idle';
}

function detectFrameNumber(name: string): number {
  const matches = name.match(/\d+/g);
  if (!matches || matches.length === 0) return 0;
  return parseInt(matches[matches.length - 1], 10);
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
