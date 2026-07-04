/** Minimal inline SVG bar chart, no charting library: a handful of bars
 * across a fixed-height viewBox is all the admin metrics panel needs. */
export function SimpleBarChart({
  data,
  height = 120,
  valueFormatter = (v) => String(v),
}: {
  data: { label: string; value: number }[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) return <p className="text-sm text-neutral-400">No data yet.</p>;

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 20);
          return (
            <rect
              key={d.label}
              x={i * barWidth + barWidth * 0.15}
              y={height - 20 - barHeight}
              width={barWidth * 0.7}
              height={barHeight}
              className="fill-crew-green"
              rx={1}
            >
              <title>
                {d.label}: {valueFormatter(d.value)}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
