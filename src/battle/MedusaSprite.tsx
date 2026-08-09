import type { CreatureState } from './types';
import { useFrameAnimation, type StateFrameMap, type FrameConfig } from './useFrameAnimation';
import { FrameSprite } from './FrameSprite';
import { useSpriteRegistry } from './spriteRegistry';
import { transparentSrcAsync } from './transparentImage';

const SPRITE_W = 180;
const SPRITE_H = 200;

// Auto-discover sprite images by filename convention.
// Drop files into src/assets/sprites/medusa/ named like:
//   idle-1.png, idle-2.png, strike-1.png, hit-1.png, special-1.png, ...
// Files that don't exist fall back to a labeled placeholder.
const spriteModules = import.meta.glob<{ default: string }>(
  '../assets/sprites/medusa/*.png',
  { eager: true },
);

const STATE_ALIASES: Record<string, string> = {
  preempt: 'hit',
  prempt: 'hit',
};

const imageCache: Record<string, string> = {};
for (const [path, mod] of Object.entries(spriteModules)) {
  const filename = path.split('/').pop() ?? '';
  const rawKey = filename.replace(/\.png$/, '').toLowerCase().replace(/_/g, '-');
  const [stateName, ...rest] = rawKey.split('-');
  const aliasedState = STATE_ALIASES[stateName] ?? stateName;
  const cacheKey = `${aliasedState}-${rest.join('-')}`;
  imageCache[cacheKey] = mod.default;
}

// Eagerly kick off background stripping for every bundled sprite so the
// cache is warm before the battle screen renders — prevents a one-frame
// flash where Idle_1 shows without ground alignment.
for (const src of Object.values(imageCache)) {
  void transparentSrcAsync(src);
}

function makeFrames(stateKey: string, label: string, duration: number, maxCount = 12): FrameConfig[] {
  const frames: FrameConfig[] = [];
  for (let i = 1; i <= maxCount; i++) {
    const cacheKey = `${stateKey}-${i}`;
    if (!imageCache[cacheKey]) continue;
    frames.push({
      src: imageCache[cacheKey],
      label: `${label} ${i}`,
      duration,
    });
  }
  return frames;
}

const BUNDLED_FRAMES: StateFrameMap = {
  idle: makeFrames('idle', 'MEDUSA IDLE', 180),
  strike: makeFrames('strike', 'MEDUSA STRIKE', 120),
  brace: makeFrames('brace', 'MEDUSA BRACE', 120),
  hit: makeFrames('hit', 'MEDUSA HIT', 100),
  death: makeFrames('death', 'MEDUSA DEATH', 200),
  'special-charge': makeFrames('special', 'MEDUSA SPECIAL', 160),
  'special-cast': makeFrames('special', 'MEDUSA SPECIAL', 160),
};

interface MedusaSpriteProps {
  state: CreatureState;
  showDebug?: boolean;
  paused?: boolean;
  speed?: number;
}

export function MedusaSprite({ state, showDebug = false, paused = false, speed = 1 }: MedusaSpriteProps) {
  const { overrides } = useSpriteRegistry();
  const frames = overrides.medusa ?? BUNDLED_FRAMES;
  const { currentFrame, frameNumber, totalFrames } = useFrameAnimation({
    state,
    frames,
    paused,
    speed,
  });

  return (
    <div style={{ width: SPRITE_W, height: SPRITE_H, transform: 'scale(1.3)', transformOrigin: 'bottom center' }}>
      <FrameSprite
        frame={currentFrame}
        width={SPRITE_W}
        height={SPRITE_H}
        showDebug={showDebug}
        frameNumber={frameNumber}
        totalFrames={totalFrames}
      />
    </div>
  );
}
