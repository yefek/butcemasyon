import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { fmtTRY, type Transaction } from "../data";
import { movementLabel, reportTypeOf } from "../finance";
import { getSwipeOutcome } from "../swipe";

const ACTION_WIDTH = 84;
const MAX_DRAG = 144;

interface Props {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void | Promise<void>;
}

type DragStart = {
  x: number;
  y: number;
  offset: number;
  horizontal: boolean;
};

export function SwipeableTransactionRow({ transaction, onEdit, onDelete }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const dragStartRef = useRef<DragStart | null>(null);
  const actionTimerRef = useRef<number | null>(null);
  const details = [transaction.subcategory ? transaction.category : "", transaction.note]
    .filter(Boolean)
    .join(" · ");
  const reportType = reportTypeOf(transaction);

  const moveTo = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  useEffect(() => () => {
    if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offset: offsetRef.current,
      horizontal: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        dragStartRef.current = null;
        return;
      }
      start.horizontal = true;
      setDragging(true);
    }

    event.preventDefault();
    moveTo(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, start.offset + deltaX)));
  };

  const completeSwipe = () => {
    const outcome = getSwipeOutcome(offsetRef.current);
    dragStartRef.current = null;
    setDragging(false);

    if (outcome === "edit") {
      moveTo(ACTION_WIDTH);
      actionTimerRef.current = window.setTimeout(() => {
        moveTo(0);
        onEdit(transaction);
      }, 90);
      return;
    }

    if (outcome === "delete") {
      moveTo(-MAX_DRAG);
      actionTimerRef.current = window.setTimeout(() => {
        void onDelete(transaction.id);
        moveTo(0);
      }, 130);
      return;
    }

    moveTo(outcome === "reveal-edit" ? ACTION_WIDTH : outcome === "reveal-delete" ? -ACTION_WIDTH : 0);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    completeSwipe();
  };

  const handlePointerCancel = () => {
    dragStartRef.current = null;
    setDragging(false);
    moveTo(0);
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      data-transaction-id={transaction.id}
      data-swipe-offset={offset}
      style={{
        background: "hsl(var(--v2-surface-2))",
        border: "1px solid hsl(var(--v2-border-glass) / var(--v2-border-glass-alpha))",
        boxShadow: "var(--v2-shadow-sm)",
      }}
    >
      <div
        className="absolute inset-0 flex items-stretch justify-between"
        aria-hidden={false}
        style={{
          opacity: offset === 0 ? 0 : 1,
          transition: dragging ? "none" : "opacity 100ms ease-out",
        }}
      >
        <button
          type="button"
          aria-label={`${transaction.subcategory || transaction.category} işlemini düzenle`}
          className="w-[84px] flex flex-col items-center justify-center gap-1 text-white"
          style={{ background: "hsl(var(--primary))" }}
          onClick={() => { moveTo(0); onEdit(transaction); }}
          onFocus={() => moveTo(ACTION_WIDTH)}
        >
          <Pencil size={17} strokeWidth={2.2} />
          <span className="text-[10px] font-semibold">Düzenle</span>
        </button>
        <button
          type="button"
          aria-label={`${transaction.subcategory || transaction.category} işlemini sil`}
          className="w-[84px] flex flex-col items-center justify-center gap-1 text-white"
          style={{ background: "hsl(var(--v2-neg))" }}
          onClick={() => { moveTo(0); void onDelete(transaction.id); }}
          onFocus={() => moveTo(-ACTION_WIDTH)}
        >
          <Trash2 size={17} strokeWidth={2.2} />
          <span className="text-[10px] font-semibold">Sil</span>
        </button>
      </div>

      <div
        className="relative min-h-[66px] flex items-center gap-3 px-4 py-3"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDragStart={event => event.preventDefault()}
        style={{
          background: "hsl(var(--v2-glass) / 0.94)",
          backdropFilter: "blur(var(--v2-blur)) saturate(150%)",
          WebkitBackdropFilter: "blur(var(--v2-blur)) saturate(150%)",
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging ? "none" : "transform 220ms var(--ease-out-expo)",
          touchAction: "pan-y",
          userSelect: dragging ? "none" : "auto",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ background: "hsl(var(--v2-surface-2))" }}
        >
          {transaction.icon || "📦"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold truncate">{movementLabel(transaction)}</div>
          {details && <div className="text-[11px] v2-text-muted truncate">{details}</div>}
        </div>
        <div
          className={`text-[13.5px] font-semibold tabular shrink-0 ${reportType === "income" ? "v2-text-pos" : ""}`}
          style={reportType === null ? { color: "hsl(var(--primary))" } : undefined}
        >
          {reportType === "income" ? "+" : reportType === "expense" ? "−" : "↔"}{fmtTRY(transaction.amount)} ₺
        </div>
      </div>
    </div>
  );
}
