import { useMemo } from "react";
import { CHART_PALETTE, fmtTRY, trunc, type Transaction } from "../data";

interface Props { transactions: Transaction[] }

interface RightItem {
  name: string;
  icon: string;
  total: number;
  isSav?: boolean;
  isOther?: boolean;
  items?: RightItem[];
}

const catColor = (name: string, fallback = 0) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return CHART_PALETTE[(h + fallback) % CHART_PALETTE.length];
};

export function SankeyDiagram({ transactions }: Props) {
  const data = useMemo(() => {
    const totalInc = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExp = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const savings = Math.max(0, totalInc - totalExp);

    const incomeSrcs = Object.values(
      transactions.filter(t => t.type === "income").reduce<Record<string, { name: string; icon: string; total: number }>>((acc, t) => {
        if (!acc[t.category]) acc[t.category] = { name: t.category, icon: t.icon || "💰", total: 0 };
        acc[t.category].total += t.amount;
        return acc;
      }, {})
    ).sort((a, b) => b.total - a.total);

    const allExp = Object.values(
      transactions.filter(t => t.type === "expense").reduce<Record<string, { name: string; icon: string; total: number }>>((acc, t) => {
        if (!acc[t.category]) acc[t.category] = { name: t.category, icon: t.icon || "📦", total: 0 };
        acc[t.category].total += t.amount;
        return acc;
      }, {})
    ).sort((a, b) => b.total - a.total);

    return { totalInc, totalExp, savings, incomeSrcs, allExp };
  }, [transactions]);

  const { totalInc, totalExp, savings, incomeSrcs, allExp } = data;

  if (!totalInc && !totalExp) {
    return <div className="text-center text-sm text-muted-foreground py-12">Veri yok.</div>;
  }

  const W = 380, NW = 14, PADD = 24;
  const LX = 78, RX = 246;
  const SCALE = Math.max(totalInc, totalExp + savings, 1);
  const MIN_VIS = 28;
  const estH = (t: number) => (t / SCALE) * 400;

  const rightAll: RightItem[] = [
    ...allExp,
    ...(savings > 0 ? [{ name: "Tasarruf", icon: "💰", total: savings, isSav: true }] : []),
  ];
  const visible = rightAll.filter(n => estH(n.total) >= MIN_VIS);
  const small = rightAll.filter(n => estH(n.total) < MIN_VIS && !n.isSav);
  const otherTotal = small.reduce((s, n) => s + n.total, 0);
  const rightItems: RightItem[] = [
    ...visible,
    ...(otherTotal > 0 ? [{ name: "Diğer", icon: "📦", total: otherTotal, isOther: true, items: small }] : []),
  ];

  const nRows = Math.max(incomeSrcs.length, rightItems.length, 3);
  const H = Math.max(280, nRows * 56 + PADD * 2);
  const FLOW_H = H - PADD * 2;

  let lOff = 0;
  const leftNodes = incomeSrcs.map(s => {
    const h = (s.total / SCALE) * FLOW_H;
    const n = { ...s, y: PADD + lOff, h: Math.max(h, 2) };
    lOff += h;
    return n;
  });

  let rOff = 0;
  const rightNodes = rightItems.map(it => {
    const h = (it.total / SCALE) * FLOW_H;
    const n = { ...it, y: PADD + rOff, h: Math.max(h, 2) };
    rOff += h;
    return n;
  });

  let lCursor = PADD;
  const flows = rightNodes.map(rn => {
    const fh = rn.h;
    const lt = lCursor, lb = lt + fh;
    lCursor += fh;
    const cx = (LX + NW + RX) / 2;
    const col = rn.isSav ? "hsl(var(--income))" : rn.isOther ? "hsl(var(--muted-foreground))" : catColor(rn.name);
    return {
      col,
      d: `M${LX + NW},${lt} C${cx},${lt} ${cx},${rn.y} ${RX},${rn.y} L${RX},${rn.y + rn.h} C${cx},${rn.y + rn.h} ${cx},${lb} ${LX + NW},${lb} Z`,
    };
  });

  const vis = (h: number) => h >= MIN_VIS;
  const fmtCompact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gelir → Gider Akışı</div>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5 text-income"><span className="w-2 h-2 rounded-full bg-income"/>Gelir</span>
          <span className="flex items-center gap-1.5 text-expense"><span className="w-2 h-2 rounded-full bg-expense"/>Gider</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="incomeBar" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(var(--income))" />
            <stop offset="1" stopColor="hsl(var(--income))" stopOpacity="0.7"/>
          </linearGradient>
        </defs>

        {/* Flows with draw-in animation */}
        {flows.map((f, i) => (
          <path
            key={i}
            d={f.d}
            fill={f.col}
            opacity={0.22}
            style={{
              animation: `fade-in 0.6s var(--ease-out-expo) ${i * 60}ms both`,
            }}
          />
        ))}

        {/* Left nodes — income */}
        {leftNodes.map((n, i) => (
          <g key={i} style={{ animation: `slide-down 0.4s var(--ease-out-expo) ${i * 50}ms both` }}>
            <rect x={LX} y={n.y} width={NW} height={n.h} rx={4} fill="url(#incomeBar)" />
            {vis(n.h) && (
              <>
                <text x={LX - 8} y={n.y + n.h / 2 - 5} textAnchor="end" fontSize="11" fontWeight="700" fill="hsl(var(--foreground))">
                  {n.icon} {trunc(n.name, 9)}
                </text>
                <text x={LX - 8} y={n.y + n.h / 2 + 9} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))" className="tabular">
                  {fmtCompact(n.total)} ₺
                </text>
              </>
            )}
          </g>
        ))}

        {/* Right nodes — expense + savings */}
        {rightNodes.map((n, i) => {
          const col = n.isSav ? "hsl(var(--income))" : n.isOther ? "hsl(var(--muted-foreground))" : catColor(n.name);
          return (
            <g key={i} style={{ animation: `slide-up 0.4s var(--ease-out-expo) ${i * 50}ms both` }}>
              <rect x={RX} y={n.y} width={NW} height={n.h} rx={4} fill={col} />
              {vis(n.h) && (
                <>
                  <text x={RX + NW + 8} y={n.y + n.h / 2 - 5} fontSize="11" fontWeight="700" fill="hsl(var(--foreground))">
                    {n.icon} {trunc(n.name, 10)}
                  </text>
                  <text x={RX + NW + 8} y={n.y + n.h / 2 + 9} fontSize="10" fill="hsl(var(--muted-foreground))" className="tabular">
                    {fmtCompact(n.total)} ₺
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {otherTotal > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-secondary/60 animate-slide-up">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            📦 Diğer — {fmtTRY(otherTotal)} ₺
          </div>
          <div className="space-y-1">
            {small.map((n, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span className="font-medium">{n.icon} {n.name}</span>
                <span className="text-muted-foreground tabular">{fmtTRY(n.total)} ₺</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
