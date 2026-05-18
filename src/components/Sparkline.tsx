interface Props {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  min?: number;
  max?: number;
}

export function Sparkline({
  values,
  color = "var(--primary)",
  width = 80,
  height = 24,
  min,
  max,
}: Props) {
  if (!values || values.length < 2) {
    return (
      <div
        className="rounded bg-muted/50"
        style={{ width, height }}
        aria-hidden
      />
    );
  }
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const range = hi - lo || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - lo) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const lastY = height - ((last - lo) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={width} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}