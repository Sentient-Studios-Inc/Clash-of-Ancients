import { useRef, useState } from 'react';
import { Upload, RotateCcw, Image as ImageIcon, Check } from 'lucide-react';
import { useSpriteRegistry, filesToFrameMap } from './spriteRegistry';

type Slot = 'cyclops' | 'medusa';

interface SpritePickerProps {
  slot: Slot;
  label: string;
}

export function SpritePicker({ slot, label }: SpritePickerProps) {
  const { overrides, setSlotFrames, clearSlot } = useSpriteRegistry();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFrames = overrides[slot];
  const active = Boolean(activeFrames);
  const fileCount = active
    ? Object.values(activeFrames ?? {}).reduce((n, arr) => n + arr.length, 0)
    : 0;
  const stateCount = active ? Object.keys(activeFrames ?? {}).length : 0;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) {
        setError('No image files selected');
        return;
      }
      const frames = await filesToFrameMap(files);
      if (Object.keys(frames).length === 0) {
        setError('Could not parse any frames');
        return;
      }
      setSlotFrames(slot, frames);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const previewStates = activeFrames ? Object.entries(activeFrames) : [];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-900/40 bg-[#1a1410]/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ImageIcon size={12} className="text-amber-400/70" />
          <span className="font-display text-[10px] font-bold tracking-wider text-amber-200/80">
            {label.toUpperCase()} SPRITE
          </span>
        </div>
        {active && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-700/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
            <Check size={9} />
            {fileCount} FRAMES / {stateCount} STATES
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-amber-700/50 bg-[#2a221b] px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-amber-100 transition-colors hover:bg-[#3a2e1f] disabled:opacity-40"
        >
          <Upload size={11} />
          {loading ? 'LOADING…' : active ? 'REPLACE' : 'UPLOAD'}
        </button>
        <button
          onClick={() => clearSlot(slot)}
          disabled={!active}
          className="flex items-center justify-center gap-1 rounded-md border border-gray-600/50 bg-gray-800/40 px-2 py-1.5 text-[10px] font-bold tracking-wide text-gray-300 transition-colors hover:bg-gray-700/40 disabled:opacity-30"
          title="Restore bundled sprite"
        >
          <RotateCcw size={11} />
        </button>
      </div>

      {active && previewStates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {previewStates.map(([stateName, frames]) => (
            <div key={stateName} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-amber-200/70">
                  {stateName.replace(/-/g, ' ').toUpperCase()}
                </span>
                <span className="text-[8px] text-amber-100/40">{frames.length} frames</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {frames.slice(0, 12).map((f, i) => (
                  <div
                    key={i}
                    className="relative h-10 w-10 overflow-hidden rounded border border-amber-900/40 bg-black/40"
                    title={f.label}
                  >
                    <img
                      src={f.src ?? undefined}
                      alt={f.label}
                      className="h-full w-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span className="absolute bottom-0 right-0 bg-black/70 px-0.5 text-[7px] font-mono text-amber-200/80">
                      {i + 1}
                    </span>
                  </div>
                ))}
                {frames.length > 12 && (
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-amber-900/40 bg-black/40 text-[8px] text-amber-200/60">
                    +{frames.length - 12}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[9px] text-red-400">{error}</p>}
      <p className="text-[8px] leading-tight text-amber-100/40">
        Fuzzy match: any file with{' '}
        <span className="text-amber-200/60">idle, brace, strike, hit, death, special, charge, cast</span> in the name.
        Ordered by trailing number.
      </p>
    </div>
  );
}

export { SpritePicker }