import { supabase } from './supabaseClient';
import type { StateFrameMap } from './useFrameAnimation';

const BUCKET = 'sprite-presets';
const MAX_DIM = 1024;
const WEBP_QUALITY = 0.85;
const CONCURRENCY = 6;

export type ProgressFn = (done: number, total: number) => void;

export interface UploadResult {
  frames: StateFrameMap;
  paths: string[];
}

function sanitizeState(state: string): string {
  return state.replace(/[^a-z0-9-_]/gi, '_');
}

/**
 * Re-encodes a data-URL image as WebP, capping the longest edge at MAX_DIM.
 * WebP with alpha is typically 3-5x smaller than the source PNG for sprites,
 * and the dimension cap avoids storing multi-megabyte source art when the
 * battle viewport only ever renders at a few hundred px tall.
 */
function reencodeWebp(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('WebP encoding failed.'));
          },
          'image/webp',
          WEBP_QUALITY,
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load frame image for re-encoding.'));
    img.src = dataUrl;
  });
}

interface UploadTask {
  state: string;
  frameIdx: number;
  frame: StateFrameMap[string][number];
  path: string;
}

/**
 * Uploads every data-URL frame image to the sprite-presets bucket and returns a
 * new frames map whose `src` fields point at the public Storage URLs. Frames
 * whose src is already an http(s) URL (e.g. re-saving a loaded preset) are
 * passed through unchanged so we never re-upload or duplicate objects.
 *
 * Uploads run concurrently (up to CONCURRENCY at a time) and each frame is
 * re-encoded to WebP + capped at MAX_DIM before upload, which cuts both upload
 * time and stored size by several-fold versus raw PNG data URLs.
 */
export async function uploadPresetImages(
  presetId: string,
  frames: StateFrameMap,
  onProgress?: ProgressFn,
): Promise<UploadResult> {
  const tasks: UploadTask[] = [];
  for (const [state, arr] of Object.entries(frames)) {
    const safeState = sanitizeState(state);
    for (let i = 0; i < arr.length; i++) {
      const frame = arr[i];
      if (frame.src && frame.src.startsWith('data:')) {
        tasks.push({ state, frameIdx: i, frame, path: `${presetId}/${safeState}__${i}.webp` });
      }
    }
  }

  const total = tasks.length;
  let done = 0;
  onProgress?.(done, total);

  const next: StateFrameMap = {};
  for (const [state, arr] of Object.entries(frames)) {
    next[state] = arr.slice();
  }
  const paths: string[] = [];

  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      const blob = await reencodeWebp(task.frame.src!);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(task.path, blob, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      paths.push(task.path);
      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(task.path).data.publicUrl;
      next[task.state][task.frameIdx] = { ...task.frame, src: publicUrl };
      done++;
      onProgress?.(done, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

  return { frames: next, paths };
}

/** Removes the stored object paths for a deleted preset. Best-effort. */
export async function deletePresetObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
