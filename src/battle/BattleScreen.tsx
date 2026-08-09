import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useBattle, SPEED_MIN, SPEED_MAX, SPEED_STEP } from './useBattle';
import { HealthBar } from './HealthBar';
import { PowerBar } from './PowerBar';
import { Creature } from './Creature';
import { MedusaLichSprite } from './MedusaLichSprite';
import { SpritePicker } from './SpritePicker';
import { SpriteResizeHandle } from './SpriteResizeHandle';
import { useSpritePreview } from './useSpritePreview';
import { MAX_POWER } from './types';
import { useSpriteRegistry } from './spriteRegistry';
import { useSpriteLayout, type Vec2, type Size, type Slot } from './useSpriteLayout';
import { ChevronDown, ChevronUp, PackageOpen, Gauge, Pencil, Zap, SlidersHorizontal, Download, Film, LayoutGrid, Loader2 } from 'lucide-react';
import { FrameEditor } from './FrameEditor';
import { exportSprite, downloadBlob, type ExportFormat, type ExportSlot } from './spriteExport';
import type { StateFrameMap } from './useFrameAnimation';

export function BattleScreen() {
  const {
    state,
    attackLeft,
    attackRight,
    reset,
    equipCyclops,
    equipMedusa,
    leftSpeed,
    rightSpeed,
    setLeftSpeed,
    setRightSpeed,
  } = useBattle();
  const [showPicker, setShowPicker] = useState(false);
  const [editingSide, setEditingSide] = useState<'left' | 'right' | null>(null);
  const [editingFrames, setEditingFrames] = useState<'cyclops' | 'medusa' | null>(null);
  const [exportSlot, setExportSlot] = useState<ExportSlot | null>(null);
  const [exporting, setExporting] = useState<ExportSlot | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { overrides } = useSpriteRegistry();
  const { layouts, setPosition, setSize, resetPosition } = useSpriteLayout();

  // Track live gameplay speed refs so the preview respects the slider.
  const leftSpeedRef = useRef(leftSpeed);
  leftSpeedRef.current = leftSpeed;
  const rightSpeedRef = useRef(rightSpeed);
  rightSpeedRef.current = rightSpeed;

  const leftFramesRef = useRef(overrides.cyclops);
  leftFramesRef.current = overrides.cyclops;
  const rightFramesRef = useRef(overrides.medusa);
  rightFramesRef.current = overrides.medusa;

  const leftPreview = useSpritePreview(leftSpeedRef, leftFramesRef);
  const rightPreview = useSpritePreview(rightSpeedRef, rightFramesRef);
  const anyPreviewActive = leftPreview.preview !== null || rightPreview.preview !== null;

  // Measure the battlefield so absolute positioning and clamping stay correct
  // across viewport sizes (the field is flex-1, so its height varies).
  const battlefieldRef = useRef<HTMLDivElement>(null);
  const [bfSize, setBfSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = battlefieldRef.current;
    if (!el) return;
    const measure = () => setBfSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // When a sprite is loaded or cleared, drop that slot back to the
  // ground-anchored default so both creatures stay on level ground,
  // then run the full lifecycle preview (idle → strike → brace → death)
  // so the user can see every uploaded state without entering battle.
  const prevOverrides = useRef(overrides);
  useEffect(() => {
    (['cyclops', 'medusa'] as Slot[]).forEach((slot) => {
      if (overrides[slot] !== prevOverrides.current[slot]) {
        resetPosition(slot);
        if (overrides[slot]) (slot === 'cyclops' ? leftPreview : rightPreview).start();
      }
    });
    prevOverrides.current = overrides;
  }, [overrides, resetPosition, leftPreview, rightPreview]);

  // Any real battle action reverts to the normal state lifecycle.
  useEffect(() => {
    leftPreview.cancel();
    rightPreview.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attackLeft, attackRight, reset, state.busy]);

  const leftDisplayState = leftPreview.preview ?? state.cyclopsState;
  const rightDisplayState = rightPreview.preview ?? state.medusaState;

  const GROUND_OFFSET = 80; // px from battlefield bottom to sprite feet
  const deriveDefault = (side: 'left' | 'right', size: Size): Vec2 => ({
    x: side === 'left' ? bfSize.w * 0.42 : bfSize.w * 0.58,
    y: bfSize.h - GROUND_OFFSET - size.h / 2,
  });
  const clampCenter = (pos: Vec2, size: Size): Vec2 => ({
    x: Math.max(size.w / 2, Math.min(bfSize.w - size.w / 2, pos.x)),
    y: Math.max(size.h / 2, Math.min(bfSize.h - size.h / 2, pos.y)),
  });
  const posLeft = layouts.cyclops.position
    ? clampCenter(layouts.cyclops.position, layouts.cyclops.size)
    : deriveDefault('left', layouts.cyclops.size);
  const posRight = layouts.medusa.position
    ? clampCenter(layouts.medusa.position, layouts.medusa.size)
    : deriveDefault('right', layouts.medusa.size);

  const cyclopsPowerReady = state.cyclopsPower >= MAX_POWER;
  const medusaPowerReady = state.medusaPower >= MAX_POWER;
  const battleOver = state.cyclopsHp <= 0 || state.medusaHp <= 0;

  const handleExport = async (slot: ExportSlot, format: ExportFormat) => {
    const framesMap: StateFrameMap | undefined = overrides[slot];
    const idleFrames = framesMap?.idle;
    if (!idleFrames || idleFrames.length === 0) {
      setExportError('No idle frames found for this sprite.');
      return;
    }
    setExportSlot(null);
    setExporting(slot);
    setExportError(null);
    try {
      const result = await exportSprite({
        frames: idleFrames,
        width: layouts[slot].size.w,
        height: layouts[slot].size.h,
        facing: slot === 'medusa' ? 'right' : 'left',
        slot,
        format,
      });
      downloadBlob(result.blob, result.filename);
      setExportMessage(`Downloading ${result.filename}…`);
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed unexpectedly.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-start gap-2 bg-[#0c0a08] p-3">
      {/* Title */}
      <h1 className="font-display text-xl font-bold tracking-widest text-amber-300/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-2xl">
        Clash of the Ancients
      </h1>

      {/* Health + power bars */}
      <div className="flex w-full max-w-5xl items-start justify-between px-4 sm:px-8">
        <div className="flex flex-col gap-2">
          <HealthBar name="Left Sprite" hp={state.cyclopsHp} maxHp={100} align="left" />
          <PowerBar
            name="Left Sprite"
            power={state.cyclopsPower}
            maxPower={MAX_POWER}
            equipped={state.cyclopsSpecialEquipped}
            ready={cyclopsPowerReady}
            align="left"
            onEquip={equipCyclops}
          />
        </div>
        <div className="flex flex-col gap-2">
          <HealthBar name="Right Sprite" hp={state.medusaHp} maxHp={100} align="right" />
          <PowerBar
            name="Right Sprite"
            power={state.medusaPower}
            maxPower={MAX_POWER}
            equipped={state.medusaSpecialEquipped}
            ready={medusaPowerReady}
            align="right"
            onEquip={equipMedusa}
          />
        </div>
      </div>

      {/* Battlefield */}
      <div
        ref={battlefieldRef}
        className={`battle-field battle-grid relative min-h-[420px] w-full max-w-5xl flex-1 overflow-hidden rounded-xl border-2 border-amber-900/50 shadow-2xl ${
          state.shake ? 'anim-shake' : ''
        } ${state.shakeSpecial ? 'anim-shake-special' : ''}`}
      >
        {/* Ground line */}
        <div className="absolute bottom-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />

        {/* Left sprite */}
        <Creature
          name="Left Sprite"
          side="left"
          state={state.cyclopsState}
          position={posLeft}
          size={layouts.cyclops.size}
          draggable
          battlefieldSize={bfSize}
          onMove={(x, y) => setPosition('cyclops', { x, y })}
          overlay={
            editingSide === 'left' ? (
              <SpriteResizeHandle
                position={posLeft}
                width={layouts.cyclops.size.w}
                height={layouts.cyclops.size.h}
                side="left"
                battlefieldSize={bfSize}
                onResize={(w, h) => setSize('cyclops', { w, h })}
                onMove={(x, y) => setPosition('cyclops', { x, y })}
                onClose={() => setEditingSide(null)}
              />
            ) : null
          }
        >
          <MedusaLichSprite state={leftDisplayState} speed={leftSpeed} width={layouts.cyclops.size.w} height={layouts.cyclops.size.h} />
        </Creature>

        {/* Right sprite */}
        <Creature
          name="Right Sprite"
          side="right"
          state={state.medusaState}
          position={posRight}
          size={layouts.medusa.size}
          draggable
          battlefieldSize={bfSize}
          onMove={(x, y) => setPosition('medusa', { x, y })}
          overlay={
            editingSide === 'right' ? (
              <SpriteResizeHandle
                position={posRight}
                width={layouts.medusa.size.w}
                height={layouts.medusa.size.h}
                side="right"
                battlefieldSize={bfSize}
                onResize={(w, h) => setSize('medusa', { w, h })}
                onMove={(x, y) => setPosition('medusa', { x, y })}
                onClose={() => setEditingSide(null)}
              />
            ) : null
          }
        >
          <MedusaLichSprite state={rightDisplayState} speed={rightSpeed} slot="medusa" width={layouts.medusa.size.w} height={layouts.medusa.size.h} />
        </Creature>

        {/* Floating damage numbers */}
        {state.damageNumber && (
          <div
            key={state.damageNumber.key}
            className={`anim-dmg pointer-events-none absolute font-display font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
              state.damageNumber.special ? 'text-5xl text-amber-300' : 'text-3xl text-red-500'
            }`}
            style={{
              top: '30%',
              ...(state.damageNumber.side === 'left' ? { left: '44%' } : { right: '44%' }),
            }}
          >
            -{state.damageNumber.amount}
          </div>
        )}
      </div>

      {/* Gameplay speed controls — scale the full attack cycle timing */}
      <div className="flex w-full max-w-5xl flex-col gap-2 px-4 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Gauge size={14} className="text-amber-300/80" />
            <span className="font-display text-[11px] font-bold tracking-wide text-amber-200/80">LEFT SPEED</span>
            <input
              type="range"
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={SPEED_STEP}
              value={leftSpeed}
              onChange={(e) => setLeftSpeed(parseFloat(e.target.value))}
              aria-label="Left gameplay speed"
              className="sprite-speed-slider h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-amber-900/60 accent-amber-400"
            />
            <span className="w-10 font-mono text-[11px] text-amber-200/90">{leftSpeed.toFixed(2)}x</span>
            <button
              onClick={() => setLeftSpeed(1)}
              className="rounded border border-amber-700/50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-300/70 transition-colors hover:bg-amber-900/30"
            >
              1x
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-300/80" />
            <span className="font-display text-[11px] font-bold tracking-wide text-amber-100/70">Higher = faster attacks</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRightSpeed(1)}
              className="rounded border border-amber-700/50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-300/70 transition-colors hover:bg-amber-900/30"
            >
              1x
            </button>
            <span className="w-10 font-mono text-[11px] text-amber-200/90">{rightSpeed.toFixed(2)}x</span>
            <input
              type="range"
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={SPEED_STEP}
              value={rightSpeed}
              onChange={(e) => setRightSpeed(parseFloat(e.target.value))}
              aria-label="Right gameplay speed"
              className="sprite-speed-slider h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-amber-900/60 accent-amber-400"
            />
            <span className="font-display text-[11px] font-bold tracking-wide text-amber-200/80">RIGHT SPEED</span>
            <Gauge size={14} className="text-amber-300/80" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={attackLeft}
          disabled={state.busyLeft || battleOver}
          className="btn-attack font-display rounded-lg px-8 py-3 text-base font-bold tracking-wider text-amber-50"
        >
          {state.cyclopsSpecialEquipped ? '★ L Special' : '⚔ Left Attack'}
        </button>
        <button
          onClick={attackRight}
          disabled={state.busyRight || battleOver}
          className="btn-attack font-display rounded-lg px-8 py-3 text-base font-bold tracking-wider text-amber-50"
        >
          {state.medusaSpecialEquipped ? '★ R Special' : '⚔ Right Attack'}
        </button>
        <button
          onClick={anyPreviewActive ? () => { leftPreview.cancel(); rightPreview.cancel(); reset(); } : reset}
          disabled={state.busy && !anyPreviewActive}
          className={`flex items-center gap-1.5 rounded-lg border-2 px-6 py-3 font-display text-sm font-bold tracking-wide transition-colors disabled:opacity-40 ${
            anyPreviewActive
              ? 'border-emerald-500 bg-emerald-600/30 text-emerald-200 hover:bg-emerald-600/50'
              : 'border-amber-700/60 bg-[#2a221b] text-amber-200/80 hover:bg-[#3a2e1f]'
          }`}
        >
          {anyPreviewActive ? 'Start' : 'Reset'}
        </button>
        <button
          onClick={() => setShowPicker((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-wide transition-colors ${
            showPicker
              ? 'border-emerald-500 bg-emerald-600/30 text-emerald-200'
              : 'border-amber-700/50 bg-[#2a221b] text-amber-200/80 hover:bg-[#3a2e1f]'
          }`}
        >
          <PackageOpen size={12} />
          SPRITE PICKER
          {showPicker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          onClick={() => setEditingSide(editingSide ? null : 'left')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-wide transition-colors ${
            editingSide === 'left'
              ? 'border-amber-400 bg-amber-600/30 text-amber-100'
              : 'border-amber-700/50 bg-[#2a221b] text-amber-200/80 hover:bg-[#3a2e1f]'
          }`}
        >
          <Pencil size={12} />
          RESIZE LEFT
        </button>
        <button
          onClick={() => setEditingSide(editingSide ? null : 'right')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-wide transition-colors ${
            editingSide === 'right'
              ? 'border-amber-400 bg-amber-600/30 text-amber-100'
              : 'border-amber-700/50 bg-[#2a221b] text-amber-200/80 hover:bg-[#3a2e1f]'
          }`}
        >
          <Pencil size={12} />
          RESIZE RIGHT
        </button>
        <button
          onClick={() => setEditingFrames('cyclops')}
          disabled={!overrides.cyclops}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-700/50 bg-[#1a1410] px-3 py-2 text-[10px] font-bold tracking-wide text-cyan-200 transition-colors hover:bg-cyan-900/30 disabled:cursor-not-allowed disabled:opacity-30"
          title={overrides.cyclops ? 'Edit per-frame alignment' : 'Upload frames for the left sprite first'}
        >
          <SlidersHorizontal size={12} />
          EDIT LEFT FRAMES
        </button>
        <button
          onClick={() => setEditingFrames('medusa')}
          disabled={!overrides.medusa}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-700/50 bg-[#1a1410] px-3 py-2 text-[10px] font-bold tracking-wide text-cyan-200 transition-colors hover:bg-cyan-900/30 disabled:cursor-not-allowed disabled:opacity-30"
          title={overrides.medusa ? 'Edit per-frame alignment' : 'Upload frames for the right sprite first'}
        >
          <SlidersHorizontal size={12} />
          EDIT RIGHT FRAMES
        </button>
        <button
          onClick={() => setExportSlot('cyclops')}
          disabled={!overrides.cyclops}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-700/50 bg-[#1a1410] px-3 py-2 text-[10px] font-bold tracking-wide text-emerald-200 transition-colors hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-30"
          title={overrides.cyclops ? 'Export idle animation' : 'Upload frames for the left sprite first'}
        >
          {exporting === 'cyclops' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          EXPORT LEFT
        </button>
        <button
          onClick={() => setExportSlot('medusa')}
          disabled={!overrides.medusa}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-700/50 bg-[#1a1410] px-3 py-2 text-[10px] font-bold tracking-wide text-emerald-200 transition-colors hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-30"
          title={overrides.medusa ? 'Export idle animation' : 'Upload frames for the right sprite first'}
        >
          {exporting === 'medusa' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          EXPORT RIGHT
        </button>
      </div>

      {exportMessage && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-300"><Download size={11} /> {exportMessage}</p>
      )}
      {exportError && (
        <p className="flex items-center gap-1.5 text-[11px] text-red-300">{exportError}</p>
      )}

      {exportSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-sm rounded-xl border border-emerald-900/50 bg-[#1a1410] p-5 shadow-2xl">
            <button
              onClick={() => setExportSlot(null)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-amber-700/50 text-amber-300 hover:bg-amber-900/40"
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="font-display text-sm font-bold tracking-wide text-emerald-200">
              Export {exportSlot === 'cyclops' ? 'Left' : 'Right'} Idle Animation
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-amber-100/50">
              Choose a format. Both bake in your alignment tweaks and use a transparent background.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => handleExport(exportSlot, 'gif')}
                className="flex items-start gap-3 rounded-lg border border-emerald-700/40 bg-[#221a14] p-3 text-left transition-colors hover:bg-emerald-900/30"
              >
                <Film size={18} className="mt-0.5 text-emerald-300" />
                <div>
                  <div className="text-[12px] font-bold tracking-wide text-emerald-200">ANIMATED GIF</div>
                  <div className="text-[10px] text-amber-100/50">A single looping file of the idle animation. Plays on any website.</div>
                </div>
              </button>
              <button
                onClick={() => handleExport(exportSlot, 'sheet')}
                className="flex items-start gap-3 rounded-lg border border-emerald-700/40 bg-[#221a14] p-3 text-left transition-colors hover:bg-emerald-900/30"
              >
                <LayoutGrid size={18} className="mt-0.5 text-emerald-300" />
                <div>
                  <div className="text-[12px] font-bold tracking-wide text-emerald-200">SPRITE SHEET</div>
                  <div className="text-[10px] text-amber-100/50">One transparent PNG with all idle frames laid out in a grid.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {editingFrames && (
        <FrameEditor
          slot={editingFrames}
          label={editingFrames === 'cyclops' ? 'Left Sprite' : 'Right Sprite'}
          onClose={() => setEditingFrames(null)}
        />
      )}

      {showPicker && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SpritePicker slot="cyclops" label="Left Sprite" />
          <SpritePicker slot="medusa" label="Right Sprite" />
        </div>
      )}

      {/* Status log */}
      <p className="h-5 text-xs text-amber-100/50">{state.log}</p>
    </div>
  );
}
