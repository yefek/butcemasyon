import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { fmtTRY, type Transaction } from "../data";

interface Props { transactions: Transaction[] }
export interface SankeyV2Handle { download: () => void }

/**
 * Professional 3-column Sankey (income sources → Revenue hub → expense categories + savings).
 * Inspired by classic income-statement Sankey diagrams: neutral source bands on the left,
 * a single dark hub in the middle, and tinted outflow bands on the right.
 */

interface Node {
  name: string;
  total: number;
  col: 0 | 1 | 2;
  y: number;
  h: number;
  color: string;       // node bar color
  bandColor: string;   // outgoing band color (with low opacity)
  kind: "income" | "hub" | "expense" | "savings";
}

const COL_INCOME  = "hsl(220 8% 55%)";    // neutral grey for income
const COL_HUB     = "hsl(220 12% 32%)";   // dark hub
const COL_EXPENSE = "hsl(0 60% 55%)";     // red for expenses
const COL_SAVING  = "hsl(150 50% 45%)";   // green for savings/profit

export const SankeyV2 = forwardRef<SankeyV2Handle, Props>(function SankeyV2({ transactions }, ref) {
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const W = 620;
  const NODE_W = 16;
  const PAD_Y = 18;
  const GAP = 6;

  const { nodes, links, totalIn, totalOut, H } = useMemo(() => {
    const incMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};
    transactions.forEach(t => {
      const m = t.type === "income" ? incMap : expMap;
      m[t.category] = (m[t.category] || 0) + t.amount;
    });
    const inc = Object.entries(incMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    const exp = Object.entries(expMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

    // Group small expenses (<3%)
    const totalExpRaw = exp.reduce((s, x) => s + x.total, 0);
    const big = exp.filter(e => e.total / Math.max(1, totalExpRaw) >= 0.03);
    const small = exp.filter(e => e.total / Math.max(1, totalExpRaw) < 0.03);
    const expGrouped = [...big];
    if (small.length > 1) expGrouped.push({ name: "Diğer", total: small.reduce((s, x) => s + x.total, 0) });
    else if (small.length === 1) expGrouped.push(small[0]);

    const totalIn = inc.reduce((s, x) => s + x.total, 0);
    const totalOut = expGrouped.reduce((s, x) => s + x.total, 0);
    const savings = Math.max(0, totalIn - totalOut);

    const rightItems = [
      ...expGrouped.map(e => ({ name: e.name, total: e.total, kind: "expense" as const })),
      ...(savings > 0 ? [{ name: "Tasarruf", total: savings, kind: "savings" as const }] : []),
    ];

    const leftCount = Math.max(1, inc.length);
    const rightCount = Math.max(1, rightItems.length);
    const H = Math.max(300, Math.max(leftCount, rightCount) * 56 + 40);
    const usableH = H - PAD_Y * 2;
    const scale = Math.max(totalIn, 1);

    const layoutCol = <T extends { name: string; total: number; kind?: Node["kind"] }>(
      items: T[], col: 0 | 1 | 2,
    ): Node[] => {
      const totalH = items.reduce((s, n) => s + (n.total / scale) * usableH, 0);
      const gapH = (items.length - 1) * GAP;
      let y = PAD_Y + Math.max(0, (usableH - totalH - gapH) / 2);
      return items.map(n => {
        const h = Math.max(10, (n.total / scale) * usableH);
        const kind: Node["kind"] = n.kind || (col === 0 ? "income" : "hub");
        const color =
          kind === "savings" ? COL_SAVING :
          kind === "expense" ? COL_EXPENSE :
          kind === "hub" ? COL_HUB : COL_INCOME;
        const node: Node = { name: n.name, total: n.total, col, y, h, color, bandColor: color, kind };
        y += h + GAP;
        return node;
      });
    };

    const leftNodes = layoutCol(inc.length ? inc : [{ name: "Gelir yok", total: 0 }], 0);
    const hubNodes = layoutCol([{ name: "Toplam Gelir", total: totalIn || 1, kind: "hub" as const }], 1);
    const rightNodes = layoutCol(rightItems.length ? rightItems : [{ name: "Gider yok", total: 0, kind: "expense" as const }], 2);

    const allNodes = [...leftNodes, ...hubNodes, ...rightNodes];

    // Build links: left -> hub, hub -> right
    const x0Hub = (W - NODE_W) / 2;
    const x1Hub = x0Hub + NODE_W;
    const hub = hubNodes[0];

    type Link = { d: string; color: string; key: string; from: string; to: string };
    const links: Link[] = [];

    // left -> hub (each income proportionally enters the hub)
    let hubLeftCursor = hub.y;
    leftNodes.forEach((ln, li) => {
      if (ln.total <= 0) return;
      const t = (ln.total / scale) * usableH;
      const x0 = NODE_W;
      const x1 = x0Hub;
      const y0 = ln.y;
      const y1 = hubLeftCursor;
      const cx = (x0 + x1) / 2;
      const d = `M${x0},${y0} C${cx},${y0} ${cx},${y1} ${x1},${y1} L${x1},${y1 + t} C${cx},${y1 + t} ${cx},${y0 + t} ${x0},${y0 + t} Z`;
      links.push({ d, color: COL_INCOME, key: `L${li}`, from: `L${li}`, to: `H` });
      hubLeftCursor += t;
    });

    // hub -> right
    let hubRightCursor = hub.y;
    rightNodes.forEach((rn, ri) => {
      if (rn.total <= 0) return;
      const t = (rn.total / scale) * usableH;
      const x0 = x1Hub;
      const x1 = W - NODE_W;
      const y0 = hubRightCursor;
      const y1 = rn.y;
      const cx = (x0 + x1) / 2;
      const d = `M${x0},${y0} C${cx},${y0} ${cx},${y1} ${x1},${y1} L${x1},${y1 + t} C${cx},${y1 + t} ${cx},${y0 + t} ${x0},${y0 + t} Z`;
      links.push({ d, color: rn.color, key: `R${ri}`, from: `H`, to: `R${ri}` });
      hubRightCursor += t;
    });

    return { nodes: allNodes, links, totalIn, totalOut, H };
  }, [transactions]);

  const handleDownload = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const cs = getComputedStyle(document.documentElement);
    const textColor = `hsl(${cs.getPropertyValue("--v2-text").trim()})`;
    const mutedColor = `hsl(${cs.getPropertyValue("--v2-text-muted").trim()})`;
    clone.querySelectorAll("text").forEach(t => {
      const f = (t as SVGTextElement).getAttribute("fill") || "";
      if (f.includes("--v2-text-muted")) t.setAttribute("fill", mutedColor);
      else if (f.includes("--v2-text")) t.setAttribute("fill", textColor);
    });
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const bg = `hsl(${cs.getPropertyValue("--v2-surface").trim() || "0 0% 100%"})`;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "-110"); rect.setAttribute("y", "0");
    rect.setAttribute("width", String(W + 220)); rect.setAttribute("height", String(H));
    rect.setAttribute("fill", bg);
    clone.insertBefore(rect, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `para-akisi-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useImperativeHandle(ref, () => ({ download: handleDownload }));

  if (!totalIn && !totalOut) {
    return <div className="text-center text-sm v2-text-muted py-12">Veri yok.</div>;
  }

  const isDimmed = (id: string) => hover !== null && hover !== id;


  return (
    <div className="animate-fade-in relative">
      <div className="no-scrollbar overflow-x-auto -mx-2 px-2 pt-1">
        <svg
          ref={svgRef}
          viewBox={`-110 0 ${W + 220} ${H}`}
          className="block w-full"
          style={{ minWidth: 340 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Bands */}
          <g>
            {links.map((l, i) => (
              <path
                key={l.key}
                d={l.d}
                fill={l.color}
                opacity={isDimmed(l.from) && isDimmed(l.to) ? 0.08 : 0.42}
                style={{
                  transition: "opacity 0.25s var(--ease-out-expo)",
                  animation: `fade-in 0.5s var(--ease-out-expo) ${Math.min(i, 18) * 25}ms both`,
                }}
              />
            ))}
          </g>

          {/* Nodes + labels */}
          {nodes.map((n, i) => {
            const id = n.col === 0 ? `L${i}` : n.col === 1 ? `H` : `R${i - (nodes.findIndex(x => x.col === 2))}`;
            const isLeft = n.col === 0;
            const isHub = n.col === 1;
            const x = isLeft ? 0 : isHub ? (W - NODE_W) / 2 : W - NODE_W;
            const labelX = isLeft ? -12 : isHub ? x + NODE_W / 2 : W + 12;
            const anchor = isLeft ? "end" : isHub ? "middle" : "start";
            const cy = n.y + n.h / 2;

            return (
              <g
                key={`n${i}`}
                onMouseEnter={() => setHover(id)}
                onMouseLeave={() => setHover(null)}
                style={{
                  cursor: "pointer",
                  animation: `${isLeft ? "slide-down" : "slide-up"} 0.4s var(--ease-out-expo) ${i * 35}ms both`,
                }}
              >
                <rect x={x} y={n.y} width={NODE_W} height={n.h} rx={3} fill={n.color} />
                {isHub ? (
                  // Hub label sits inside / above the bar
                  <>
                    <text
                      x={labelX} y={n.y - 8}
                      textAnchor="middle"
                      fontSize="13" fontWeight="700" fill="hsl(var(--v2-text))"
                    >
                      Toplam Gelir
                    </text>
                    <text
                      x={labelX} y={n.y + n.h + 16}
                      textAnchor="middle"
                      fontSize="11" fontWeight="600" fill="hsl(var(--v2-text-muted))" className="tabular"
                    >
                      {fmtTRY(n.total)} ₺
                    </text>
                  </>
                ) : (
                  <>
                    <text
                      x={labelX} y={cy - 3}
                      textAnchor={anchor} dominantBaseline="middle"
                      fontSize="13" fontWeight="600" fill="hsl(var(--v2-text))"
                    >
                      {n.name}
                    </text>
                    <text
                      x={labelX} y={cy + 13}
                      textAnchor={anchor} dominantBaseline="middle"
                      fontSize="11" fill="hsl(var(--v2-text-muted))" className="tabular"
                    >
                      {fmtTRY(n.total)} ₺
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer summary — stacked vertically */}
      <div className="mt-4 space-y-2 text-[12.5px]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COL_INCOME }} />
          <span className="v2-text-muted flex-1">Gelir</span>
          <span className="font-semibold tabular">{fmtTRY(totalIn)} ₺</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COL_EXPENSE }} />
          <span className="v2-text-muted flex-1">Gider</span>
          <span className="font-semibold tabular">{fmtTRY(totalOut)} ₺</span>
        </div>
        {totalIn - totalOut > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COL_SAVING }} />
            <span className="v2-text-muted flex-1">Tasarruf</span>
            <span className="font-semibold tabular">{fmtTRY(totalIn - totalOut)} ₺</span>
          </div>
        )}
      </div>
    </div>
  );
});
