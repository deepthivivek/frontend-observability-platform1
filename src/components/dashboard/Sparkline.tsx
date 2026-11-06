import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  label?: string;
  gradientId?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 36,
  color = '#818CF8', // Electric Indigo default
  fillOpacity = 0.22,
  label = 'Metric Trend',
  gradientId,
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-500 font-mono"
        style={{ width, height }}
        aria-label={`${label}: No data available`}
      >
        --
      </div>
    );
  }

  const validData = data.map((d) => (typeof d === 'number' && !isNaN(d) ? d : 0));
  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  const paddingY = 4;
  const effectiveHeight = height - paddingY * 2;

  const points = validData.map((val, index) => {
    const x = (index / (validData.length - 1 || 1)) * (width - 6) + 3;
    const y = height - paddingY - ((val - min) / range) * effectiveHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width - 3},${height} L 3,${height} Z`;

  // Accessible description of trend
  const first = validData[0];
  const last = validData[validData.length - 1];
  const trend = last > first ? 'increasing' : last < first ? 'decreasing' : 'stable';
  const ariaDescription = `${label}: ${trend} trend from ${first} to ${last}`;

  const resolvedGradientId = gradientId || `grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label={ariaDescription}
    >
      <defs>
        <linearGradient id={resolvedGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="60%" stopColor={color} stopOpacity={fillOpacity * 0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
        <filter id={`glow-${resolvedGradientId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={color} floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Multi-stop gradient area */}
      <path
        d={areaD}
        fill={`url(#${resolvedGradientId})`}
        className="transition-all duration-300"
      />

      {/* Neon Trend line with glow */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#glow-${resolvedGradientId})`}
        className="transition-all duration-300"
      />

      {/* Pulsing endpoint indicator with outer halo */}
      {points.length > 0 && (
        <g>
          <circle
            cx={points[points.length - 1].split(',')[0]}
            cy={points[points.length - 1].split(',')[1]}
            r="4.5"
            fill={color}
            opacity="0.3"
            className="animate-ping"
          />
          <circle
            cx={points[points.length - 1].split(',')[0]}
            cy={points[points.length - 1].split(',')[1]}
            r="2.5"
            fill="#FFFFFF"
            stroke={color}
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
};
