import { useMemo, useRef, useState } from "react";
import { ChevronLeft, Download } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { compareTransactionsDesc, formatDateTR, fmtTRY, monthLabel, MONTH_TR, type Transaction } from "../data";
import { SankeyV2, type SankeyV2Handle } from "../charts/SankeyV2";
import { PieV2 } from "../charts/PieV2";
import { movementLabel, reportTypeOf } from "../finance";

interface Props { open: boolean; onClose: () => void; transactions: Transaction[] }

type View =
  | { kind: "month"; k: string; mode: "month" | "week" | "analysis" }
  | { kind: "week"; k: string; weekKey: string };

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Build weeks of a month: each week = Mon..Sun, clipped to month bounds
function getMonthWeeks(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const weeks: { key: string; start: Date; end: Date; index: number }[] = [];
  // Find the Monday of the week containing first
  const dow = (first.getDay() + 6) % 7; // 0=Mon
  const cursor = new Date(first); cursor.setDate(first.getDate() - dow);
  let i = 1;
  while (cursor <= last) {
    const wEnd = new Date(cursor); wEnd.setDate(cursor.getDate() + 6);
    const start = cursor < first ? first : new Date(cursor);
    const end = wEnd > last ? last : wEnd;
    weeks.push({ key: `${monthKey}-w${i}`, start, end, index: i });
    cursor.setDate(cursor.getDate() + 7);
    i++;
  }
  return weeks;
}

export function HistorySheet({ open, onClose, transactions }: Props) {
  const [view, setView] = useState<View | null>(null);

  const byMonth = useMemo(() => {
    const m: Record<string, { k: string; income: number; expense: number; count: number }> = {};
    transactions.forEach(t => {
      const k = t.date.slice(0, 7);
      if (!m[k]) m[k] = { k, income: 0, expense: 0, count: 0 };
      const reportType = reportTypeOf(t);
      if (reportType) m[k][reportType] += t.amount;
      m[k].count += 1;
    });
    return Object.values(m).sort((a, b) => b.k.localeCompare(a.k));
  }, [transactions]);

  const close = () => { setView(null); onClose(); };

  const monthData = view ? byMonth.find(m => m.k === view.k) : null;
  const monthTxs = useMemo(
    () => view
      ? transactions.filter(t => t.date.startsWith(view.k)).sort(compareTransactionsDesc)
      : [],
    [transactions, view],
  );

  // weekly breakdown
  const weeks = useMemo(
    () => view?.kind === "month" && view.mode === "week" ? getMonthWeeks(view.k) : [],
    [view],
  );
  const weekStats = useMemo(() => {
    return weeks.map(w => {
      const sIso = isoDate(w.start), eIso = isoDate(w.end);
      let income = 0, expense = 0, count = 0;
      monthTxs.forEach(t => {
        if (t.date >= sIso && t.date <= eIso) {
          const reportType = reportTypeOf(t);
          if (reportType === "income") income += t.amount;
          else if (reportType === "expense") expense += t.amount;
          count++;
        }
      });
      return { ...w, income, expense, count };
    });
  }, [weeks, monthTxs]);

  const weekDetail = view?.kind === "week"
    ? (() => {
        const w = getMonthWeeks(view.k).find(x => x.key === view.weekKey);
        if (!w) return null;
        const sIso = isoDate(w.start), eIso = isoDate(w.end);
        const txs = transactions
          .filter(t => t.date >= sIso && t.date <= eIso)
          .sort(compareTransactionsDesc);
        const income = txs.filter(t => reportTypeOf(t) === "income").reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => reportTypeOf(t) === "expense").reduce((s, t) => s + t.amount, 0);
        return { w, txs, income, expense };
      })()
    : null;

  const title = (() => {
    if (!view) return "Geçmiş";
    if (view.kind === "month") return monthLabel(view.k);
    if (weekDetail) {
      const { w } = weekDetail;
      const sameMonth = w.start.getMonth() === w.end.getMonth();
      const fmt = (d: Date) => sameMonth
        ? `${d.getDate()}`
        : `${d.getDate()} ${MONTH_TR[d.getMonth()].slice(0, 3)}`;
      return `${fmt(w.start)} – ${w.end.getDate()} ${MONTH_TR[w.end.getMonth()].slice(0, 3)}`;
    }
    return "Hafta";
  })();

  return (
    <BottomSheet open={open} onClose={close} title={title}>
      {view && (
        <button
          onClick={() => {
            if (view.kind === "week") setView({ kind: "month", k: view.k, mode: "week" });
            else setView(null);
          }}
          className="press flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 -mt-1"
        >
          <ChevronLeft size={16} /> {view.kind === "week" ? "Haftalar" : "Tüm aylar"}
        </button>
      )}

      {/* Months list */}
      {!view && (
        <div>
          <p className="-mt-1 mb-5 text-[12.5px] leading-5 v2-text-muted">
            Önceki ayların gelir, gider ve analizlerini buradan inceleyebilirsin.
          </p>
          <div className="space-y-2.5">
          {byMonth.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">Henüz kayıt yok</div>
          )}
          {byMonth.map((m, i) => {
            const bal = m.income - m.expense;
            const usePct = m.income > 0 ? Math.min((m.expense / m.income) * 100, 100) : 0;
            return (
              <button
                key={m.k}
                onClick={() => setView({ kind: "month", k: m.k, mode: "month" })}
                className="press lift w-full text-left p-4 rounded-2xl bg-card border border-border hover:border-foreground/20 animate-slide-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-display text-base font-semibold">{monthLabel(m.k)}</div>
                    <div className="text-[11px] text-muted-foreground">{m.count} işlem</div>
                  </div>
                  <div className={`text-base font-bold tabular ${bal >= 0 ? "text-income" : "text-expense"}`}>
                    {bal >= 0 ? "+" : ""}{fmtTRY(bal)} ₺
                  </div>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${usePct}%`,
                      background: usePct > 90 ? "hsl(var(--expense))" : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="text-income tabular">↑ {fmtTRY(m.income)}</span>
                  <span className="text-expense tabular">↓ {fmtTRY(m.expense)}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* Inside a month */}
      {view?.kind === "month" && monthData && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Stat label="Gelir" value={fmtTRY(monthData.income)} tone="income" />
            <Stat label="Gider" value={fmtTRY(monthData.expense)} tone="expense" />
            <Stat label="Kalan" value={fmtTRY(monthData.income - monthData.expense)} tone={monthData.income - monthData.expense >= 0 ? "income" : "expense"} />
          </div>

          {/* mode toggle — animated thumb (3 segments) */}
          <div className="seg-toggle history-tabs relative grid grid-cols-3 p-1 rounded-2xl mb-4 h-11">
            <span
              className="seg-thumb"
              style={{
                left: "4px",
                width: "calc(33.3333% - 4px)",
                transform:
                  view.mode === "month" ? "translateX(0)" :
                  view.mode === "week" ? "translateX(100%)" :
                  "translateX(200%)",
              }}
            />
            {(["month", "week", "analysis"] as const).map(mode => {
              const active = view.mode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setView({ ...view, mode })}
                  className="press h-full rounded-xl text-[12.5px] font-semibold"
                  style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                >
                  {mode === "month" ? "Genel" : mode === "week" ? "Haftalık" : "Analiz"}
                </button>
              );
            })}
          </div>


          {view.mode === "month" && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">İşlemler</div>
              <div className="space-y-1.5">
                {monthTxs.map(t => <TxRow key={t.id} t={t} />)}
              </div>
            </>
          )}

          {view.mode === "week" && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Haftalar</div>
              <div className="space-y-2">
                {weekStats.map((w, idx) => {
                  const bal = w.income - w.expense;
                  return (
                    <button
                      key={w.key}
                      onClick={() => setView({ kind: "week", k: view.k, weekKey: w.key })}
                      className="press lift w-full text-left p-3.5 rounded-2xl bg-card border border-border hover:border-foreground/20 animate-slide-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <div className="text-[13px] font-semibold">Hafta {w.index}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {w.start.getDate()} – {w.end.getDate()} {MONTH_TR[w.end.getMonth()].slice(0, 3)} · {w.count} işlem
                          </div>
                        </div>
                        <div className={`text-[14px] font-bold tabular ${bal >= 0 ? "text-income" : "text-expense"}`}>
                          {bal >= 0 ? "+" : ""}{fmtTRY(bal)} ₺
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-income tabular">↑ {fmtTRY(w.income)}</span>
                        <span className="text-expense tabular">↓ {fmtTRY(w.expense)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view.mode === "analysis" && (
            <AnalysisBlock transactions={monthTxs} />
          )}
        </div>
      )}

      {/* Inside a week */}
      {view?.kind === "week" && weekDetail && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Stat label="Gelir" value={fmtTRY(weekDetail.income)} tone="income" />
            <Stat label="Gider" value={fmtTRY(weekDetail.expense)} tone="expense" />
            <Stat label="Kalan" value={fmtTRY(weekDetail.income - weekDetail.expense)} tone={weekDetail.income - weekDetail.expense >= 0 ? "income" : "expense"} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">İşlemler</div>
          <div className="space-y-1.5">
            {weekDetail.txs.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">Bu haftada işlem yok</div>
            )}
            {weekDetail.txs.map(t => <TxRow key={t.id} t={t} />)}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function TxRow({ t }: { t: Transaction }) {
  const reportType = reportTypeOf(t);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${t.type === "income" ? "bg-income/10" : "bg-expense/10"}`}>
        {t.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate">{movementLabel(t)}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1 min-w-0">
          {t.subcategory && <span className="truncate min-w-0">{t.category}</span>}
          {t.subcategory && <span className="shrink-0" aria-hidden>·</span>}
          <time className="shrink-0" dateTime={t.date}>{formatDateTR(t.date)}</time>
        </div>
      </div>
      <div className={`text-[13px] font-bold tabular ${reportType === "income" ? "text-income" : reportType === "expense" ? "text-expense" : ""}`}
           style={reportType === null ? { color: "hsl(var(--primary))" } : undefined}>
        {reportType === "income" ? "+" : reportType === "expense" ? "-" : "↔"}{fmtTRY(t.amount)} ₺
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" }) {
  return (
    <div className={`p-3 rounded-xl ${tone === "income" ? "bg-income/10" : "bg-expense/10"}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm font-bold tabular ${tone === "income" ? "text-income" : "text-expense"}`}>{value} ₺</div>
    </div>
  );
}

function AnalysisBlock({ transactions }: { transactions: Transaction[] }) {
  const sankeyRef = useRef<SankeyV2Handle>(null);

  const incGrps = useMemo(() => {
    return Object.values(transactions.filter(t => reportTypeOf(t) === "income").reduce<Record<string, { name: string; icon: string; total: number }>>((a, t) => {
      if (!a[t.category]) a[t.category] = { name: t.category, icon: t.icon || "💰", total: 0 };
      a[t.category].total += t.amount;
      return a;
    }, {})).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const expGrps = useMemo(() => {
    return Object.values(transactions.filter(t => reportTypeOf(t) === "expense").reduce<Record<string, { name: string; icon: string; total: number; subs: Record<string, number> }>>((a, t) => {
      if (!a[t.category]) a[t.category] = { name: t.category, icon: t.icon || "📦", total: 0, subs: {} };
      a[t.category].total += t.amount;
      if (t.subcategory) a[t.category].subs[t.subcategory] = (a[t.category].subs[t.subcategory] || 0) + t.amount;
      return a;
    }, {})).sort((a, b) => b.total - a.total);
  }, [transactions]);

  if (transactions.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8">Bu ayda işlem yok</div>;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[13px] font-semibold mb-0.5">Para akışı</div>
            <div className="text-[11.5px] text-muted-foreground">Gelirin nereye gittiğini gör.</div>
          </div>
          <button
            type="button"
            onClick={() => sankeyRef.current?.download()}
            aria-label="Diyagramı indir"
            className="press w-9 h-9 rounded-xl bg-secondary/60 hover:bg-secondary flex items-center justify-center shrink-0"
          >
            <Download size={15} />
          </button>
        </div>
        <SankeyV2 ref={sankeyRef} transactions={transactions.filter(t => reportTypeOf(t) !== null)} />
      </div>

      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="text-[13px] font-semibold mb-3">Gider dağılımı</div>
        {expGrps.length === 0
          ? <div className="text-center text-sm text-muted-foreground py-6">Veri yok</div>
          : <PieV2 groups={expGrps} totalLabel="Toplam gider" />}
      </div>

      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="text-[13px] font-semibold mb-3">Gelir dağılımı</div>
        {incGrps.length === 0
          ? <div className="text-center text-sm text-muted-foreground py-6">Veri yok</div>
          : <PieV2 groups={incGrps} totalLabel="Toplam gelir" />}
      </div>
    </div>
  );
}
