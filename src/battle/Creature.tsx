import { useCallback, useEffect, useRef } from 'react';
import type { CreatureState } from './types';
import type { Vec2, Size } from './useSpriteLayout';

interface CreatureProps {
  name: string;
  side: 'left' | 'right';
  state: CreatureState;
  position: Vec2;
  size: Size;
  children: React.ReactNode;
  overlay?: React.ReactNode;
  draggable?: boolean;
  battlefieldSize?: Size;
  onMove?: (x: number, y: number) => void;
}

export function Creature({
  name,
  position,
  size,
  children,
  overlay,
  draggable = false,
  battlefieldSize,
  onMove,
}: CreatureProps) {
  const dragging = useRef(false);
  const startMX = useRef(0);
  const startMY = useRef(0);
  const startPos = useRef(position);

  const sizeRef = useRef(size);
  sizeRef.current = size;
  const bfRef = useRef(battlefieldSize);
  bfRef.current = battlefieldSize;
  const posRef = useRef(position);
  posRef.current = position;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggable || !onMove) return;
      dragging.current = true;
      startMX.current = clientX;
      startMY.current = clientY;
      startPos.current = { ...posRef.current };
    },
    [draggable, onMove],
  );

  useEffect(() => {
    if (!draggable || !onMove) return;

    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const { w, h } = sizeRef.current;
      const bf = bfRef.current;
      const dx = e.clientX - startMX.current;
      const dy = e.clientY - startMY.current;
      const nx = bf ? Math.max(w / 2, Math.min(bf.w - w / 2, startPos.current.x + dx)) : startPos.current.x + dx;
      const ny = bf ? Math.max(h / 2, Math.min(bf.h - h / 2, startPos.current.y + dy)) : startPos.current.y + dy;
      onMoveRef.current?.(Math.round(nx), Math.round(ny));
    }
    function onMouseUp() {
      dragging.current = false;
    }
    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!t || !dragging.current) return;
      const { w, h } = sizeRef.current;
      const bf = bfRef.current;
      const dx = t.clientX - startMX.current;
      const dy = t.clientY - startMY.current;
      const nx = bf ? Math.max(w / 2, Math.min(bf.w - w / 2, startPos.current.x + dx)) : startPos.current.x + dx;
      const ny = bf ? Math.max(h / 2, Math.min(bf.h - h / 2, startPos.current.y + dy)) : startPos.current.y + dy;
      onMoveRef.current?.(Math.round(nx), Math.round(ny));
    }
    function onTouchEnd() {
      dragging.current = false;
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
  }, [draggable, onMove]);

  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        overflow: 'visible',
        ...(draggable ? { cursor: 'grab', touchAction: 'none' } : undefined),
      }}
      aria-label={name}
      onMouseDown={(e) => {
        if (!draggable) return;
        e.preventDefault();
        handlePointerDown(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        if (!draggable) return;
        const t = e.touches[0];
        if (t) handlePointerDown(t.clientX, t.clientY);
      }}
    >
      <div className="relative inline-block" style={{ overflow: 'visible' }}>
        {overlay}
        {children}
      </div>
    </div>
  );
}
