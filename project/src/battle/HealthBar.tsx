interface HealthBarProps {
  name: string;
  hp: number;
  maxHp: number;
  align: 'left' | 'right';
}

export function HealthBar({ name, hp, maxHp, align }: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const low = pct <= 30;
  const mid = pct <= 60 && pct > 30;

  const barColor = low ? '#e53e3e' : mid ? '#ecc94b' : '#48bb78';

  return (
    <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2">
        <span className="font-display text-sm font-bold tracking-wide text-amber-200/90">{name}</span>
        <span className="text-xs font-semibold text-amber-100/60 tabular-nums">
          {Math.max(0, Math.ceil(hp))} / {maxHp}
        </span>
      </div>
      <div
        className="relative h-4 w-56 overflow-hidden rounded-full border-2 border-amber-900/70 bg-black/60"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }}
      >
        <div
          className="hp-shimmer relative h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(180deg, ${barColor} 0%, ${barColor}cc 50%, ${barColor}99 100%)`,
            marginLeft: align === 'right' ? 'auto' : 0,
          }}
        />
      </div>
    </div>
  );
}
