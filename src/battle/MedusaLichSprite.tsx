import type { CreatureState } from './types';
import { useFrameAnimation, type StateFrameMap, type FrameConfig } from './useFrameAnimation';
import { FrameSprite } from './FrameSprite';
import { useSpriteRegistry } from './spriteRegistry';

const SPRITE_W = 180;
const SPRITE_H = 200;

const spriteModules = import.meta.glob<{ default: string }>(
  '../assets/sprites/Medusa Corpse/*.png',
  { eager: true },
);

const STATE_ALIASES: Record<string, string> = {
  preempt: 'hit',
  prempt: 'hit',
};

interface RawEntry {
  state: string;
  frameNum: number;
  src: string;
}

const rawEntries: RawEntry[] = [];
for (const [path, mod] of Object.entries(spriteModules)) {
  const filename = (path.split('/').pop() ?? '').toLowerCase();
  const stateMatch = filename.match(/idle|strike|brace|preempt|prempt|hit|special|death/);
  if (!stateMatch) continue;
  const raw = stateMatch[0];
  const stateName = STATE_ALIASES[raw] ?? raw;
  const numMatch = filename.match(/(\d+)/);
  const frameNum = numMatch ? parseInt(numMatch[1], 10) : 1;
  rawEntries.push({ state: stateName, frameNum, src: mod.default });
}

function makeFrames(stateKey: string, label: string, duration: number): FrameConfig[] {
  return rawEntries
    .filter((e) => e.state === stateKey)
    .sort((a, b) => a.frameNum - b.frameNum)
    .map((e, i) => ({
      src: e.src,
      label: `${label} ${i + 1}`,
      duration,
    }));
}

const FRAMES: StateFrameMap = {
  idle: makeFrames('idle', 'LICH IDLE', 180),
  strike: makeFrames('strike', 'LICH STRIKE', 120),
  brace: makeFrames('brace', 'LICH BRACE', 120),
  hit: makeFrames('hit', 'LICH HIT', 100),
  death: makeFrames('death', 'LICH DEATH', 200),
  'special-charge': makeFrames('special', 'LICH SPECIAL', 160),
  'special-cast': makeFrames('special', 'LICH SPECIAL', 160),
};

export { FRAMES as BUNDLED_FRAMES, SPRITE_W, SPRITE_H };

interface MedusaLichSpriteProps {
  state: CreatureState;
  showDebug?: boolean;
  paused?: boolean;
  speed?: number;
  slot?: 'cyclops' | 'medusa';
  width?: number;
  height?: number;
}

export function MedusaLichSprite({ state, showDebug = false, paused = false, speed = 1, slot = 'cyclops', width = SPRITE_W, height = SPRITE_H }: MedusaLichSpriteProps) {
  const { overrides } = useSpriteRegistry();
  const frames = overrides[slot] ?? FRAMES;
  const { currentFrame, frameNumber, totalFrames } = useFrameAnimation({
    state,
    frames,
    paused,
    speed,
  });

  return (
    <FrameSprite
      frame={currentFrame}
      width={width}
      height={height}
      showDebug={showDebug}
      frameNumber={frameNumber}
      totalFrames={totalFrames}
      facing={slot === 'medusa' ? 'right' : 'left'}
    />
  );
}


export { MedusaLichSprite }