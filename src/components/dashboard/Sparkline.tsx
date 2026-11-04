import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  label?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 36,
  color = '#38bdf8',
  fillOpacity = 0.15,
  label = 'Metric Trend',
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-neutral-500 font-mono"
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
    const x = (index / (validData.length - 1 || 1)) * (width - 4) + 2;
    const y = height - paddingY - ((val - min) / range) * effectiveHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width - 2},${height} L 2,${height} Z`;

  // Accessible description of trend
  const first = validData[0];
  const last = validData[validData.length - 1];
  const trend = last > first ? 'increasing' : last < first ? 'decreasing' : 'stable';
  const ariaDescription = `${label}: ${trend} trend from ${first} to ${last}`;

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label={ariaDescription}
    >
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      {/* Gradient area */}
      <path
        d={areaD}
        fill={`url(#grad-${color.replace('#', '')})`}
        className="transition-all duration-300"
      />
      {/* Trend line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
      />
      {/* End point indicator */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].split(',')[0]}
          cy={points[points.length - 1].split(',')[1]}
          r="2.5"
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  );
};
