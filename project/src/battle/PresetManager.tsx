import { useState } from 'react';
import { Library, Save, Trash2, Download, X, AlertCircle, Loader2 } from 'lucide-react';
import { useSpriteRegistry } from './spriteRegistry';
import { usePresets, type Slot } from './usePresets';

interface PresetManagerProps {
  onClose: () => void;
}

export function PresetManager({ onClose }: PresetManagerProps) {
  const { overrides, setSlotFrames } = useSpriteRegistry();
  const { presets, loading, error, save, remove } = usePresets();
  const [title, setTitle] = useState('');
  const [slot, setSlot] = useState<Slot>('cyclops');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const activeFrames = overrides[slot];
  const canSave = title.trim().length > 0 && Boolean(activeFrames) && !busy;

  const handleSave = async () => {
    if (!canSave || !activeFrames) return;
    setBusy(true);
    setBusyLabel('Uploading sprites…');
    setProgress({ done: 0, total: Object.values(activeFrames).reduce((n, arr) => n + arr.length, 0) });
    setMsg(null);
    const ok = await save(title.trim(), slot, activeFrames, (done, total) => setProgress({ done, total }));
    setBusy(false);
    setBusyLabel(null);
    setProgress(null);
    if (ok) {
      const savedName = title.trim() || 'preset';
      setTitle('');
      setMsg(`Saved "${savedName}" to the common library.`);
    } else {
      setMsg('Failed to save preset.');
    }
  };

  const handleLoad = (presetId: string, frames: typeof activeFrames) => {
    if (!frames) return;
    setSlotFrames(slot, frames);
    setMsg(`Loaded "${presets.find((p) => p.id === presetId)?.title ?? 'preset'}" into the ${slot === 'cyclops' ? 'left' : 'right'} slot.`);
  };

  const handleDelete = async (presetId: string, presetTitle: string, paths: string[]) => {
    setBusy(true);
    setBusyLabel('Deleting…');
    setMsg(null);
    const ok = await remove(presetId, paths);
    setBusy(false);
    setBusyLabel(null);
    setMsg(ok ? `Deleted "${presetTitle}".` : 'Failed to delete preset.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
      <div className="frame-editor-panel relative flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-amber-900/50 bg-[#1a1410] p-4 shadow-2xl sm:p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-amber-700/50 text-amber-300 transition-colors hover:bg-amber-900/40"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col gap-1 pr-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-wide text-amber-200">
            <Library size={16} className="text-amber-300/80" />
            Sprite Preset Library
          </h2>
          <p className="text-[11px] leading-snug text-amber-100/50">
            Save a tuned frame set as a named preset, then reload it into either side anytime. The library is shared, so any preset saved from one side can be loaded by the other.
          </p>
        </div>

        {/* Slot tabs */}
        <div className="flex gap-2">
          {(['cyclops', 'medusa'] as Slot[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSlot(s); setMsg(null); }}
              className={`flex-1 rounded-md border px-3 py-2 text-[11px] font-bold tracking-wide transition-colors ${
                slot === s
                  ? 'border-amber-400 bg-amber-600/30 text-amber-100'
                  : 'border-amber-700/50 bg-[#2a221b] text-amber-200/80 hover:bg-[#3a2e1f]'
              }`}
            >
              {s === 'cyclops' ? 'LEFT SPRITE' : 'RIGHT SPRITE'}
            </button>
          ))}
        </div>

        {/* Save current */}
        <div className="flex flex-col gap-2 rounded-lg border border-amber-900/40 bg-[#1a1410]/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[10px] font-bold tracking-wider text-amber-200/80">
              SAVE CURRENT {slot === 'cyclops' ? 'LEFT' : 'RIGHT'} SPRITE
            </span>
            {activeFrames ? (
              <span className="rounded-full bg-emerald-700/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                {Object.values(activeFrames).reduce((n, arr) => n + arr.length, 0)} FRAMES
              </span>
            ) : (
              <span className="rounded-full bg-gray-700/40 px-1.5 py-0.5 text-[9px] font-bold text-gray-400">
                NOTHING UPLOADED
              </span>
            )}
          </div>
          <p className="text-[9px] leading-snug text-amber-100/40">
            Saved as the {slot === 'cyclops' ? 'LEFT' : 'RIGHT'} origin. Either side can still load it from the library below.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Preset name (e.g. Red Dragon v2)"
              maxLength={60}
              className="flex-1 rounded-md border border-amber-700/50 bg-[#2a221b] px-2.5 py-1.5 text-[11px] text-amber-100 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
            />
            <button
              onClick={() => void handleSave()}
              disabled={!canSave}
              className="flex items-center gap-1.5 rounded-md border border-emerald-600/50 bg-emerald-700/30 px-3 py-1.5 text-[10px] font-bold tracking-wide text-emerald-200 transition-colors hover:bg-emerald-700/50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              SAVE
            </button>
          </div>
          {busy && busyLabel && (
            <div className="flex flex-col gap-1 text-[10px] text-amber-200/70">
              <p className="flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin" /> {busyLabel} Re-encoding to WebP and uploading in parallel.
              </p>
              {progress && progress.total > 0 && (
                <>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-amber-900/40">
                    <div
                      className="h-full bg-amber-400 transition-all duration-150"
                      style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-amber-200/50">{progress.done} / {progress.total} frames</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Preset list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-[10px] font-bold tracking-wider text-amber-200/80">
              COMMON LIBRARY ({presets.length})
            </span>
            <span className="text-[9px] text-amber-100/40">LOAD puts the preset into the {slot === 'cyclops' ? 'LEFT' : 'RIGHT'} slot</span>
          </div>
          {loading && (
            <div className="flex items-center gap-2 py-4 text-[11px] text-amber-200/60">
              <Loader2 size={14} className="animate-spin" /> Loading presets…
            </div>
          )}
          {!loading && presets.length === 0 && (
            <p className="py-4 text-center text-[11px] text-amber-100/40">
              No presets yet. Upload frames, edit them in the frame editor, then save here. Anything you save becomes available to both sides.
            </p>
          )}
          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
            {presets.map((p) => {
              const frameCount = Object.values(p.frames).reduce((n, arr) => n + arr.length, 0);
              const stateCount = Object.keys(p.frames).length;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-[#2a221b] px-2.5 py-2"
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-bold text-amber-100">{p.title}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wide ${
                          p.slot === 'cyclops'
                            ? 'bg-sky-900/40 text-sky-300'
                            : 'bg-fuchsia-900/40 text-fuchsia-300'
                        }`}
                        title={`Originally saved from the ${p.slot === 'cyclops' ? 'left' : 'right'} side`}
                      >
                        {p.slot === 'cyclops' ? 'LEFT' : 'RIGHT'}
                      </span>
                    </div>
                    <span className="text-[9px] text-amber-100/40">
                      {frameCount} frames · {stateCount} states · {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleLoad(p.id, p.frames)}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-md border border-cyan-700/50 bg-cyan-900/20 px-2 py-1 text-[10px] font-bold tracking-wide text-cyan-200 transition-colors hover:bg-cyan-900/40 disabled:opacity-30"
                    title={`Load this preset into the ${slot === 'cyclops' ? 'left' : 'right'} slot`}
                  >
                    <Download size={11} />
                    LOAD
                  </button>
                  <button
                    onClick={() => void handleDelete(p.id, p.title, p.paths)}
                    disabled={busy}
                    className="flex items-center justify-center rounded-md border border-red-700/50 bg-red-900/20 px-2 py-1 text-red-300 transition-colors hover:bg-red-900/40 disabled:opacity-30"
                    title="Delete this preset"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-700/50 bg-red-900/20 px-2.5 py-2 text-[10px] text-red-300">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        {msg && !error && (
          <p className="text-[10px] text-emerald-300/80">{msg}</p>
        )}
      </div>
    </div>
  );
}
