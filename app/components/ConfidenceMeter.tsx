export function ConfidenceMeter({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const tpct = Math.max(0, Math.min(1, threshold)) * 100;
  const below = value < threshold;
  return (
    <div className="w-full">
      <div className="relative h-2.5 w-full rounded-full bg-stone-200">
        <div
          className={`absolute left-0 top-0 h-2.5 rounded-full ${below ? "bg-red-600" : "bg-emerald-600"}`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute top-[-3px] h-4 w-0.5 bg-stone-700" style={{ left: `calc(${tpct}% - 1px)` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-stone-500 tnum">
        <span>0</span>
        <span className="font-medium text-stone-700">threshold {threshold.toFixed(2)}</span>
        <span>1.00</span>
      </div>
    </div>
  );
}
