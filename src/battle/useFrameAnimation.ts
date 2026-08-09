// @refresh reset
import { useEffect, useMemo, useRef, useState } from 'react';
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
 *
 * Timing is driven by a requestAnimationFrame loop that measures real elapsed
 * time against each frame's duration, so every frame — including the last one
 * before a loop wraps — holds for exactly its configured duration. There is no
 * accumulated drift, because advancing is based on a clock rather than assumed
 * from setTimeout precision.
 *
 * When the state changes, the frame index resets to 0. If `loop` is false
 * (default for one-shot animations like hit/strike), the index holds on the
 * last frame after the cycle completes.
 */
export function useFrameAnimation({ state, frames, loop = false, paused = false, speed = 1 }: UseFrameAnimationProps) {
  const [index, setIndex] = useState(0);

  const stateFrames = useMemo(
    () => frames[state] ?? frames['idle'] ?? [],
    [frames, state],
  );
  const isLooping = loop || state === 'idle' || state === 'special-charge';

  // Refs let the rAF loop read the latest paused/speed/looping values without
  // restarting the loop (which would reset timing) on every toggle.
  const indexRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const frameStartRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  useEffect(() => {
    if (stateFrames.length === 0) return;

    // Reset to the first frame whenever the state (or its frame set) changes.
    indexRef.current = 0;
    frameStartRef.current = null;
    setIndex(0);

    const tick = (now: number) => {
      const sFrames = stateFrames;
      if (sFrames.length === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (pausedRef.current) {
        // Hold without accumulating elapsed time while paused.
        frameStartRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (frameStartRef.current === null) frameStartRef.current = now;

      const current = sFrames[indexRef.current];
      if (!current) {
        indexRef.current = 0;
        setIndex(0);
        frameStartRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const atEnd = indexRef.current >= sFrames.length - 1;
      if (atEnd && !isLoopingRef.current) {
        // One-shot animation: hold on the last frame and stop the loop.
        return;
      }

      const sp = Math.max(0.1, speedRef.current);
      const scaledDuration = Math.max(16, current.duration / sp);
      const elapsed = now - frameStartRef.current;
      if (elapsed >= scaledDuration) {
        indexRef.current =
          indexRef.current >= sFrames.length - 1 ? 0 : indexRef.current + 1;
        setIndex(indexRef.current);
        frameStartRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [state, stateFrames]);

  const currentFrame = stateFrames[index] ?? stateFrames[0] ?? null;
  const frameNumber = index + 1;
  const totalFrames = stateFrames.length;

  return { currentFrame, frameNumber, totalFrames };
}
