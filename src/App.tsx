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
  const hydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = await hydrateOverrides();
      if (cancelled || !restored) return;
      hydratedRef.current = true;
      setOverrides(restored);
    })();
    return () => { cancelled = true; };
  }, []);

  // Re-warm the background-strip cache for restored frames so playback is
  // aligned from the first frame. Queued (not concurrent) to avoid spiking
  // the main thread with many canvas pixel-processing jobs at once.
  const warmedRef = useRef(false);
  useEffect(() => {
    if (warmedRef.current) return;
    if (!hydratedRef.current) return;
    warmedRef.current = true;
    let cancelled = false;
    void (async () => {
      for (const slot of ['cyclops', 'medusa'] as const) {
        const frames = overrides[slot];
        if (!frames) continue;
        for (const stateFrames of Object.values(frames)) {
          for (const f of stateFrames) {
            if (cancelled) return;
            if (f.src) await transparentSrcAsync(f.src);
          }
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
