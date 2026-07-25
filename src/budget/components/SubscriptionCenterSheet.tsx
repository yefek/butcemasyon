import { useMemo, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type RecurringFreq, type Transaction, fmtTRY, formatDateTR } from "../data";
import { groupRecurringTransactions, recurringFrequencyLabel } from "../recurring";
import { getErrorMessage } from "@/lib/errors";
import { BottomSheet } from "./BottomSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onChangeFrequency: (ids: number[], frequency: RecurringFreq) => Promise<void>;
  onDelete: (ids: number[]) => Promise<void>;
}

export function SubscriptionCenterSheet({
  open, onClose, transactions, onChangeFrequency, onDelete,
}: Props) {
  const series = useMemo(() => groupRecurringTransactions(transactions), [transactions]);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  return (
    <BottomSheet open={open} onClose={onClose} title="Abonelik merkezi">
      <p className="-mt-1 mb-5 text-[12.5px] leading-5 v2-text-muted">
        Düzenli gelir ve giderlerin tekrar zamanını buradan yönetebilirsin.
      </p>

      {series.length === 0 ? (
        <div className="v2-card px-5 py-10 text-center">
          <CalendarClock size={25} className="mx-auto mb-3 v2-text-muted" />
          <div className="text-[14px] font-semibold">Henüz tekrarlayan işlem yok</div>
          <p className="mt-1 text-[12px] v2-text-muted">Yeni işlem eklerken tekrar seçtiğinde burada görünür.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {series.map(item => {
            const transaction = item.transaction;
            const name = transaction.subcategory || transaction.note || transaction.category;
            const deleting = deletingKey === item.key;
            const busy = busyKey === item.key;
            return (
              <article key={item.key} className="v2-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                       style={{ background: "hsl(var(--v2-surface-2))" }}>
                    {transaction.icon || "↻"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="truncate text-[14px] font-semibold">{name}</h3>
                      <span className={`shrink-0 text-[13px] font-semibold tabular ${transaction.type === "income" ? "v2-text-pos" : ""}`}>
                        {transaction.type === "income" ? "+" : "−"}{fmtTRY(transaction.amount)} ₺
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] v2-text-muted">
                      {recurringFrequencyLabel(item.frequency)} · Sonraki {formatDateTR(item.nextDate)}
                    </div>
                  </div>
                </div>

                {deleting ? (
                  <div className="mt-4 pt-3 v2-divider">
                    <p className="text-[12px] leading-5">Bu tekrarlayan işlemin tüm kayıtları silinsin mi?</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setDeletingKey(null)} disabled={busy}
                              className="press flex-1 h-10 rounded-xl v2-soft text-[12px] font-semibold">
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusyKey(item.key);
                          try {
                            await onDelete(item.ids);
                            setDeletingKey(null);
                            toast.success("Tekrarlayan işlem silindi");
                          } catch (error) {
                            toast.error(getErrorMessage(error, "İşlem silinemedi"));
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className="press flex-1 h-10 rounded-xl text-[12px] font-semibold text-white disabled:opacity-60"
                        style={{ background: "hsl(var(--v2-neg))" }}
                      >
                        {busy ? "Siliniyor..." : "Tümünü sil"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 pt-3 v2-divider flex items-center gap-2">
                    <div className="v2-seg flex-1" role="group" aria-label={`${name} tekrar aralığı`}>
                      {(["weekly", "monthly"] as const).map(frequency => (
                        <button
                          type="button"
                          key={frequency}
                          data-active={item.frequency === frequency}
                          disabled={busy}
                          onClick={async () => {
                            if (frequency === item.frequency) return;
                            setBusyKey(item.key);
                            try {
                              await onChangeFrequency(item.ids, frequency);
                              toast.success("Tekrar aralığı güncellendi");
                            } catch (error) {
                              toast.error(getErrorMessage(error, "Tekrar aralığı güncellenemedi"));
                            } finally {
                              setBusyKey(null);
                            }
                          }}
                        >
                          {frequency === "weekly" ? "Haftalık" : "Aylık"}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setDeletingKey(item.key)} disabled={busy}
                            className="press w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ color: "hsl(var(--v2-neg))", background: "hsl(var(--v2-neg) / 0.08)" }}
                            aria-label={`${name} tekrarlayan işlemini sil`} title="Sil">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
