import type { CreatureState } from './types';

interface SpriteProps {
  state: CreatureState;
}

/**
 * Placeholder Cyclops sprite built from CSS shapes.
 * Replace this component body with an <img> of pixel art later;
 * the `state` prop drives which animation class the parent applies.
 */
export function CyclopsSprite({ state }: SpriteProps) {
  return (
    <div
      data-creature-state={state}
      className="relative"
      style={{ width: 180, height: 200 }}
      aria-label="Cyclops"
    >
      {/* Horns */}
      <div
        className="absolute"
        style={{
          left: 48,
          top: 2,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '26px solid #d9c28a',
          transform: 'rotate(-18deg)',
        }}
      />
      <div
        className="absolute"
        style={{
          right: 48,
          top: 2,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '26px solid #d9c28a',
          transform: 'rotate(18deg)',
        }}
      />
      {/* Head */}
      <div
        className="absolute rounded-[40%]"
        style={{
          left: 40,
          top: 22,
          width: 100,
          height: 80,
          background: 'linear-gradient(180deg, #8a9a6a 0%, #6b7a4f 100%)',
          border: '3px solid #4a5a30',
          boxShadow: 'inset 0 -8px 0 rgba(0,0,0,0.2)',
        }}
      >
        {/* Single eye */}
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '38%',
            width: 34,
            height: 34,
            transform: 'translateX(-50%)',
            background: 'radial-gradient(circle, #fff 0%, #cfe0ff 40%, #4a7ac9 70%, #2a5a9a 100%)',
            border: '3px solid #2a3a1a',
            boxShadow: '0 0 12px rgba(80,140,255,0.6)',
          }}
        >
          <div
            className="absolute rounded-full"
            style={{ left: '50%', top: '50%', width: 14, height: 14, transform: 'translate(-50%,-50%)', background: '#1a1a1a' }}
          />
        </div>
        {/* Mouth */}
        <div
          className="absolute rounded-b-full"
          style={{ left: '50%', bottom: 8, width: 36, height: 14, transform: 'translateX(-50%)', background: '#3a2a1a', border: '2px solid #2a1a0a', borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}
        >
          {/* Fangs */}
          <div className="absolute" style={{ left: 8, top: 0, width: 4, height: 8, background: '#e8e0c8', clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
          <div className="absolute" style={{ right: 8, top: 0, width: 4, height: 8, background: '#e8e0c8', clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
        </div>
      </div>
      {/* Body */}
      <div
        className="absolute rounded-2xl"
        style={{
          left: 30,
          top: 96,
          width: 120,
          height: 90,
          background: 'linear-gradient(180deg, #7a8a5a 0%, #5a6a3f 100%)',
          border: '3px solid #4a5a30',
          boxShadow: 'inset 0 -10px 0 rgba(0,0,0,0.2)',
        }}
      >
        {/* Belly lines */}
        <div className="absolute" style={{ left: '50%', top: 16, width: 50, height: 4, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.15)', borderRadius: 4 }} />
        <div className="absolute" style={{ left: '50%', top: 28, width: 60, height: 4, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.15)', borderRadius: 4 }} />
        <div className="absolute" style={{ left: '50%', top: 40, width: 44, height: 4, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.15)', borderRadius: 4 }} />
      </div>
      {/* Arms */}
      <div
        className="absolute rounded-full"
        style={{ left: 10, top: 104, width: 26, height: 60, background: 'linear-gradient(180deg,#7a8a5a,#5a6a3f)', border: '3px solid #4a5a30', transform: 'rotate(12deg)' }}
      />
      <div
        className="absolute rounded-full"
        style={{ right: 10, top: 104, width: 26, height: 60, background: 'linear-gradient(180deg,#7a8a5a,#5a6a3f)', border: '3px solid #4a5a30', transform: 'rotate(-12deg)' }}
      />
      {/* Feet */}
      <div className="absolute rounded-full" style={{ left: 42, bottom: 0, width: 38, height: 20, background: '#4a5a30', border: '3px solid #3a4a20' }} />
      <div className="absolute rounded-full" style={{ right: 42, bottom: 0, width: 38, height: 20, background: '#4a5a30', border: '3px solid #3a4a20' }} />
    </div>
  );
}
