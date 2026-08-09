import { useCallback, useRef, useState } from 'react';
import {
  type CreatureState,
  CYCLOPS_DAMAGE,
  MEDUSA_DAMAGE,
  SPECIAL_DAMAGE_MULTIPLIER,
  MAX_POWER,
  CYCLOPS_POWER_RATE,
  MEDUSA_POWER_RATE,
} from './types';

type Side = 'left' | 'right';

interface DamageNumber {
  side: Side;
  amount: number;
  key: number;
  special?: boolean;
}

interface BattleState {
  cyclopsHp: number;
  medusaHp: number;
  cyclopsState: CreatureState;
  medusaState: CreatureState;
  cyclopsPower: number;
  medusaPower: number;
  cyclopsSpecialEquipped: boolean;
  medusaSpecialEquipped: boolean;
  damageNumber: DamageNumber | null;
  busy: boolean;
  busyLeft: boolean;
  busyRight: boolean;
  shake: boolean;
  shakeSpecial: boolean;
  log: string;
}

const INITIAL: BattleState = {
  cyclopsHp: 100,
  medusaHp: 100,
  cyclopsState: 'idle',
  medusaState: 'idle',
  cyclopsPower: 0,
  medusaPower: 0,
  cyclopsSpecialEquipped: false,
  medusaSpecialEquipped: false,
  damageNumber: null,
  busy: false,
  busyLeft: false,
  busyRight: false,
  shake: false,
  shakeSpecial: false,
  log: 'Press Attack to begin the duel.',
};

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 3;
export const SPEED_STEP = 0.05;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useBattle() {
  const [state, setState] = useState<BattleState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [leftSpeed, setLeftSpeed] = useState(0.5);
  const [rightSpeed, setRightSpeed] = useState(0.5);
  const leftSpeedRef = useRef(leftSpeed);
  leftSpeedRef.current = leftSpeed;
  const rightSpeedRef = useRef(rightSpeed);
  rightSpeedRef.current = rightSpeed;

  const patch = useCallback((p: Partial<BattleState>) => setState((s) => ({ ...s, ...p })), []);

  const equipCyclops = useCallback(() => {
    setState((s) =>
      s.cyclopsPower >= MAX_POWER && !s.busyLeft
        ? { ...s, cyclopsSpecialEquipped: true, log: 'Left sprite special equipped!' }
        : s,
    );
  }, []);

  const equipMedusa = useCallback(() => {
    setState((s) =>
      s.medusaPower >= MAX_POWER && !s.busyRight
        ? { ...s, medusaSpecialEquipped: true, log: 'Right sprite special equipped!' }
        : s,
    );
  }, []);

  // Left sprite attacks right sprite (one full cycle).
  const attackLeft = useCallback(async () => {
    const s0 = stateRef.current;
    if (s0.busyLeft || s0.cyclopsHp <= 0 || s0.medusaHp <= 0) return;

    const usingSpecial = s0.cyclopsSpecialEquipped;
    const damage = usingSpecial ? CYCLOPS_DAMAGE * SPECIAL_DAMAGE_MULTIPLIER : CYCLOPS_DAMAGE;
    const lw = (ms: number) => wait(ms / leftSpeedRef.current);

    patch({ busyLeft: true, busy: true });

    if (usingSpecial) {
      patch({ cyclopsState: 'special-charge', medusaState: 'brace', log: 'Left sprite unleashes a special attack!' });
      await lw(800);
      patch({ cyclopsState: 'special-cast' });
      await lw(650);
    } else {
      patch({ cyclopsState: 'strike', medusaState: 'brace', log: 'Left sprite attacks!' });
      await lw(450);
      await lw(530);
    }

    // Apply damage to right sprite.
    setState((s) => ({
      ...s,
      medusaState: 'hit',
      shake: !usingSpecial,
      shakeSpecial: usingSpecial,
      damageNumber: { side: 'right', amount: damage, key: Date.now(), special: usingSpecial },
      medusaHp: Math.max(0, s.medusaHp - damage),
      cyclopsState: 'idle',
      cyclopsSpecialEquipped: false,
      cyclopsPower: Math.min(MAX_POWER, s.cyclopsPower + damage * CYCLOPS_POWER_RATE),
    }));
    await lw(usingSpecial ? 650 : 500);

    setState((s) => {
      const dead = s.medusaHp <= 0;
      return {
        ...s,
        shake: false,
        shakeSpecial: false,
        medusaState: dead ? 'death' : 'idle',
        log: dead ? 'Right sprite has fallen! Left sprite wins!' : s.log,
        busyLeft: false,
        busy: s.busyRight,
      };
    });
  }, [patch]);

  // Right sprite attacks left sprite (one full cycle).
  const attackRight = useCallback(async () => {
    const s0 = stateRef.current;
    if (s0.busyRight || s0.medusaHp <= 0 || s0.cyclopsHp <= 0) return;

    const usingSpecial = s0.medusaSpecialEquipped || s0.medusaPower >= MAX_POWER;
    const damage = usingSpecial ? MEDUSA_DAMAGE * SPECIAL_DAMAGE_MULTIPLIER : MEDUSA_DAMAGE;
    const rw = (ms: number) => wait(ms / rightSpeedRef.current);

    patch({ busyRight: true, busy: true });

    if (usingSpecial) {
      patch({ medusaState: 'special-charge', medusaSpecialEquipped: false, cyclopsState: 'brace', log: 'Right sprite unleashes a special attack!' });
      await rw(800);
      patch({ medusaState: 'special-cast' });
      await rw(680);
    } else {
      patch({ medusaState: 'strike', cyclopsState: 'brace', log: 'Right sprite attacks!' });
      await rw(400);
      await rw(560);
    }

    // Apply damage to left sprite.
    setState((s) => ({
      ...s,
      cyclopsState: 'hit',
      shake: !usingSpecial,
      shakeSpecial: usingSpecial,
      damageNumber: { side: 'left', amount: damage, key: Date.now() + 1, special: usingSpecial },
      cyclopsHp: Math.max(0, s.cyclopsHp - damage),
      medusaState: 'idle',
      medusaSpecialEquipped: false,
      medusaPower: Math.min(MAX_POWER, s.medusaPower + damage * MEDUSA_POWER_RATE),
    }));
    await rw(usingSpecial ? 650 : 500);

    setState((s) => {
      const dead = s.cyclopsHp <= 0;
      return {
        ...s,
        shake: false,
        shakeSpecial: false,
        cyclopsState: dead ? 'death' : 'idle',
        log: dead ? 'Left sprite has fallen! Right sprite wins!' : s.log,
        busyRight: false,
        busy: s.busyLeft,
      };
    });
  }, [patch]);

  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  return {
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
  };
}
