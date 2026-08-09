import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { StateFrameMap } from './useFrameAnimation';
import { uploadPresetImages, deletePresetObjects } from './presetStorage';

export type Slot = 'cyclops' | 'medusa';

export interface SpritePreset {
  id: string;
  title: string;
  slot: Slot;
  frames: StateFrameMap;
  paths: string[];
  created_at: string;
}

interface DbRow {
  id: string;
  title: string;
  slot: Slot;
  frames: StateFrameMap;
  paths: string[];
  created_at: string;
}

const TABLE = 'sprite_presets';

function rowToPreset(r: DbRow): SpritePreset {
  return { id: r.id, title: r.title, slot: r.slot, frames: r.frames, paths: r.paths ?? [], created_at: r.created_at };
}

export function usePresets() {
  const [presets, setPresets] = useState<SpritePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, title, slot, frames, paths, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else if (data) {
      setPresets((data as DbRow[]).map(rowToPreset));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (
      title: string,
      slot: Slot,
      frames: StateFrameMap,
      onProgress?: (done: number, total: number) => void,
    ): Promise<boolean> => {
      setError(null);
      const presetId = crypto.randomUUID();
      let uploaded: { frames: StateFrameMap; paths: string[] };
      try {
        uploaded = await uploadPresetImages(presetId, frames, onProgress);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to upload sprite images.');
        return false;
      }

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          id: presetId,
          title,
          slot,
          frames: uploaded.frames,
          paths: uploaded.paths,
        })
        .select('id, title, slot, frames, paths, created_at')
        .maybeSingle();
      if (error) {
        setError(error.message);
        await deletePresetObjects(uploaded.paths);
        return false;
      }
      if (data) setPresets((prev) => [rowToPreset(data as DbRow), ...prev]);
      return true;
    },
    [],
  );

  const remove = useCallback(async (id: string, paths?: string[]): Promise<boolean> => {
    setError(null);
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      setError(error.message);
      return false;
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
    if (paths && paths.length > 0) {
      void deletePresetObjects(paths).catch(() => {});
    }
    return true;
  }, []);

  const rename = useCallback(async (id: string, title: string): Promise<boolean> => {
    setError(null);
    const { data, error } = await supabase
      .from(TABLE)
      .update({ title })
      .eq('id', id)
      .select('id, title, slot, frames, paths, created_at')
      .maybeSingle();
    if (error) {
      setError(error.message);
      return false;
    }
    if (data) {
      setPresets((prev) => prev.map((p) => (p.id === id ? rowToPreset(data as DbRow) : p)));
    }
    return true;
  }, []);

  return { presets, loading, error, refresh, save, remove, rename };
}
