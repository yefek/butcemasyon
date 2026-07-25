import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ChevronRight, CreditCard, Landmark, Pencil, Plus,
  TrendingUp, WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { compareTransactionsDesc, formatDateTR, fmtTRY, type Transaction } from "../data";
import {
  INVESTMENT_TYPE_LABELS,
  cardDueDate,
  computeFinancialSummary,
  monthlyDayLabel,
  movementTypeOf,
  nextMonthlyDate,
  toISODate,
  type FinancialAccount,
  type InvestmentType,
} from "../finance";
import { getErrorMessage } from "@/lib/errors";

type View = "cards" | "investments";

interface Props {
  view: View;
  accounts: FinancialAccount[];
  transactions: Transaction[];
  onBack: () => void;
  onChangeView: (view: View) => void;
  onAddAccount: (account: Omit<FinancialAccount, "id" | "clientId">) => Promise<FinancialAccount>;
  onUpdateAccount: (account: FinancialAccount) => Promise<void>;
  onArchiveAccount: (accountId: string) => Promise<void>;
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
}

const todayISO = () => new Date().toISOString().split("T")[0];

export function FinancialAccountsPage({
  view,
  accounts,
  transactions,
  onBack,
  onChangeView,
  onAddAccount,
  onUpdateAccount,
  onArchiveAccount,
  onAddTransaction,
}: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardEditor, setCardEditor] = useState<FinancialAccount | "new" | null>(null);
  const [paymentCard, setPaymentCard] = useState<FinancialAccount | null>(null);
  const [investmentEditor, setInvestmentEditor] = useState<FinancialAccount | "new" | null>(null);
  const [investmentMovement, setInvestmentMovement] = useState<{
    account: FinancialAccount;
    mode: "add" | "withdraw";
  } | null>(null);

  const activeAccounts = accounts.filter(account => !account.archivedAt);
  const cards = activeAccounts.filter(account => account.type === "credit_card");
  const investments = activeAccounts.filter(account => account.type === "investment");
  const cashAccount = activeAccounts.find(account => account.type === "cash" && account.isDefault)
    ?? activeAccounts.find(account => account.type === "cash");
  const summary = useMemo(
    () => computeFinancialSummary(activeAccounts, transactions),
    [activeAccounts, transactions],
  );
  const selectedCard = cards.find(card => card.id === selectedCardId) ?? null;

  return (
    <>
      <div className="w-full max-w-none space-y-5 animate-fade-in">
        <button
          type="button"
          onClick={() => {
            if (selectedCard) setSelectedCardId(null);
            else onBack();
          }}
          className="press inline-flex items-center gap-1 text-[12.5px] font-semibold v2-text-muted"
        >
          <ArrowLeft size={16} />
          {selectedCard ? "Kredi kartları" : "Ana sayfa"}
        </button>

        <div>
          <h1 className="text-[22px] font-semibold">
            {selectedCard ? selectedCard.name : view === "cards" ? "Kredi kartları" : "Yatırımlar"}
          </h1>
          <p className="mt-1 text-[12.5px] leading-5 v2-text-muted">
            {selectedCard
              ? "Kart borcunu, limitini ve bu kartla yapılan harcamaları yönet."
              : view === "cards"
                ? "Kart harcamaları giderdir; borç ödemeleri ikinci kez gider sayılmaz."
                : "Burada piyasa değeri değil, yatırımlara ayırdığın toplam para takip edilir."}
          </p>
        </div>

        {!selectedCard && (
          <div className="v2-seg" role="tablist" aria-label="Finansal hesaplar">
            <button type="button" data-active={view === "cards"} onClick={() => onChangeView("cards")}>
              Kredi kartları
            </button>
            <button type="button" data-active={view === "investments"} onClick={() => onChangeView("investments")}>
              Yatırımlar
            </button>
          </div>
        )}

        {selectedCard ? (
          <CardDetail
            card={selectedCard}
            balance={Math.max(0, summary.balances[selectedCard.id] ?? 0)}
            transactions={transactions}
            onEdit={() => setCardEditor(selectedCard)}
            onPay={() => setPaymentCard(selectedCard)}
          />
        ) : view === "cards" ? (
          <CardsView
            cards={cards}
            summary={summary}
            onAdd={() => setCardEditor("new")}
            onOpen={card => setSelectedCardId(card.id)}
          />
        ) : (
          <InvestmentsView
            investments={investments}
            balances={summary.balances}
            total={summary.investmentTotal}
            onAdd={() => setInvestmentEditor("new")}
            onEdit={account => setInvestmentEditor(account)}
            onMovement={(account, mode) => setInvestmentMovement({ account, mode })}
          />
        )}
      </div>

      <CardEditorSheet
        value={cardEditor}
        onClose={() => setCardEditor(null)}
        onSave={async input => {
          try {
            if (cardEditor === "new") await onAddAccount(input);
            else if (cardEditor) await onUpdateAccount({ ...cardEditor, ...input });
            toast.success(cardEditor === "new" ? "Kredi kartı eklendi" : "Kart bilgileri güncellendi");
            setCardEditor(null);
          } catch (error) {
            toast.error(getErrorMessage(error, "Kart kaydedilemedi"));
          }
        }}
        onArchive={cardEditor !== "new" && cardEditor ? async () => {
          try {
            if (Math.max(0, summary.balances[cardEditor.id] ?? 0) > 0) {
              toast.error("Borcu bulunan kart arşivlenemez");
              return;
            }
            await onArchiveAccount(cardEditor.id);
            setSelectedCardId(null);
            setCardEditor(null);
            toast.success("Kredi kartı arşivlendi");
          } catch (error) {
            toast.error(getErrorMessage(error, "Kart arşivlenemedi"));
          }
        } : undefined}
      />

      <AmountMovementSheet
        open={paymentCard !== null}
        title="Kart borcu öde"
        description={paymentCard ? `${paymentCard.name} borcundan düşülecek.` : ""}
        maxAmount={paymentCard ? Math.max(0, summary.balances[paymentCard.id] ?? 0) : undefined}
        actionLabel="Ödemeyi kaydet"
        onClose={() => setPaymentCard(null)}
        onSubmit={(amount, date) => {
          if (!paymentCard || !cashAccount) return;
          onAddTransaction({
            type: "expense",
            movementType: "card_payment",
            sourceAccountId: cashAccount.id,
            destinationAccountId: paymentCard.id,
            category: "Kredi Kartı",
            subcategory: `${paymentCard.name} ödemesi`,
            icon: "💳",
            amount,
            note: "Kart borcu ödemesi",
            date,
          });
          setPaymentCard(null);
          toast.success("Kart borcu güncellendi");
        }}
      />

      <InvestmentEditorSheet
        value={investmentEditor}
        onClose={() => setInvestmentEditor(null)}
        onSave={async (input, amount, date) => {
          try {
            if (investmentEditor === "new") {
              const account = await onAddAccount(input);
              if (amount > 0 && cashAccount) {
                onAddTransaction({
                  type: "expense",
                  movementType: "investment_contribution",
                  sourceAccountId: cashAccount.id,
                  destinationAccountId: account.id,
                  category: "Yatırım",
                  subcategory: INVESTMENT_TYPE_LABELS[account.investmentType ?? "other"],
                  icon: "📈",
                  amount,
                  note: "Yatırıma ayrılan",
                  date,
                });
              }
            } else if (investmentEditor) {
              await onUpdateAccount({ ...investmentEditor, ...input });
            }
            toast.success(investmentEditor === "new" ? "Yatırım hesabı eklendi" : "Yatırım hesabı güncellendi");
            setInvestmentEditor(null);
          } catch (error) {
            toast.error(getErrorMessage(error, "Yatırım hesabı kaydedilemedi"));
          }
        }}
      />

      <AmountMovementSheet
        open={investmentMovement !== null}
        title={investmentMovement?.mode === "withdraw" ? "Yatırımdan çek" : "Yatırıma para ekle"}
        description={investmentMovement
          ? `${investmentMovement.account.name} için nakit hareketi oluşturulacak.`
          : ""}
        maxAmount={investmentMovement?.mode === "withdraw"
          ? Math.max(0, summary.balances[investmentMovement.account.id] ?? 0)
          : undefined}
        actionLabel={investmentMovement?.mode === "withdraw" ? "Çekimi kaydet" : "Aktarımı kaydet"}
        onClose={() => setInvestmentMovement(null)}
        onSubmit={(amount, date) => {
          if (!investmentMovement || !cashAccount) return;
          const withdrawing = investmentMovement.mode === "withdraw";
          onAddTransaction({
            type: withdrawing ? "income" : "expense",
            movementType: withdrawing ? "investment_withdrawal" : "investment_contribution",
            sourceAccountId: withdrawing ? investmentMovement.account.id : cashAccount.id,
            destinationAccountId: withdrawing ? cashAccount.id : investmentMovement.account.id,
            category: "Yatırım",
            subcategory: investmentMovement.account.name,
            icon: "📈",
            amount,
            note: withdrawing ? "Yatırımdan nakde aktarım" : "Yatırıma ayrılan",
            date,
          });
          setInvestmentMovement(null);
          toast.success(withdrawing ? "Yatırım çekimi kaydedildi" : "Yatırım aktarımı kaydedildi");
        }}
      />
    </>
  );
}

function CardsView({
  cards,
  summary,
  onAdd,
  onOpen,
}: {
  cards: FinancialAccount[];
  summary: ReturnType<typeof computeFinancialSummary>;
  onAdd: () => void;
  onOpen: (card: FinancialAccount) => void;
}) {
  return (
    <>
      <section className="px-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase v2-text-muted">Toplam kart borcu</div>
            <div className="mt-1 text-[29px] font-semibold tabular">{fmtTRY(summary.cardDebt)} ₺</div>
          </div>
          <div className="pb-1 text-right text-[11px] v2-text-muted">
            {summary.cardLimit > 0 ? `${fmtTRY(summary.cardLimit)} ₺ limit` : "Limit girilmedi"}
          </div>
        </div>
        <UsageBar value={summary.cardUsagePct} />
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Kartların</h2>
        <CommandButton icon={<Plus size={15} />} label="Kart ekle" onClick={onAdd} />
      </div>

      {cards.length === 0 ? (
        <EmptyFinancialState
          icon={<CreditCard size={24} />}
          title="Henüz kredi kartı yok"
          text="Kartını ekleyerek harcamaları ve borç ödemelerini doğru biçimde ayırabilirsin."
        />
      ) : (
        <div className="space-y-3">
          {cards.map(card => {
            const debt = Math.max(0, summary.balances[card.id] ?? 0);
            const usage = card.creditLimit ? (debt / card.creditLimit) * 100 : 0;
            return (
              <button key={card.id} type="button" onClick={() => onOpen(card)}
                      className="press v2-card w-full p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl v2-soft flex items-center justify-center shrink-0">
                    <CreditCard size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold truncate">{card.name}</div>
                    <div className="mt-0.5 text-[11px] v2-text-muted">
                      {card.statementDay ? monthlyDayLabel(card.statementDay) : "Ekstre tarihi girilmedi"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[14px] font-semibold tabular">{fmtTRY(debt)} ₺</div>
                    <div className="text-[10.5px] v2-text-muted">%{Math.min(usage, 999).toFixed(0)} kullanım</div>
                  </div>
                  <ChevronRight size={16} className="v2-text-muted shrink-0" />
                </div>
                <UsageBar value={usage} compact />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function CardDetail({
  card,
  balance,
  transactions,
  onEdit,
  onPay,
}: {
  card: FinancialAccount;
  balance: number;
  transactions: Transaction[];
  onEdit: () => void;
  onPay: () => void;
}) {
  const cardMovements = transactions
    .filter(transaction => (
      (transaction.sourceAccountId === card.id && movementTypeOf(transaction) === "expense")
      || (transaction.destinationAccountId === card.id && movementTypeOf(transaction) === "card_payment")
    ))
    .sort(compareTransactionsDesc);
  const usage = card.creditLimit ? (balance / card.creditLimit) * 100 : 0;
  const nextStatement = card.statementDay ? nextMonthlyDate(card.statementDay) : null;
  const nextDue = nextStatement ? cardDueDate(nextStatement) : null;

  return (
    <>
      <section className="px-1">
        <div className="text-[11px] font-semibold uppercase v2-text-muted">Güncel borç</div>
        <div className="mt-1 text-[32px] font-semibold tabular">{fmtTRY(balance)} ₺</div>
        <div className="mt-1 text-[11.5px] v2-text-muted">
          {card.creditLimit
            ? `${fmtTRY(Math.max(0, card.creditLimit - balance))} ₺ kullanılabilir limit`
            : "Kart limiti girilmedi"}
        </div>
        <UsageBar value={usage} />
      </section>

      <div className="grid grid-cols-2 gap-2">
        <CommandButton icon={<WalletCards size={16} />} label="Ödeme yap" onClick={onPay} wide />
        <CommandButton icon={<Pencil size={15} />} label="Kartı düzenle" onClick={onEdit} wide />
      </div>

      <div className="grid grid-cols-2 gap-3 py-3 v2-divider">
        <SmallInfo
          label="Yaklaşan ekstre"
          value={nextStatement ? formatDateTR(toISODate(nextStatement)) : "Belirtilmedi"}
        />
        <SmallInfo
          label="Son ödeme"
          value={nextDue ? formatDateTR(toISODate(nextDue)) : "Ekstreye göre hesaplanır"}
        />
      </div>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold">Kart hareketleri</h2>
        <div className="v2-card overflow-hidden">
          {cardMovements.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] v2-text-muted">Bu karta ait hareket yok.</div>
          ) : cardMovements.map((transaction, index) => {
            const isPayment = movementTypeOf(transaction) === "card_payment";
            return <div key={transaction.id}
                 className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? "v2-divider" : ""}`}>
              <div className="w-9 h-9 rounded-xl v2-soft flex items-center justify-center">
                {isPayment ? <WalletCards size={16} /> : transaction.icon || "💳"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">
                  {isPayment ? "Borç ödemesi" : transaction.subcategory || transaction.category}
                </div>
                <div className="text-[10.5px] v2-text-muted">{formatDateTR(transaction.date)}</div>
              </div>
              <div className={`text-[13px] font-semibold tabular ${isPayment ? "v2-text-pos" : ""}`}>
                {isPayment ? "+" : "−"}{fmtTRY(transaction.amount)} ₺
              </div>
            </div>;
          })}
        </div>
      </section>
    </>
  );
}

function InvestmentsView({
  investments,
  balances,
  total,
  onAdd,
  onEdit,
  onMovement,
}: {
  investments: FinancialAccount[];
  balances: Record<string, number>;
  total: number;
  onAdd: () => void;
  onEdit: (account: FinancialAccount) => void;
  onMovement: (account: FinancialAccount, mode: "add" | "withdraw") => void;
}) {
  return (
    <>
      <section className="px-1">
        <div className="text-[11px] font-semibold uppercase v2-text-muted">Yatırıma ayrılan</div>
        <div className="mt-1 text-[29px] font-semibold tabular">{fmtTRY(total)} ₺</div>
        <p className="mt-1 text-[11.5px] v2-text-muted">Piyasa kazancı veya kaybı bu tutara dahil değildir.</p>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Yatırım hesapların</h2>
        <CommandButton icon={<Plus size={15} />} label="Yatırım ekle" onClick={onAdd} />
      </div>

      {investments.length === 0 ? (
        <EmptyFinancialState
          icon={<TrendingUp size={24} />}
          title="Henüz yatırım hesabı yok"
          text="Hisse, altın, fon veya kripto için ayırdığın tutarı sade biçimde takip edebilirsin."
        />
      ) : (
        <div className="space-y-3">
          {investments.map(account => (
            <article key={account.id} className="v2-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl v2-soft flex items-center justify-center shrink-0">
                  <Landmark size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold truncate">{account.name}</div>
                  <div className="text-[11px] v2-text-muted">
                    {INVESTMENT_TYPE_LABELS[account.investmentType ?? "other"]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-semibold tabular">{fmtTRY(balances[account.id] ?? 0)} ₺</div>
                  <button type="button" onClick={() => onEdit(account)}
                          className="mt-1 text-[10.5px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
                    Düzenle
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-3 v2-divider grid grid-cols-2 gap-2">
                <CommandButton icon={<Plus size={15} />} label="Para ekle" onClick={() => onMovement(account, "add")} wide />
                <CommandButton icon={<ArrowLeft size={15} />} label="Para çek" onClick={() => onMovement(account, "withdraw")} wide />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function CardEditorSheet({
  value,
  onClose,
  onSave,
  onArchive,
}: {
  value: FinancialAccount | "new" | null;
  onClose: () => void;
  onSave: (account: Omit<FinancialAccount, "id" | "clientId">) => Promise<void>;
  onArchive?: () => Promise<void>;
}) {
  const editing = value !== null && value !== "new" ? value : null;
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [openingDebt, setOpeningDebt] = useState("");
  const [statementDate, setStatementDate] = useState("");

  const open = value !== null;
  const syncKey = editing?.id ?? (value === "new" ? "new" : "closed");
  useEffect(() => {
    setName(editing?.name ?? "");
    setLimit(editing?.creditLimit ? String(editing.creditLimit) : "");
    setOpeningDebt(editing?.openingBalance ? String(editing.openingBalance) : "");
    setStatementDate(editing?.statementDay ? toISODate(nextMonthlyDate(editing.statementDay)) : "");
  }, [
    editing?.creditLimit,
    editing?.name,
    editing?.openingBalance,
    editing?.statementDay,
    syncKey,
  ]);

  const parsedStatementDate = statementDate
    ? (() => {
        const [year, month, day] = statementDate.split("-").map(Number);
        return new Date(year, month - 1, day);
      })()
    : null;
  const automaticDueDate = parsedStatementDate ? cardDueDate(parsedStatementDate) : null;
  const canSave = name.trim().length > 0 && Number(limit) > 0 && statementDate !== "";

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? "Kartı düzenle" : "Kredi kartı ekle"}>
      <div className="space-y-4">
        <Field label="Kart adı">
          <input value={name} onChange={event => setName(event.target.value)}
                 placeholder="Örn. Ana kartım" className="finance-input" />
        </Field>
        <Field label="Kart limiti">
          <MoneyInput value={limit} onChange={setLimit} />
        </Field>
        {!editing && (
          <Field label="Mevcut borç" hint="Başlangıç borcu bu ayın gideri sayılmaz.">
            <MoneyInput value={openingDebt} onChange={setOpeningDebt} />
          </Field>
        )}
        <Field
          label="Sonraki ekstre tarihi"
          hint={automaticDueDate ? `Son ödeme: ${formatDateTR(toISODate(automaticDueDate))}` : "Son ödeme 10 gün sonra hesaplanır"}
        >
          <input
            type="date"
            value={statementDate}
            onChange={event => setStatementDate(event.target.value)}
            onClick={event => event.currentTarget.showPicker?.()}
            className="finance-input"
          />
        </Field>
        <button type="button" disabled={!canSave}
                onClick={() => void onSave({
                  type: "credit_card",
                  name: name.trim(),
                  openingBalance: editing?.openingBalance ?? Math.max(0, Number(openingDebt) || 0),
                  creditLimit: Math.max(0, Number(limit) || 0),
                  statementDay: parsedStatementDate?.getDate(),
                  dueDay: automaticDueDate?.getDate(),
                  isDefault: false,
                  archivedAt: editing?.archivedAt,
                })}
                className="press w-full h-12 rounded-xl font-semibold text-[13px] text-primary-foreground disabled:opacity-40"
                style={{ background: "hsl(var(--primary))" }}>
          {editing ? "Değişiklikleri kaydet" : "Kartı ekle"}
        </button>
        {onArchive && (
          <button type="button" onClick={() => void onArchive()}
                  className="press w-full h-10 text-[12px] font-semibold"
                  style={{ color: "hsl(var(--v2-neg))" }}>
            Kartı arşivle
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function InvestmentEditorSheet({
  value,
  onClose,
  onSave,
}: {
  value: FinancialAccount | "new" | null;
  onClose: () => void;
  onSave: (
    account: Omit<FinancialAccount, "id" | "clientId">,
    amount: number,
    date: string,
  ) => Promise<void>;
}) {
  const editing = value !== null && value !== "new" ? value : null;
  const [name, setName] = useState("");
  const [investmentType, setInvestmentType] = useState<InvestmentType>("fund");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const syncKey = editing?.id ?? (value === "new" ? "new" : "closed");

  useEffect(() => {
    setName(editing?.name ?? "");
    setInvestmentType(editing?.investmentType ?? "fund");
    setAmount("");
    setDate(todayISO());
  }, [editing?.investmentType, editing?.name, syncKey]);

  const amountNumber = Number(amount);
  const canSave = editing ? !!name.trim() : amountNumber > 0;

  return (
    <BottomSheet open={value !== null} onClose={onClose} title={editing ? "Yatırımı düzenle" : "Yatırım ekle"}>
      <div className="space-y-4">
        {!editing && (
          <Field label="Kategori">
            <div className="finance-input flex items-center font-semibold">Yatırım</div>
          </Field>
        )}
        <Field label={editing ? "Yatırım türü" : "Alt kategori"}>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(INVESTMENT_TYPE_LABELS) as [InvestmentType, string][]).map(([type, label]) => (
              <button type="button" key={type} onClick={() => setInvestmentType(type)}
                      className={`press h-11 rounded-xl border text-[12px] font-semibold ${
                        investmentType === type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border v2-text-muted"
                      }`}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        {editing ? (
          <Field label="Yatırım adı">
            <input value={name} onChange={event => setName(event.target.value)}
                   placeholder="Örn. Birikim fonum" className="finance-input" />
          </Field>
        ) : (
          <>
            <Field label="Yatırılan tutar">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Tarih">
              <input type="date" value={date} onChange={event => setDate(event.target.value)}
                     onClick={event => event.currentTarget.showPicker?.()}
                     className="finance-input" />
          </Field>
          </>
        )}
        <button type="button" disabled={!canSave}
                onClick={() => void onSave({
                  type: "investment",
                  name: editing ? name.trim() : INVESTMENT_TYPE_LABELS[investmentType],
                  openingBalance: editing?.openingBalance ?? 0,
                  investmentType,
                  isDefault: false,
                  archivedAt: editing?.archivedAt,
                }, editing ? 0 : amountNumber, date)}
                className="press w-full h-12 rounded-xl font-semibold text-[13px] text-primary-foreground disabled:opacity-40"
                style={{ background: "hsl(var(--primary))" }}>
          {editing ? "Değişiklikleri kaydet" : "Yatırımı ekle"}
        </button>
      </div>
    </BottomSheet>
  );
}

function AmountMovementSheet({
  open,
  title,
  description,
  maxAmount,
  actionLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  maxAmount?: number;
  actionLabel: string;
  onClose: () => void;
  onSubmit: (amount: number, date: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const amountNumber = Number(amount);
  const canSubmit = amountNumber > 0 && (maxAmount === undefined || amountNumber <= maxAmount);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDate(todayISO());
  }, [open]);

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <p className="-mt-1 mb-5 text-[12.5px] leading-5 v2-text-muted">{description}</p>
      <div className="space-y-4">
        <Field label="Tutar" hint={maxAmount !== undefined ? `En fazla ${fmtTRY(maxAmount)} ₺` : undefined}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Tarih">
          <input type="date" value={date} onChange={event => setDate(event.target.value)}
                 onClick={event => event.currentTarget.showPicker?.()}
                 className="finance-input" />
        </Field>
        <button type="button" disabled={!canSubmit} onClick={() => onSubmit(amountNumber, date)}
                className="press w-full h-12 rounded-xl font-semibold text-[13px] text-primary-foreground disabled:opacity-40"
                style={{ background: "hsl(var(--primary))" }}>
          {actionLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <span className="text-[10.5px] font-semibold uppercase v2-text-muted">{label}</span>
        {hint && <span className="text-[10px] v2-text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <span className="relative block">
      <input type="number" min="0" step="0.01" value={value}
             onChange={event => onChange(event.target.value)}
             placeholder="0" className="finance-input pr-12 text-[17px] font-semibold tabular" />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold v2-text-muted">₺</span>
    </span>
  );
}

function UsageBar({ value, compact = false }: { value: number; compact?: boolean }) {
  const normalized = Math.max(0, Math.min(value, 100));
  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      {!compact && (
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold v2-text-muted">
          <span>KART KULLANIMI</span>
          <span>%{Math.max(0, value).toFixed(0)}</span>
        </div>
      )}
      <div className={compact ? "h-1" : "h-2"} style={{ background: "hsl(var(--v2-surface-2))" }}>
        <div className="h-full transition-all duration-500"
             style={{
               width: `${normalized}%`,
               background: value > 80 ? "hsl(var(--v2-neg))" : "hsl(var(--primary))",
             }} />
      </div>
    </div>
  );
}

function CommandButton({
  icon,
  label,
  onClick,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
            className={`press inline-flex h-10 items-center justify-center gap-2 rounded-xl v2-soft px-3 text-[12px] font-semibold ${wide ? "w-full" : ""}`}>
      {icon}
      {label}
    </button>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase v2-text-muted">{label}</div>
      <div className="mt-1 text-[12.5px] font-semibold">{value}</div>
    </div>
  );
}

function EmptyFinancialState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="v2-card px-5 py-9 text-center">
      <div className="mx-auto mb-3 v2-text-muted flex justify-center">{icon}</div>
      <div className="text-[14px] font-semibold">{title}</div>
      <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-5 v2-text-muted">{text}</p>
    </div>
  );
}
