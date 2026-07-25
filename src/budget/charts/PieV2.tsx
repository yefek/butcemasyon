import { useMemo, useState } from "react";
import { fmtTRY } from "../data";

interface Group { name: string; icon: string; total: number; subs?: Record<string, number> }

const PALETTE = [
  "hsl(220 60% 55%)", "hsl(280 45% 58%)", "hsl(340 55% 58%)",
  "hsl(20 70% 58%)",  "hsl(45 75% 52%)",  "hsl(160 45% 45%)",
  "hsl(190 55% 48%)", "hsl(245 50% 60%)", "hsl(0 55% 58%)",
  "hsl(120 35% 48%)",
];

const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
function arcPath(cx: number, cy: number, rOut: number, rIn: number, s: number, e: number) {
  // Handle full circle (single-slice case) — arcs of 360° collapse to a point.
  if (e - s >= 359.999) {
    return (
      `M${cx + rOut},${cy} A${rOut},${rOut} 0 1 1 ${cx - rOut},${cy} A${rOut},${rOut} 0 1 1 ${cx + rOut},${cy} ` +
      `M${cx + rIn},${cy} A${rIn},${rIn} 0 1 0 ${cx - rIn},${cy} A${rIn},${rIn} 0 1 0 ${cx + rIn},${cy} Z`
    );
  }
  const p1o = [cx + rOut * Math.cos(toRad(s)), cy + rOut * Math.sin(toRad(s))];
  const p2o = [cx + rOut * Math.cos(toRad(e)), cy + rOut * Math.sin(toRad(e))];
  const p1i = [cx + rIn * Math.cos(toRad(e)),  cy + rIn * Math.sin(toRad(e))];
  const p2i = [cx + rIn * Math.cos(toRad(s)),  cy + rIn * Math.sin(toRad(s))];
  const large = e - s > 180 ? 1 : 0;
  return `M${p1o[0]},${p1o[1]} A${rOut},${rOut} 0 ${large} 1 ${p2o[0]},${p2o[1]} L${p1i[0]},${p1i[1]} A${rIn},${rIn} 0 ${large} 0 ${p2i[0]},${p2i[1]} Z`;
}

export function PieV2({ groups, totalLabel }: { groups: Group[]; totalLabel: string }) {
  const [sel, setSel] = useState<string | null>(null);

  const CX = 170, CY = 170, R_OUT = 130, R_IN = 80;
  const total = groups.reduce((s, g) => s + g.total, 0) || 1;

  const slices = useMemo(() => {
    let a = 0;
    return groups.map((g, i) => {
      const sweep = (g.total / total) * 360;
      const sl = { ...g, s: a, e: a + sweep, mid: a + sweep / 2, sweep, color: PALETTE[i % PALETTE.length], pct: (g.total / total) * 100 };
      a += sweep;
      return sl;
    });
  }, [groups, total]);

  const selected = sel ? slices.find(s => s.name === sel) ?? null : null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-center gap-6">
        <svg viewBox="0 0 340 340" className="block w-[240px] h-[240px] sm:w-[280px] sm:h-[280px]">
          {slices.map((sl, i) => {
            const isSel = sel === sl.name;
            const isDim = sel && !isSel;
            const r = isSel ? R_OUT + 6 : R_OUT;
            return (
              <g key={i} onClick={() => setSel(isSel ? null : sl.name)} style={{ cursor: "pointer" }}>
                <path
                  d={arcPath(CX, CY, r, R_IN, sl.s, sl.e)}
                  fill={sl.color}
                  fillRule="evenodd"
                  opacity={isDim ? 0.25 : 1}
                  style={{
                    transition: "all 0.3s var(--ease-out-expo)",
                    animation: `fade-in 0.4s var(--ease-out-expo) ${i * 40}ms both`,
                  }}
                />
              </g>
            );
          })}

          {/* Center label */}
          <g>
            <text x={CX} y={CY - 10} textAnchor="middle" fontSize="10.5" fill="hsl(var(--v2-text-muted))" style={{ letterSpacing: "0.12em" }}>
              {(selected ? selected.name : totalLabel).toUpperCase()}
            </text>
            <text x={CX} y={CY + 14} textAnchor="middle" fontSize="20" fontWeight="700" fill="hsl(var(--v2-text))" className="tabular">
              {fmtTRY(selected ? selected.total : total)} ₺
            </text>
            {selected && (
              <text x={CX} y={CY + 32} textAnchor="middle" fontSize="11" fill="hsl(var(--v2-text-muted))" className="tabular">
                %{selected.pct.toFixed(1)}
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* Legend list — selected row reveals its subcategories inline */}
      <div className="mt-5 space-y-1">
        {slices.map(sl => {
          const active = sel === sl.name;
          const subs = sl.subs && Object.keys(sl.subs).length > 0
            ? Object.entries(sl.subs).sort((a, b) => b[1] - a[1])
            : [];
          return (
            <div key={sl.name}>
              <button
                onClick={() => setSel(active ? null : sl.name)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                style={{
                  background: active ? "hsl(var(--v2-surface-2))" : "transparent",
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sl.color }} />
                <span className="text-[13px] font-medium flex-1 truncate">
                  <span className="mr-1.5">{sl.icon}</span>{sl.name}
                </span>
                <span className="text-[12px] v2-text-muted tabular w-12 text-right">%{sl.pct.toFixed(0)}</span>
                <span className="text-[13px] font-semibold tabular w-20 text-right">{fmtTRY(sl.total)} ₺</span>
              </button>

              {active && subs.length > 0 && (
                <div className="ml-7 mr-3 mb-2 mt-1 pl-3 border-l-2 animate-slide-down" style={{ borderColor: sl.color }}>
                  {subs.map(([sub, amt]) => (
                    <div key={sub} className="flex items-center justify-between py-1 text-[12px]">
                      <span className="font-medium v2-text-muted">{sub}</span>
                      <span className="tabular font-semibold">{fmtTRY(amt)} ₺</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
