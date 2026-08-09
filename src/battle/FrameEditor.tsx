import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCcw, Move, Maximize2, Anchor, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { StateFrameMap } from './useFrameAnimation';
import { FrameSprite } from './FrameSprite';
import { useSpriteRegistry } from './spriteRegistry';
import { transparentSrcAsync, transparentSrcSync, type ContentBounds } from './transparentImage';
import { placeFrame } from './frameLayout';

type Slot = 'cyclops' | 'medusa';

interface FrameEditorProps {
  slot: Slot;
  label: string;
  onClose: () => void;
}

const PREVIEW_W = 320;
const PREVIEW_H = 360;
// Stage is the larger interactive area around the preview grid so sprites
// scaled above 100% remain fully visible in both axes.
const STAGE_W = 560;
const STAGE_H = 560;
const PREVIEW_LEFT = (STAGE_W - PREVIEW_W) / 2;       // 120px each side
const PREVIEW_TOP  = STAGE_H - PREVIEW_H - 20;         // 180px headroom above
const SCALE_STEP = 0.05;
const SCALE_MIN = 0.2;
const SCALE_MAX = 3;
const DX_MIN = -300;
const DX_MAX = 300;
const DY_MIN = -200;
const DY_MAX = 400;
const WALL_GUIDE_COLOR = 'rgba(56, 189, 248, 0.55)';
const GROUND_GUIDE_COLOR = 'rgba(251, 191, 36, 0.65)';

export function FrameEditor({ slot, label, onClose }: FrameEditorProps) {
  const { overrides, setSlotFrames, clearSlot } = useSpriteRegistry();
  const frames = overrides[slot];

  const facing: 'left' | 'right' = slot === 'medusa' ? 'right' : 'left';
  // Rear wall = the edge nearest the camera-side wall. Left sprite's wall is
  // the left edge; right (mirrored) sprite's wall is the right edge.
  const defaultAnchor: 'left' | 'right' | 'center' = slot === 'medusa' ? 'right' : 'left';

  // Working copy so users can apply/reset per-frame tweaks before persisting.
  // Declared before the selectors below because they derive from it so that
  // deletions are reflected immediately while editing.
  const [draft, setDraft] = useState<StateFrameMap | null>(frames ? shallowCloneFrames(frames) : null);

  const stateNames = useMemo(() => (draft ? Object.keys(draft) : []), [draft]);
  const [stateIdx, setStateIdx] = useState(0);
  const stateName = stateNames[stateIdx];

  const stateFrames = draft?.[stateName] ?? [];
  const [frameIdx, setFrameIdx] = useState(0);
  const frame = stateFrames[frameIdx];
  const draftFrame = draft?.[stateName]?.[frameIdx];

  const [bounds, setBounds] = useState<ContentBounds | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);

  // Onion-skin: resolve the previous frame's bounds so it can be rendered as
  // a translucent ghost behind the current frame for alignment reference.
  const [onionSkin, setOnionSkin] = useState(true);
  const [prevBounds, setPrevBounds] = useState<ContentBounds | null>(null);
  const [prevImgNatural, setPrevImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [prevProcessedUrl, setPrevProcessedUrl] = useState<string | null>(null);

  // Reset selectors whenever the slot's frames are swapped out.
  useEffect(() => {
    setStateIdx(0);
    setFrameIdx(0);
    setDraft(frames ? shallowCloneFrames(frames) : null);
  }, [frames]);

  // Keep the draft's selected frame in sync with the registry frames for
  // src/label/duration (only the alignment fields are user-editable here).
  useEffect(() => {
    if (!frames || !draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const next: StateFrameMap = {};
      for (const [s, arr] of Object.entries(prev)) {
        const live = frames[s];
        if (!live) {
          next[s] = arr;
          continue;
        }
        next[s] = arr.map((f, i) => {
          const liveF = live[i];
          if (!liveF) return f;
          return { ...liveF, dx: f.dx, dy: f.dy, scale: f.scale, anchorEdge: f.anchorEdge };
        });
      }
      return next;
    });
  }, [frames]);

  // Resolve content bounds for the current frame's src so the preview can
  // draw the ground/rear-wall guides at the true content edges. Uses the
  // bounds.width/height as natural dimensions — no second Image() decode.
  useEffect(() => {
    let cancelled = false;
    const src = frame?.src;
    if (!src) {
      setBounds(null);
      setImgNatural(null);
      return;
    }
    const cached = transparentSrcSync(src);
    if (cached) {
      setBounds(cached.bounds);
      setImgNatural({ w: cached.bounds.width, h: cached.bounds.height });
      return;
    }
    void transparentSrcAsync(src).then((p) => {
      if (cancelled) return;
      setBounds(p.bounds);
      setImgNatural({ w: p.bounds.width, h: p.bounds.height });
    });
    return () => {
      cancelled = true;
    };
  }, [frame?.src]);

  // Onion-skin: resolve the previous frame's processed image + bounds so it
  // can be drawn as a translucent silhouette behind the current frame.
  // Depends only on the previous frame's src string (not the whole stateFrames
  // array, which gets a new reference on every drag tick and would re-trigger
  // this effect — firing 3 setState calls per pointermove and freezing the UI).
  const prevSrc = frameIdx > 0 ? stateFrames[frameIdx - 1]?.src : undefined;
  useEffect(() => {
    let cancelled = false;
    if (!onionSkin || !prevSrc) {
      setPrevBounds(null);
      setPrevImgNatural(null);
      setPrevProcessedUrl(null);
      return;
    }
    void transparentSrcAsync(prevSrc).then((p) => {
      if (cancelled) return;
      setPrevBounds(p.bounds);
      setPrevProcessedUrl(p.url);
      const i = new Image();
      i.onload = () => !cancelled && setPrevImgNatural({ w: i.naturalWidth, h: i.naturalHeight });
      i.src = p.url;
    });
    return () => { cancelled = true; };
  }, [prevSrc, onionSkin]);

  // Auto-apply the default anchor to frames that have never been touched,
  // so the editor opens with the spec'd rear-wall + ground anchoring.
  // Depends only on primitive keys (stateName, defaultAnchor) and runs once
  // per state — depending on `draft` would re-trigger it on every drag tick.
  const stateNamesMemo = stateNames.join('|');
  useEffect(() => {
    if (!stateName) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = prev[stateName];
      if (!arr) return prev;
      let changed = false;
      const nextArr = arr.map((f) => {
        if (f.anchorEdge === undefined) {
          changed = true;
          return { ...f, anchorEdge: defaultAnchor };
        }
        return f;
      });
      return changed ? { ...prev, [stateName]: nextArr } : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateName, defaultAnchor, stateNamesMemo]);

  if (!frames || !draft || !frame || !draftFrame) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="frame-editor-panel relative w-full max-w-4xl rounded-xl border border-amber-900/50 bg-[#1a1410] p-6 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-amber-700/50 text-amber-300 hover:bg-amber-900/40"
            aria-label="Close"
          >
            <X size={14} />
          </button>
          <p className="text-sm text-amber-200/70">
            No custom frames uploaded for {label}. Upload a sprite set first, then open the editor.
          </p>
        </div>
      </div>
    );
  }

  const dx = draftFrame.dx ?? 0;
  const dy = draftFrame.dy ?? 0;
  const scale = draftFrame.scale ?? 1;
  const anchorEdge = draftFrame.anchorEdge ?? defaultAnchor;

  const updateFrame = (patch: Partial<typeof draftFrame>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = prev[stateName];
      if (!arr) return prev;
      const nextArr = arr.slice();
      nextArr[frameIdx] = { ...nextArr[frameIdx], ...patch };
      return { ...prev, [stateName]: nextArr };
    });
  };

  const resetFrame = () => updateFrame({ dx: 0, dy: 0, scale: 1, anchorEdge: defaultAnchor });
  const resetState = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = prev[stateName];
      if (!arr) return prev;
      return {
        ...prev,
        [stateName]: arr.map((f) => ({ ...f, dx: 0, dy: 0, scale: 1, anchorEdge: defaultAnchor })),
      };
    });
  };

  const deleteFrame = () => {
    if (!draft) return;
    const arr = draft[stateName];
    if (!arr) return;
    const nextArr = arr.slice();
    nextArr.splice(frameIdx, 1);
    const next = { ...draft };
    if (nextArr.length === 0) {
      delete next[stateName];
      const remaining = Object.keys(next);
      if (remaining.length === 0) {
        // No frames left for this slot — clear it and close the editor.
        clearSlot(slot);
        onClose();
        return;
      }
      setDraft(next);
      setStateIdx(Math.min(stateIdx, remaining.length - 1));
      setFrameIdx(0);
      return;
    }
    next[stateName] = nextArr;
    setDraft(next);
    setFrameIdx(Math.min(frameIdx, nextArr.length - 1));
  };

  const apply = () => {
    setSlotFrames(slot, draft);
    onClose();
  };

  // Drag-to-move on the preview updates dx/dy directly.
  const dragRef = useRef<{ startX: number; startY: number; dx0: number; dy0: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const onPreviewPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, dx0: dx, dy0: dy };
  };
  const onPreviewPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const ddx = e.clientX - dragRef.current.startX;
    const ddy = e.clientY - dragRef.current.startY;
    // Dragging the sprite on screen should move it in the direction of the
    // drag. For a right-facing sprite the preview is mirrored, so a screen
    // drag to the right maps to a decrease in dx to keep "drag the sprite"
    // intuitive.
    updateFrame({
      dx: clampInt(dragRef.current.dx0 + (facing === 'right' ? -ddx : ddx), DX_MIN, DX_MAX),
      dy: clampInt(dragRef.current.dy0 - ddy, DY_MIN, DY_MAX),
    });
  };
  const onPreviewPointerUp = () => {
    dragRef.current = null;
  };

  // Guide positions derived from the shared layout math so the overlays stay
  // perfectly in sync with how FrameSprite actually renders the frame.
  const placement = useMemo(
    () =>
      bounds && imgNatural && imgNatural.w > 0 && imgNatural.h > 0
        ? placeFrame(draftFrame, PREVIEW_W, PREVIEW_H, facing, imgNatural, bounds)
        : null,
    [bounds, imgNatural, draftFrame, facing],
  );
  const rearWallX =
    anchorEdge === 'left' ? 0 : anchorEdge === 'right' ? PREVIEW_W : PREVIEW_W / 2;

  // Previous frame placement for the onion-skin ghost. Uses the previous
  // frame's own draft config so the ghost shows where it actually sits.
  const prevDraftFrame = frameIdx > 0 ? draft?.[stateName]?.[frameIdx - 1] : null;
  const prevPlacement = useMemo(
    () =>
      onionSkin && prevBounds && prevImgNatural && prevImgNatural.w > 0 && prevImgNatural.h > 0 && prevDraftFrame
        ? placeFrame(prevDraftFrame, PREVIEW_W, PREVIEW_H, facing, prevImgNatural, prevBounds)
        : null,
    [onionSkin, prevBounds, prevImgNatural, prevDraftFrame, facing],
  );

  const totalFrames = stateFrames.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
      <div className="frame-editor-panel relative flex w-full max-w-6xl flex-col gap-4 rounded-xl border border-amber-900/50 bg-[#1a1410] p-4 shadow-2xl sm:p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-amber-700/50 text-amber-300 transition-colors hover:bg-amber-900/40"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col gap-1 pr-8">
          <h2 className="font-display text-lg font-bold tracking-wide text-amber-200">
            {label} · Frame Alignment
          </h2>
          <p className="text-[11px] leading-snug text-amber-100/50">
            Drag the sprite to nudge position; use the controls for fine adjustments. The ground line and rear wall show where this frame anchors. Default for this side: rear wall + ground.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Preview stage */}
          <div className="flex flex-col items-center gap-2">
            {/* Stage: grid-backed area so sprites scaled above 100% stay grounded */}
            <div
              className="relative cursor-move touch-none overflow-hidden rounded-lg border-2 border-amber-900/50 bg-grid"
              style={{ width: STAGE_W, height: STAGE_H }}
              onPointerDown={onPreviewPointerDown}
              onPointerMove={onPreviewPointerMove}
              onPointerUp={onPreviewPointerUp}
              onPointerCancel={onPreviewPointerUp}
            >
              {/* Ground line spans the full stage so the ground extends with the sprite */}
              <div
                className="pointer-events-none absolute left-0 right-0"
                style={{ top: PREVIEW_TOP + PREVIEW_H - 1, height: 2, background: GROUND_GUIDE_COLOR }}
              />
              {/* Field-boundary outline: the 320×360 battle area (no bg — grid shows through) */}
              <div
                ref={previewRef}
                className="absolute overflow-visible rounded border border-amber-900/30"
                style={{ left: PREVIEW_LEFT, top: PREVIEW_TOP, width: PREVIEW_W, height: PREVIEW_H }}
              >
                {/* Rear wall guide */}
                <div
                  className="pointer-events-none absolute top-0 bottom-0"
                  style={{
                    left: rearWallX,
                    width: 2,
                    background: WALL_GUIDE_COLOR,
                    transform: 'translateX(-50%)',
                  }}
                />
                {/* Content bbox outline (mirror-aware) */}
                {placement && (
                  <div
                    className="pointer-events-none absolute border border-dashed border-cyan-300/40"
                    style={{
                      left: placement.content.left,
                      width: Math.max(0, placement.content.right - placement.content.left),
                      top: placement.content.top,
                      height: Math.max(0, placement.content.bottom - placement.content.top),
                    }}
                  />
                )}
                {/* Onion-skin: previous frame as a translucent silhouette */}
                {prevPlacement && prevProcessedUrl && (
                  <img
                    src={prevProcessedUrl}
                    alt="previous frame ghost"
                    className="pointer-events-none absolute"
                    style={{
                      left: prevPlacement.img.left,
                      width: prevPlacement.img.width,
                      height: prevPlacement.img.height,
                      bottom: prevPlacement.img.bottom,
                      imageRendering: 'pixelated',
                      transform: prevPlacement.img.transform,
                      opacity: 0.32,
                      filter: 'brightness(0) saturate(100%) sepia(100%) saturate(600%) hue-rotate(150deg) brightness(1.1)',
                    }}
                  />
                )}
                {/* The frame, rendered with the same pipeline as battle */}
                <FrameSprite
                  frame={{ ...draftFrame, src: frame.src }}
                  width={PREVIEW_W}
                  height={PREVIEW_H}
                  facing={facing}
                />
              </div>
              {/* Live readout (stage-level so it stays put during overflow) */}
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-amber-200">
                dx {dx} · dy {dy} · {Math.round(scale * 100)}%
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[10px] text-amber-200/60">
                <Move size={11} /> drag to move
              </div>
              <button
                onClick={() => setOnionSkin((v) => !v)}
                className={`flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold tracking-wide transition-colors ${
                  onionSkin
                    ? 'border-cyan-400/70 bg-cyan-600/20 text-cyan-200'
                    : 'border-amber-700/40 bg-[#2a221b] text-amber-200/60 hover:bg-[#3a2e1f]'
                }`}
                title="Toggle previous-frame ghost overlay"
              >
                {onionSkin ? <Eye size={11} /> : <EyeOff size={11} />}
                ONION SKIN
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-1 flex-col gap-3">
            {/* State selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStateIdx((i) => Math.max(0, i - 1)); setFrameIdx(0); }}
                disabled={stateIdx === 0}
                className="rounded border border-amber-700/40 p-1 text-amber-300 disabled:opacity-30 hover:bg-amber-900/30"
                aria-label="Previous state"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex-1 text-center font-display text-sm font-bold tracking-wide text-amber-100">
                {stateName.replace(/-/g, ' ').toUpperCase()}
              </div>
              <button
                onClick={() => { setStateIdx((i) => Math.min(stateNames.length - 1, i + 1)); setFrameIdx(0); }}
                disabled={stateIdx >= stateNames.length - 1}
                className="rounded border border-amber-700/40 p-1 text-amber-300 disabled:opacity-30 hover:bg-amber-900/30"
                aria-label="Next state"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Frame strip */}
            <div className="flex flex-wrap gap-1 rounded-lg bg-black/30 p-1.5">
              {stateFrames.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setFrameIdx(i)}
                  className={`relative h-12 w-12 overflow-hidden rounded border transition-colors ${
                    i === frameIdx ? 'border-amber-400 ring-1 ring-amber-400/40' : 'border-amber-900/40 hover:border-amber-600/60'
                  }`}
                  title={f.label}
                >
                  {f.src ? (
                    <img src={f.src} alt={f.label} className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] text-amber-300/50">{i + 1}</div>
                  )}
                  <span className="absolute bottom-0 right-0 bg-black/70 px-0.5 text-[7px] font-mono text-amber-200/80">{i + 1}</span>
                </button>
              ))}
            </div>

            {/* Anchor */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-amber-200/80">
                <Anchor size={12} /> ANCHOR EDGE
              </div>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((edge) => (
                  <button
                    key={edge}
                    onClick={() => updateFrame({ anchorEdge: edge })}
                    className={`flex-1 rounded border px-2 py-1.5 text-[10px] font-bold tracking-wide transition-colors ${
                      anchorEdge === edge
                        ? 'border-cyan-400 bg-cyan-600/20 text-cyan-200'
                        : 'border-amber-700/40 bg-[#2a221b] text-amber-200/70 hover:bg-[#3a2e1f]'
                    }`}
                  >
                    {edge === 'left' ? 'LEFT WALL' : edge === 'right' ? 'RIGHT WALL' : 'CENTER'}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-amber-100/40">
                {facing === 'right' ? 'Right sprite: rear wall is the right edge.' : 'Left sprite: rear wall is the left edge.'}
              </p>
            </div>

            {/* dx */}
            <SliderRow
              label="HORIZONTAL (dx)"
              value={dx}
              min={DX_MIN}
              max={DX_MAX}
              step={1}
              onChange={(v) => updateFrame({ dx: v })}
              suffix="px"
            />
            {/* dy */}
            <SliderRow
              label="LIFT (dy)"
              value={dy}
              min={DY_MIN}
              max={DY_MAX}
              step={1}
              onChange={(v) => updateFrame({ dy: v })}
              suffix="px"
              hint="Positive lifts off the ground"
            />
            {/* scale */}
            <SliderRow
              label="SCALE"
              value={scale}
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={SCALE_STEP}
              onChange={(v) => updateFrame({ scale: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />

            {/* Frame nav */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setFrameIdx((i) => (i - 1 + totalFrames) % totalFrames)}
                className="flex items-center gap-1 rounded border border-amber-700/40 px-2 py-1 text-[10px] font-bold text-amber-200/80 hover:bg-amber-900/30"
              >
                <ChevronLeft size={12} /> PREV FRAME
              </button>
              <span className="font-mono text-[10px] text-amber-200/70">
                FRAME {frameIdx + 1} / {totalFrames}
              </span>
              <button
                onClick={() => setFrameIdx((i) => (i + 1) % totalFrames)}
                className="flex items-center gap-1 rounded border border-amber-700/40 px-2 py-1 text-[10px] font-bold text-amber-200/80 hover:bg-amber-900/30"
              >
                NEXT FRAME <ChevronRight size={12} />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                onClick={resetFrame}
                className="flex items-center gap-1 rounded-md border border-gray-600/50 bg-gray-800/40 px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-gray-300 hover:bg-gray-700/40"
              >
                <RotateCcw size={11} /> RESET FRAME
              </button>
              <button
                onClick={resetState}
                className="flex items-center gap-1 rounded-md border border-gray-600/50 bg-gray-800/40 px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-gray-300 hover:bg-gray-700/40"
              >
                <RotateCcw size={11} /> RESET STATE
              </button>
              <button
                onClick={deleteFrame}
                className="flex items-center gap-1 rounded-md border border-red-700/50 bg-red-900/30 px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-red-300 transition-colors hover:bg-red-800/50"
                title="Delete the current frame (applied on APPLY & CLOSE)"
              >
                <Trash2 size={11} /> DELETE FRAME
              </button>
              <button
                onClick={apply}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-emerald-500/60 bg-emerald-600/30 px-4 py-1.5 text-[11px] font-bold tracking-wide text-emerald-200 hover:bg-emerald-600/50"
              >
                <Maximize2 size={12} /> APPLY & CLOSE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  suffix?: string;
  hint?: string;
}

function SliderRow({ label, value, min, max, step, onChange, format, suffix, hint }: SliderRowProps) {
  const display = format ? format(value) : `${value}${suffix ?? ''}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-amber-200/80">{label}</span>
        <span className="font-mono text-[11px] text-amber-200/90">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="sprite-speed-slider h-1.5 w-full cursor-pointer appearance-none rounded-full bg-amber-900/60 accent-amber-400"
      />
      {hint && <p className="text-[9px] text-amber-100/40">{hint}</p>}
    </div>
  );
}

function clampInt(v: number, min: number, max: number) {
  return Math.round(Math.max(min, Math.min(max, v)));
}

// Shallow clone a StateFrameMap: copies the frame arrays and each frame object
// so alignment fields (dx/dy/scale/anchorEdge) can be mutated independently,
// but does NOT deep-clone the src data URLs — which can be megabytes each and
// make the editor freeze for seconds on open when structuredClone is used.
function shallowCloneFrames(frames: StateFrameMap): StateFrameMap {
  const out: StateFrameMap = {};
  for (const [state, arr] of Object.entries(frames)) {
    out[state] = arr.map((f) => ({ ...f }));
  }
  return out;
}
