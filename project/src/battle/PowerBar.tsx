interface PowerBarProps {
  name: string;
  power: number;
  maxPower: number;
  equipped: boolean;
  ready: boolean;
  align: 'left' | 'right';
  onEquip: () => void;
}

export function PowerBar({ name, power, maxPower, equipped, ready, align, onEquip }: PowerBarProps) {
  const pct = Math.max(0, Math.min(100, (power / maxPower) * 100));

  return (
    <div className={`flex flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2">
        <span className="font-display text-xs font-bold tracking-wide text-cyan-200/80">
          {name} Special
        </span>
        <span className="text-[10px] font-semibold text-cyan-100/50 tabular-nums">
          {Math.floor(pct)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        {align === 'right' && (
          <button
            onClick={onEquip}
            disabled={!ready || equipped}
            className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide transition-all ${
              equipped
                ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                : ready
                  ? 'border-cyan-400 bg-cyan-600/30 text-cyan-100 hover:bg-cyan-500/40'
                  : 'border-gray-700 bg-gray-800/50 text-gray-500'
            }`}
          >
            {equipped ? 'EQUIPPED' : 'EQUIP'}
          </button>
        )}
        <div
          className="relative h-3 w-36 overflow-hidden rounded-full border-2 border-cyan-900/70 bg-black/60"
          style={{ boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.6)' }}
        >
          <div
            className="relative h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${pct}%`,
              marginLeft: align === 'right' ? 'auto' : 0,
              background: ready
                ? 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)'
                : 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)',
              boxShadow: ready
                ? '0 0 10px rgba(251, 191, 36, 0.6)'
                : '0 0 6px rgba(56, 189, 248, 0.4)',
            }}
          >
            {ready && (
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                  animation: 'hp-shimmer 1.2s ease-in-out infinite',
                }}
              />
            )}
          </div>
        </div>
        {align === 'left' && (
          <button
            onClick={onEquip}
            disabled={!ready || equipped}
            className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide transition-all ${
              equipped
                ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                : ready
                  ? 'border-cyan-400 bg-cyan-600/30 text-cyan-100 hover:bg-cyan-500/40'
                  : 'border-gray-700 bg-gray-800/50 text-gray-500'
            }`}
          >
            {equipped ? 'EQUIPPED' : 'EQUIP'}
          </button>
        )}
      </div>
    </div>
  );
}
