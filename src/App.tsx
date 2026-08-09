import { useEffect, useRef, useState } from 'react';
import { BattleScreen } from './battle/BattleScreen';
import {
  SpriteRegistryContext,
  type SpriteOverrides,
  type SpriteRegistryValue,
} from './battle/spriteRegistry';
import { transparentSrcAsync } from './battle/transparentImage';
import { hydrateOverrides, saveOverrides } from './battle/spriteAutosave';

function App() {
  const [overrides, setOverrides] = useState<SpriteOverrides>({});

  // Hydrate persisted overrides from IndexedDB on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = await hydrateOverrides();
      if (cancelled || !restored) return;
      setOverrides(restored);
    })();
    return () => { cancelled = true; };
  }, []);

  // Pre-warm the background-strip cache for all frames so playback is
  // aligned from the first frame. Process frames in parallel so warming
  // completes before the first animation cycle can reach the last frame.
  // Re-runs on every overrides change; cached frames return instantly.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tasks: Promise<unknown>[] = [];
      for (const slot of ['cyclops', 'medusa'] as const) {
        const frames = overrides[slot];
        if (!frames) continue;
        for (const stateFrames of Object.values(frames)) {
          for (const f of stateFrames) {
            if (f.src) tasks.push(transparentSrcAsync(f.src));
          }
        }
      }
      await Promise.all(tasks);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [overrides]);

  // Persist whenever overrides change (debounced inside saveOverrides).
  const canSaveRef = useRef(false);
  useEffect(() => {
    if (!canSaveRef.current) {
      canSaveRef.current = true;
      return;
    }
    saveOverrides(overrides);
  }, [overrides]);

  const value: SpriteRegistryValue = {
    overrides,
    setSlotFrames: (slot, frames) =>
      setOverrides((prev) => {
        const next = { ...prev };
        if (frames === undefined) delete next[slot];
        else next[slot] = frames;
        return next;
      }),
    clearSlot: (slot) =>
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      }),
  };

  return (
    <SpriteRegistryContext.Provider value={value}>
      <BattleScreen />
    </SpriteRegistryContext.Provider>
  );
}

export default App;
