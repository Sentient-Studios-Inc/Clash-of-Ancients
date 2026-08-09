import { useRef, useCallback, useEffect } from 'react';
import { Maximize2, Move } from 'lucide-react';
import type { Vec2, Size } from './useSpriteLayout';

interface SpriteResizeHandleProps {
  position: Vec2;
  width: number;
  height: number;
  side: 'left' | 'right';
  battlefieldSize: Size;
  onResize: (w: number, h: number) => void;
  onMove: (x: number, y: number) => void;
  onClose: () => void;
}

const MIN_SIZE = 60;
const MAX_SIZE = 500;
const ASPECT = 180 / 200;

export function SpriteResizeHandle({
  position,
  width,
  height,
  side,
  battlefieldSize,
  onResize,
  onMove,
  onClose,
}: SpriteResizeHandleProps) {
  const resizeDrag = useRef(false);
  const startRX = useRef(0);
  const startRY = useRef(0);
  const startRW = useRef(width);
  const startRH = useRef(height);

  const moveDrag = useRef(false);
  const startMX = useRef(0);
  const startMY = useRef(0);
  const startPos = useRef(position);

  // Refs mirror live props so the window listeners stay registered once.
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const bfRef = useRef(battlefieldSize);
  widthRef.current = width;
  heightRef.current = height;
  bfRef.current = battlefieldSize;

  const handleResizeDown = useCallback((clientX: number, clientY: number) => {
    resizeDrag.current = true;
    startRX.current = clientX;
    startRY.current = clientY;
    startRW.current = widthRef.current;
    startRH.current = heightRef.current;
  }, []);

  const handleMoveDown = useCallback(
    (clientX: number, clientY: number) => {
      moveDrag.current = true;
      startMX.current = clientX;
      startMY.current = clientY;
      startPos.current = { ...position };
    },
    [position],
  );

  useEffect(() => {
    function applyResize(dx: number, dy: number) {
      const delta = (dx - dy) / 2;
      const newW = Math.max(MIN_SIZE, Math.min(MAX_SIZE, startRW.current + delta));
      const newH = newW / ASPECT;
      onResize(Math.round(newW), Math.round(newH));
    }

    function applyMove(dx: number, dy: number) {
      const w = widthRef.current;
      const h = heightRef.current;
      const bf = bfRef.current;
      const nx = Math.max(w / 2, Math.min(bf.w - w / 2, startPos.current.x + dx));
      const ny = Math.max(h / 2, Math.min(bf.h - h / 2, startPos.current.y + dy));
      onMove(Math.round(nx), Math.round(ny));
    }

    function onMouseMove(e: MouseEvent) {
      if (resizeDrag.current) applyResize(e.clientX - startRX.current, e.clientY - startRY.current);
      else if (moveDrag.current) applyMove(e.clientX - startMX.current, e.clientY - startMY.current);
    }

    function onMouseUp() {
      resizeDrag.current = false;
      moveDrag.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      if (resizeDrag.current) applyResize(t.clientX - startRX.current, t.clientY - startRY.current);
      else if (moveDrag.current) applyMove(t.clientX - startMX.current, t.clientY - startMY.current);
    }

    function onTouchEnd() {
      resizeDrag.current = false;
      moveDrag.current = false;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onResize, onMove]);

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleResizeDown(e.clientX, e.clientY);
  };
  const onResizeTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    handleResizeDown(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onMoveMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleMoveDown(e.clientX, e.clientY);
  };
  const onMoveTouchStart = (e: React.TouchEvent) => {
    handleMoveDown(e.touches[0].clientX, e.touches[0].clientY);
  };

  const closeSide = side === 'left' ? '-bottom-2 -left-2' : '-bottom-2 -right-2';

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 20 }}>
      {/* Bounding box — draggable body for moving */}
      <div
        className="pointer-events-auto absolute inset-0 cursor-move rounded border-2 border-dashed border-amber-400/70"
        style={{ background: 'rgba(251,191,36,0.05)' }}
        onMouseDown={onMoveMouseDown}
        onTouchStart={onMoveTouchStart}
        title="Drag to move"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400/25">
          <Move size={32} />
        </div>
      </div>

      {/* Size readout */}
      <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-amber-300">
        {width} × {height}
      </div>

      {/* Resize handle (top-left corner) */}
      <button
        className="pointer-events-auto absolute -top-2 -left-2 flex h-6 w-6 cursor-nwse-resize items-center justify-center rounded-full border-2 border-amber-400 bg-[#1a1410] text-amber-300 shadow-lg transition-colors hover:bg-amber-900"
        onMouseDown={onResizeMouseDown}
        onTouchStart={onResizeTouchStart}
        aria-label="Drag to resize sprite"
        title="Drag to resize"
      >
        <Maximize2 size={11} />
      </button>

      {/* Close / done button */}
      <button
        className={`pointer-events-auto absolute ${closeSide} flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-red-500/70 bg-[#1a1410] font-mono text-[10px] font-bold text-red-400 shadow transition-colors hover:bg-red-900/40`}
        onClick={onClose}
        aria-label="Done"
        title="Done"
      >
        ✕
      </button>
    </div>
  );
}
