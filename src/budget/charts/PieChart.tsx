import { useMemo, useState } from "react";
import { CHART_PALETTE, fmtTRY } from "../data";

interface Group { name: string; icon: string; total: number; subs?: Record<string, number> }

const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
function arcPath(cx: number, cy: number, r: number, s: number, e: number) {
  const p1 = [cx + r * Math.cos(toRad(s)), cy + r * Math.sin(toRad(s))];
  const p2 = [cx + r * Math.cos(toRad(e)), cy + r * Math.sin(toRad(e))];
  const large = e - s > 180 ? 1 : 0;
  return `M${cx},${cy} L${p1[0]},${p1[1]} A${r},${r},0,${large},1,${p2[0]},${p2[1]} Z`;
}
function midPt(cx: number, cy: number, r: number, s: number, e: number) {
  const a = (s + e) / 2;
  return [cx + r * Math.cos(toRad(a)), cy + r * Math.sin(toRad(a))];
}

export function PieChart({ groups, totalLabel }: { groups: Group[]; totalLabel: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const CX = 150, CY = 150, R = 110, RH = 122, INNER = 64;

  const total = groups.reduce((s, g) => s + g.total, 0) || 1;
  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    groups.forEach((g, i) => { m[g.name] = CHART_PALETTE[i % CHART_PALETTE.length]; });
    return m;
  }, [groups]);

  let angle = 0;
  const slices = groups.map(g => {
    const sweep = (g.total / total) * 360;
    const sl = { ...g, s: angle, e: angle + sweep, sweep, pct: ((g.total / total) * 100) };
    angle += sweep;
    return sl;
  });

  const selected = sel ? slices.find(s => s.name === sel) ?? null : null;

  return (
    <div className="animate-fade-in">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
        {totalLabel}: <span className="text-foreground">{fmtTRY(total)} ₺</span>
      </div>

      <svg viewBox="0 0 300 300" className="block mx-auto w-full max-w-[300px]">
        <defs>
          <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feOffset dy="4" result="offset"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.18"/></feComponentTransfer>
            <feComposite in2="SourceAlpha" operator="in"/>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <g filter="url(#pieShadow)">
          {slices.map((sl, i) => {
            const isSel = sel === sl.name;
            const r = isSel ? RH : R;
            return (
              <g key={i} className="cursor-pointer" onClick={() => setSel(isSel ? null : sl.name)}>
                <path
                  d={arcPath(CX, CY, r, sl.s, sl.e)}
                  fill={colorMap[sl.name]}
                  opacity={sel && !isSel ? 0.32 : 1}
                  style={{ transition: "all 0.35s var(--ease-out-expo)", transformOrigin: `${CX}px ${CY}px` }}
                />
                {sl.sweep > 22 && (() => {
                  const [lx, ly] = midPt(CX, CY, r * 0.68, sl.s, sl.e);
                  return (
                    <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                      fontSize="11" fontWeight="700" fill="#fff" pointerEvents="none">
                      %{sl.pct.toFixed(0)}
                    </text>
                  );
                })()}
              </g>
            );
          })}
        </g>

        {/* Donut hole */}
        <circle cx={CX} cy={CY} r={INNER} fill="hsl(var(--card))" />
        <circle cx={CX} cy={CY} r={INNER} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />

        {selected ? (
          <g className="animate-fade-in" key={selected.name}>
            <text x={CX} y={CY - 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="hsl(var(--muted-foreground))">
              {selected.icon} {selected.name}
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="18" fontWeight="800" fill="hsl(var(--foreground))" className="tabular">
              {fmtTRY(selected.total)} ₺
            </text>
            <text x={CX} y={CY + 26} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
              %{selected.pct.toFixed(1)}
            </text>
          </g>
        ) : (
          <g className="animate-fade-in">
            <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))" className="uppercase tracking-wider">Toplam</text>
            <text x={CX} y={CY + 16} textAnchor="middle" fontSize="18" fontWeight="800" fill="hsl(var(--foreground))" className="tabular">
              {fmtTRY(total)} ₺
            </text>
          </g>
        )}
      </svg>

      {/* Subcategory breakdown */}
      {selected?.subs && Object.keys(selected.subs).length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-secondary/60 animate-slide-up">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Alt Kategoriler</div>
          <div className="space-y-1.5">
            {Object.entries(selected.subs).sort((a, b) => b[1] - a[1]).map(([sub, amt]) => (
              <div key={sub} className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-foreground">{sub}</span>
                <span className="text-muted-foreground tabular">{fmtTRY(amt)} ₺</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend chips */}
      <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
        {slices.map(sl => {
          const isSel = sel === sl.name;
          return (
            <button
              key={sl.name}
              onClick={() => setSel(isSel ? null : sl.name)}
              className="press flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
              style={{
                borderColor: isSel ? colorMap[sl.name] : "hsl(var(--border))",
                background: isSel ? `${colorMap[sl.name]}1f` : "hsl(var(--card))",
                color: "hsl(var(--foreground))",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: colorMap[sl.name] }} />
              {sl.icon} {sl.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
