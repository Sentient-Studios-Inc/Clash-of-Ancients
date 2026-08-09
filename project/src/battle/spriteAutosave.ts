import type { SpriteOverrides } from './spriteRegistry';

/**
 * Persists user-uploaded sprite overrides to IndexedDB so they survive reloads.
 * LocalStorage is too small for multi-megabyte base64 data URLs; IndexedDB
 * handles it comfortably and supports structured clones of plain objects.
 *
 * On boot, loadOverrides() synchronously returns {} (nothing restored yet),
 * then hydrates from IDB in the background and emits via the provided callback.
 */

const DB_NAME = 'clash-sprites';
const STORE = 'overrides';
const KEY = 'latest';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function hydrateOverrides(): Promise<SpriteOverrides | null> {
  try {
    const db = await openDB();
    return await new Promise<SpriteOverrides | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as SpriteOverrides) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveOverrides(overrides: SpriteOverrides): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void (async () => {
      try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(overrides, KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        /* ignore quota / private-mode errors */
      }
    })();
  }, 500);
}
