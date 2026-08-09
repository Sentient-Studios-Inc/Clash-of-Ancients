import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreatureState } from './types';
import type { StateFrameMap } from './useFrameAnimation';

const PREVIEW_STATES: CreatureState[] = ['idle', 'strike', 'brace', 'death'];

// Minimum hold so even a 1-frame state stays visible long enough to read.
const MIN_HOLD = 700;

// Extra time added beyond the frame total so the per-frame animation always
// finishes its last frame before the preview switches to the next state.
const COMPLETION_BUFFER = 120;

function holdForState(frames: StateFrameMap | undefined, state: CreatureState): number {
  const stateFrames = frames?.[state];
  if (!stateFrames || stateFrames.length === 0) {
    // Fall back to a sensible default when no frames are uploaded for this state.
    return 1200;
  }
  const total = stateFrames.reduce((sum, f) => sum + f.duration, 0);
  // One full play-through of the state's frames plus a completion buffer
  // so the last frame holds for its full duration, floored at MIN_HOLD.
  return Math.max(MIN_HOLD, total + COMPLETION_BUFFER);
}

export function useSpritePreview(
  speedRef: React.MutableRefObject<number>,
  framesRef: React.MutableRefObject<StateFrameMap | undefined>,
) {
  const [preview, setPreview] = useState<CreatureState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    setPreview(null);
  }, [clearTimer]);

  const start = useCallback(() => {
    cancelledRef.current = false;
    clearTimer();
    let i = 0;
    const step = () => {
      if (cancelledRef.current) return;
      const state = PREVIEW_STATES[i % PREVIEW_STATES.length];
      setPreview(state);
      i += 1;
      const hold = holdForState(framesRef.current, state);
      const speed = Math.max(0.1, speedRef.current);
      timerRef.current = setTimeout(step, hold / speed);
    };
    step();
  }, [clearTimer, speedRef, framesRef]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { preview, start, cancel };
}
