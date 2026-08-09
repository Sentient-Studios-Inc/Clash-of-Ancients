import { useState, useEffect, useCallback } from 'react';

export interface Vec2 {
  x: number;
  y: number;
}
export interface Size {
  w: number;
  h: number;
}
export interface SlotLayout {
  position: Vec2 | null;
  size: Size;
}
export type Slot = 'cyclops' | 'medusa';
export type LayoutMap = Record<Slot, SlotLayout>;

const STORAGE_KEY = 'clashSpriteLayout';
const DEFAULT_SIZE: Size = { w: 180, h: 200 };
const MIN = 60;
const MAX = 500;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function isFiniteSize(s: unknown): s is Size {
  return (
    typeof s === 'object' &&
    s !== null &&
    Number.isFinite((s as Size).w) &&
    Number.isFinite((s as Size).h)
  );
}

function isFiniteVec(v: unknown): v is Vec2 {
  return (
    typeof v === 'object' &&
    v !== null &&
    Number.isFinite((v as Vec2).x) &&
    Number.isFinite((v as Vec2).y)
  );
}

function normalizeSlot(slot: Partial<SlotLayout> | undefined): SlotLayout {
  const size =
    slot && isFiniteSize(slot.size)
      ? { w: clamp(slot.size.w, MIN, MAX), h: clamp(slot.size.h, MIN, MAX) }
      : DEFAULT_SIZE;
  const position = slot && isFiniteVec(slot.position) ? slot.position : null;
  return { position, size };
}

function loadLayouts(): LayoutMap {
  const fallback: LayoutMap = {
    cyclops: { position: null, size: DEFAULT_SIZE },
    medusa: { position: null, size: DEFAULT_SIZE },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LayoutMap>;
    return {
      cyclops: normalizeSlot(parsed.cyclops),
      medusa: normalizeSlot(parsed.medusa),
    };
  } catch {
    return fallback;
  }
}

export function useSpriteLayout() {
  const [layouts, setLayouts] = useState<LayoutMap>(loadLayouts);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
      } catch {
        /* ignore quota / private-mode errors */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [layouts]);

  const setPosition = useCallback((slot: Slot, position: Vec2 | null) => {
    setLayouts((prev) => ({ ...prev, [slot]: { ...prev[slot], position } }));
  }, []);

  const setSize = useCallback((slot: Slot, size: Size) => {
    setLayouts((prev) => ({ ...prev, [slot]: { ...prev[slot], size } }));
  }, []);

  const resetPosition = useCallback((slot: Slot) => {
    setLayouts((prev) => ({ ...prev, [slot]: { ...prev[slot], position: null } }));
  }, []);

  return { layouts, setPosition, setSize, resetPosition };
}
