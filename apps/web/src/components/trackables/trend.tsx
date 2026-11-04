import { useTranslation } from 'react-i18next';
import type { Trend } from '@tarbya/api-client';
import { cn } from '@tarbya/ui';

// BR-TRK-5: always an arrow and a word, never colour alone.
const tones: Record<
  Trend,
  { arrow: string; className: string; stroke: string }
> = {
  IMPROVING: {
    arrow: '↑',
    className: 'bg-emerald-50 text-trend-up',
    stroke: '#047857',
  },
  WORSE: {
    arrow: '↓',
    className: 'bg-red-50 text-trend-down',
    stroke: '#B91C1C',
  },
  STEADY: {
    arrow: '–',
    className: 'bg-slate-100 text-trend-steady',
    stroke: '#475569',
  },
  NEW: {
    arrow: '•',
    className: 'bg-accent-tint text-accent-strong',
    stroke: '#D7A84A',
  },
};

export function TrendBadge({ trend }: { trend: Trend }) {
  const { t } = useTranslation();
  const tone = tones[trend];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold',
        tone.className,
      )}
    >
      <span aria-hidden>{tone.arrow}</span>
      {t(`trackables.trend.${trend}`)}
    </span>
  );
}

/** A small line chart of the values, with the target (when there is one) as a dashed line. */
export function Sparkline({
  points,
  target,
  trend,
  height = 72,
  label,
}: {
  points: number[];
  target: number | null;
  trend: Trend;
  height?: number;
  label: string;
}) {
  const { i18n } = useTranslation();
  const width = 300;
  const pad = 6;
  if (points.length === 0) return null;
  // Time runs with the reading direction: oldest at the start, latest at the end.
  const rtl = i18n.dir() === 'rtl';
  const top = Math.max(target ?? 0, ...points);
  const bottom = Math.min(0, ...points);
  const span = top - bottom || 1;
  const x = (i: number) => {
    const at =
      points.length === 1
        ? width / 2
        : pad + (i * (width - 2 * pad)) / (points.length - 1);
    return rtl ? width - at : at;
  };
  const y = (v: number) =>
    height - pad - ((v - bottom) / span) * (height - 2 * pad);
  const line = points
    .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
  const stroke = tones[trend].stroke;
  return (
    <div>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
      >
        {target !== null && (
          <line
            x1={pad}
            x2={width - pad}
            y1={y(target)}
            y2={y(target)}
            stroke="#CBD5E1"
            strokeDasharray="4 4"
          />
        )}
        <polyline
          points={`${x(0)},${height - pad} ${line} ${x(points.length - 1)},${height - pad}`}
          fill={stroke}
          fillOpacity={0.08}
          stroke="none"
        />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(points[points.length - 1])}
          r={4}
          fill={stroke}
        />
      </svg>
    </div>
  );
}
