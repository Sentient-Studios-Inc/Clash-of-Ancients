import { useEffect, useMemo, useState } from 'react';
import type { CreatureState } from './types';

export interface FrameConfig {
  /** Path to the image asset, or null for a labeled placeholder. */
  src: string | null;
  /** Label shown on the placeholder box (also used as alt text). */
  label: string;
  /** How long this frame stays visible, in ms. */
  duration: number;
  /** Horizontal anchor edge in display space. Default 'center'. */
  anchorEdge?: 'left' | 'right' | 'center';
  /** Px shift from anchor, positive = right. Default 0. */
  dx?: number;
  /** Px shift from ground, positive = up. Default 0. */
  dy?: number;
  /** Scale multiplier on top of fit-to-box. Default 1. */
  scale?: number;
}

export interface StateFrameMap {
  [state: string]: FrameConfig[];
}

interface UseFrameAnimationProps {
  state: CreatureState;
  frames: StateFrameMap;
  /** Whether to loop the frame cycle or hold on the last frame. */
  loop?: boolean;
  /** When true, freeze the frame cycle where it is. */
  paused?: boolean;
  /** Playback speed multiplier (1 = default, 2 = twice as fast, 0.5 = half speed). */
  speed?: number;
}

/**
 * Cycles through frame configs for the creature's current state.
 * When the state changes, the frame index resets to 0.
 * If `loop` is false (default for one-shot animations like hit/strike),
 * the index holds on the last frame after the cycle completes.
 */
export function useFrameAnimation({ state, frames, loop = false, paused = false, speed = 1 }: UseFrameAnimationProps) {
  const [index, setIndex] = useState(0);

  const stateFrames = useMemo(
    () => frames[state] ?? frames['idle'] ?? [],
    [frames, state],
  );
  const isLooping = loop || state === 'idle' || state === 'special-charge';

  useEffect(() => {
    setIndex(0);
  }, [state]);

  useEffect(() => {
    if (stateFrames.length === 0) return;
    const current = stateFrames[index];
    if (!current) {
      setIndex(0);
      return;
    }

    const atEnd = index >= stateFrames.length - 1;
    if (atEnd && !isLooping) return;
    if (paused) return;

    const scaledDuration = Math.max(16, current.duration / speed);
    const timer = setTimeout(() => {
      setIndex((i) => (i >= stateFrames.length - 1 ? (isLooping ? 0 : i) : i + 1));
    }, scaledDuration);

    return () => clearTimeout(timer);
  }, [index, state, stateFrames, isLooping, paused, speed]);

  const currentFrame = stateFrames[index] ?? stateFrames[0] ?? null;
  const frameNumber = index + 1;
  const totalFrames = stateFrames.length;

  return { currentFrame, frameNumber, totalFrames };
}
