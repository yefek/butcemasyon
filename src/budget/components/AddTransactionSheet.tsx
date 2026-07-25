import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { capitalizeFirstLetterTR, type RecurringFreq, type Transaction, type TxType } from "../data";
import {
  INVESTMENT_TYPE_LABELS,
  movementTypeOf,
  reportTypeOf,
  type FinancialAccount,
  type InvestmentType,
} from "../finance";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onAdd: (tx: Omit<Transaction, "id">) => void;
  transaction?: Transaction | null;
  onUpdate?: (tx: Transaction) => void | Promise<void>;
  accounts: FinancialAccount[];
  accountBalances: Record<string, number>;
  onAddAccount: (account: Omit<FinancialAccount, "id" | "clientId">) => Promise<FinancialAccount>;
}

// Larger emoji set, organized
const EMOJI_LIBRARY = [
  "💼", "💰", "💵", "💳", "🏦", "📈", "🎁", "🏆",
  "🏠", "🛏️", "🛋️", "🔑", "⚡", "💧", "🔥", "📡",
  "🛒", "🍔", "🍕", "☕", "🍺", "🍎", "🥗", "🍰",
  "🚌", "🚗", "⛽", "🛵", "✈️", "🚆", "🚕", "🅿️",
  "📱", "💻", "🎮", "🎬", "🎵", "📚", "🎨", "🎭",
  "💊", "🏥", "🦷", "👕", "👟", "💄", "✂️", "🧴",
  "🎓", "📝", "🐶", "🐱", "🌱", "🎉", "🎀", "📦",
];

const todayISO = () => new Date().toISOString().split("T")[0];
const INVESTMENT_OPTIONS = Object.entries(INVESTMENT_TYPE_LABELS) as [InvestmentType, string][];
const SYSTEM_EXPENSE_CATEGORIES = [
  { name: "Yatırım", icon: "📈" },
  { name: "Kredi Kartı Ödemesi", icon: "💳" },
];

export function AddTransactionSheet({
  open,
  onClose,
  transactions,
  onAdd,
  transaction,
  onUpdate,
  accounts,
  accountBalances,
  onAddAccount,
}: Props) {
  const [type, setType] = useState<TxType>("expense");
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [selectedCat, setSelectedCat] = useState<{ name: string; icon: string } | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📦");
  const [showAllEmoji, setShowAllEmoji] = useState(false);
  const [subcategory, setSubcategory] = useState("");
  const [newSub, setNewSub] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [recurring, setRecurring] = useState<RecurringFreq | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [investmentType, setInvestmentType] = useState<InvestmentType | null>(null);
  const [busy, setBusy] = useState(false);
  const activeAccounts = useMemo(
    () => accounts.filter(account => !account.archivedAt),
    [accounts],
  );
  const cashAccount = activeAccounts.find(account => account.type === "cash" && account.isDefault)
    ?? activeAccounts.find(account => account.type === "cash");
  const creditCards = activeAccounts.filter(account => account.type === "credit_card");
  const editingNeutralMovement = transaction ? reportTypeOf(transaction) === null : false;

  useEffect(() => {
    if (!open) return;

    setShowAllEmoji(false);
    setNewCatName("");
    setNewCatIcon("📦");
    setNewSub("");

    if (transaction) {
      setType(transaction.type);
      setMode("pick");
      setSelectedCat({ name: transaction.category, icon: transaction.icon || "📦" });
      setSubcategory(transaction.subcategory);
      setAmount(String(transaction.amount));
      setNote(transaction.note);
      setDate(transaction.date);
      setRecurring(transaction.recurring ?? null);
      setSourceAccountId(transaction.sourceAccountId ?? cashAccount?.id ?? "");
      setDestinationAccountId(transaction.destinationAccountId ?? "");
      const investmentAccount = activeAccounts.find(account => account.id === transaction.destinationAccountId);
      setInvestmentType(investmentAccount?.investmentType ?? null);
      return;
    }

    setType("expense");
    setMode("pick");
    setSelectedCat(null);
    setSubcategory("");
    setAmount("");
    setNote("");
    setDate(todayISO());
    setRecurring(null);
    setSourceAccountId(cashAccount?.id ?? "");
    setDestinationAccountId("");
    setInvestmentType(null);
    setBusy(false);
  }, [activeAccounts, cashAccount?.id, open, transaction]);

  const close = () => onClose();

  const usedCats = useMemo(() => {
    const m: Record<string, { name: string; icon: string }> = {};
    if (type === "expense") {
      SYSTEM_EXPENSE_CATEGORIES.forEach(category => { m[category.name] = category; });
    }
    transactions.filter(t => movementTypeOf(t) === type).forEach(t => {
      if (!m[t.category]) m[t.category] = { name: t.category, icon: t.icon || "📦" };
    });
    return Object.values(m);
  }, [transactions, type]);

  const resolvedCat = mode === "new" ? newCatName.trim() : (selectedCat?.name ?? "");
  const resolvedIcon = mode === "new" ? (newCatIcon.trim() || "📦") : (selectedCat?.icon ?? "📦");
  const resolvedSub = newSub.trim() || subcategory;
  const isInvestment = type === "expense" && resolvedCat === "Yatırım";
  const isCardPayment = type === "expense" && resolvedCat === "Kredi Kartı Ödemesi";
  const isSpecialMovement = isInvestment || isCardPayment;
  const usedSubs = useMemo(
    () => Array.from(new Set(transactions.filter(t => t.category === resolvedCat && t.subcategory).map(t => t.subcategory))),
    [transactions, resolvedCat]
  );

  const amountNum = parseFloat(amount);
  const selectedCardDebt = isCardPayment && destinationAccountId
    ? Math.max(0, accountBalances[destinationAccountId] ?? 0)
    : 0;
  const payableCardDebt = selectedCardDebt + (
    editingNeutralMovement && transaction?.movementType === "card_payment"
      ? transaction.amount
      : 0
  );
  const canSubmit = !!resolvedCat
    && !!amount
    && !isNaN(amountNum)
    && amountNum > 0
    && (!isInvestment || investmentType !== null)
    && (!isCardPayment || (
      destinationAccountId !== ""
      && amountNum <= payableCardDebt
    ));

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      let specialDestinationId = destinationAccountId;

      if (isInvestment && !specialDestinationId && investmentType) {
        const existingAccount = activeAccounts.find(account => (
          account.type === "investment"
          && account.investmentType === investmentType
        ));
        if (existingAccount) {
          specialDestinationId = existingAccount.id;
        } else {
          const createdAccount = await onAddAccount({
            type: "investment",
            name: INVESTMENT_TYPE_LABELS[investmentType],
            investmentType,
            openingBalance: 0,
            isDefault: false,
          });
          specialDestinationId = createdAccount.id;
        }
      }

      const specialSubcategory = isInvestment && investmentType
        ? INVESTMENT_TYPE_LABELS[investmentType]
        : isCardPayment
          ? creditCards.find(card => card.id === specialDestinationId)?.name ?? "Kredi kartı"
          : resolvedSub;
      const values: Omit<Transaction, "id"> = {
        type,
        category: resolvedCat,
        icon: isInvestment ? "📈" : isCardPayment ? "💳" : resolvedIcon,
        subcategory: specialSubcategory,
        amount: amountNum, note: note.trim(), date,
        recurring: isSpecialMovement ? undefined : recurring ?? undefined,
        movementType: editingNeutralMovement
          ? transaction?.movementType
          : isInvestment
            ? "investment_contribution"
            : isCardPayment
              ? "card_payment"
              : type,
        sourceAccountId: editingNeutralMovement
          ? transaction?.sourceAccountId
          : isSpecialMovement
            ? cashAccount?.id
            : type === "expense" ? (sourceAccountId || cashAccount?.id) : undefined,
        destinationAccountId: editingNeutralMovement
          ? transaction?.destinationAccountId
          : isSpecialMovement
            ? specialDestinationId
            : type === "income" ? cashAccount?.id : undefined,
      };

      if (transaction && onUpdate) await onUpdate({ ...transaction, ...values });
      else onAdd(values);
      close();
    } catch (error) {
      toast.error(getErrorMessage(error, "İşlem kaydedilemedi"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={close} title={transaction ? "İşlemi Düzenle" : "Yeni İşlem"}>
      {/* Type selector — segmented */}
      {!editingNeutralMovement && <div className="flex gap-1 p-1 bg-secondary rounded-2xl mb-5">
        {(["expense", "income"] as TxType[]).map(tp => (
          <button
            key={tp}
            onClick={() => { setType(tp); setSelectedCat(null); setMode("pick"); }}
            className={`press flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
              type === tp
                ? tp === "income"
                  ? "bg-income text-income-foreground shadow-sm"
                  : "bg-expense text-expense-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tp === "income" ? "↑ Gelir" : "↓ Gider"}
          </button>
        ))}
      </div>}

      {type === "expense" && !editingNeutralMovement && !isSpecialMovement && (
        <>
          <Label>Ödeme kaynağı</Label>
          <div className={`grid gap-2 mb-5 ${creditCards.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
            {cashAccount && (
              <button
                type="button"
                onClick={() => setSourceAccountId(cashAccount.id)}
                className={`press min-h-11 px-3 rounded-xl border text-[12.5px] font-semibold ${
                  sourceAccountId === cashAccount.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                Nakit
              </button>
            )}
            {creditCards.map(card => (
              <button
                type="button"
                key={card.id}
                onClick={() => setSourceAccountId(card.id)}
                className={`press min-h-11 px-3 rounded-xl border text-[12.5px] font-semibold truncate ${
                  sourceAccountId === card.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {card.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Categories */}
      <Label>Kategori</Label>
      <div className="flex flex-wrap gap-2 mb-4">
        {usedCats.map(c => {
          const active = mode === "pick" && selectedCat?.name === c.name;
          return (
            <button
              key={c.name}
              onClick={() => {
                setMode("pick");
                setSelectedCat(c);
                setSubcategory("");
                setNewSub("");
                setDestinationAccountId("");
                setInvestmentType(null);
              }}
              className={`press flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-semibold ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:border-foreground/30"
              }`}
            >
              <span>{c.icon}</span>{c.name}
            </button>
          );
        })}
        <button
          onClick={() => { setMode("new"); setSelectedCat(null); }}
          className={`press px-3 py-2 rounded-xl border-2 border-dashed text-[13px] font-semibold ${
            mode === "new" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          }`}
        >
          + Yeni
        </button>
      </div>

      {mode === "new" && (
        <div className="p-3 rounded-2xl bg-secondary/60 mb-4 animate-slide-down">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Yeni Kategori</div>
            <button
              onClick={() => setShowAllEmoji(s => !s)}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              {showAllEmoji ? "Daralt" : "Tümünü göster"}
            </button>
          </div>

          {/* Emoji picker — full library, scrollable when expanded */}
          <div
            className={`grid grid-cols-8 gap-1.5 mb-3 ${showAllEmoji ? "max-h-44 overflow-y-auto pr-1" : ""}`}
          >
            {(showAllEmoji ? EMOJI_LIBRARY : EMOJI_LIBRARY.slice(0, 16)).map(ic => (
              <button
                key={ic}
                onClick={() => setNewCatIcon(ic)}
                className={`press aspect-square rounded-lg flex items-center justify-center text-base ${
                  newCatIcon === ic ? "bg-primary/15 ring-2 ring-primary" : "bg-card hover:bg-muted"
                }`}
              >{ic}</button>
            ))}
          </div>

          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Kategori adı"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-medium ring-focus outline-none"
          />
        </div>
      )}

      {isInvestment && (
        <>
          <Label>Yatırım türü</Label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {INVESTMENT_OPTIONS.map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => {
                  setInvestmentType(value);
                  const matchingAccount = activeAccounts.find(account => (
                    account.type === "investment" && account.investmentType === value
                  ));
                  setDestinationAccountId(matchingAccount?.id ?? "");
                }}
                className={`press min-h-11 px-3 rounded-xl border text-[12.5px] font-semibold ${
                  investmentType === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {isCardPayment && (
        <>
          <Label>Kredi kartı</Label>
          {creditCards.length === 0 ? (
            <p className="mb-4 px-1 text-[12px] leading-5 v2-text-muted">
              Önce Finansal hesaplar bölümünden bir kredi kartı eklemelisin.
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {creditCards.map(card => (
                <button
                  type="button"
                  key={card.id}
                  onClick={() => setDestinationAccountId(card.id)}
                  className={`press w-full min-h-12 px-3 rounded-xl border flex items-center justify-between gap-3 text-[12.5px] ${
                    destinationAccountId === card.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span className="font-semibold truncate">{card.name}</span>
                  <span className="tabular shrink-0">{fmtAmount(accountBalances[card.id] ?? 0)} ₺ borç</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Subcategory */}
      {resolvedCat && !isSpecialMovement && (
        <>
          <Label optional>Alt Kategori</Label>
          {usedSubs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {usedSubs.map(sub => (
                <button
                  key={sub}
                  onClick={() => setSubcategory(subcategory === sub ? "" : sub)}
                  className={`press px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                    subcategory === sub
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >{sub}</button>
              ))}
            </div>
          )}
          <input
            value={newSub}
            onChange={e => { setNewSub(e.target.value); if (e.target.value) setSubcategory(""); }}
            placeholder={usedSubs.length ? "veya yeni alt kategori..." : "Alt kategori adı..."}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm mb-4 ring-focus outline-none"
          />
        </>
      )}

      {/* Amount — hero input */}
      <Label>Tutar</Label>
      <div className="relative mb-4">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
          className="w-full px-4 py-4 pr-14 rounded-2xl border-2 border-border bg-card text-2xl font-bold tabular ring-focus outline-none focus:border-primary transition-colors"
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">₺</span>
      </div>

      {/* Date — full width to match other fields */}
      <Label>Tarih</Label>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        onClick={e => e.currentTarget.showPicker?.()}
        className="block w-full box-border px-4 py-3 rounded-xl border border-border bg-card text-sm font-medium mb-4 ring-focus outline-none appearance-none"
      />

      {/* Recurring */}
      {!isSpecialMovement && <>
        <Label optional>Tekrarlayan işlem mi?</Label>
        <div className="grid grid-cols-3 gap-2 mb-4">
        {([
          [null, "Hayır"],
          ["weekly", "Haftalık"],
          ["monthly", "Aylık"],
        ] as [RecurringFreq | null, string][]).map(([v, lbl]) => {
          const active = recurring === v;
          return (
            <button
              key={String(v)}
              onClick={() => setRecurring(v)}
              className={`press py-2.5 rounded-xl border text-[12.5px] font-semibold ${
                active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
              }`}
            >{lbl}</button>
          );
        })}
        </div>
        {recurring && (
        <div className="text-[11px] text-muted-foreground mb-4 -mt-2 px-1">
          {recurring === "weekly" ? "Her hafta" : "Her ay"} aynı gün otomatik olarak eklenecek.
        </div>
        )}
      </>}

      {/* Note */}
      <Label optional>Not</Label>
      <input
        type="text"
        value={note}
        onChange={e => setNote(capitalizeFirstLetterTR(e.target.value))}
        placeholder="Açıklama ekle..."
        className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm mb-6 ring-focus outline-none"
      />

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={close}
          className="press flex-1 py-3.5 rounded-2xl border border-border bg-card text-muted-foreground font-semibold hover:text-foreground"
        >İptal</button>
        <button
          onClick={() => void submit()}
          disabled={!canSubmit || busy}
          className="press flex-[2] py-3.5 rounded-2xl text-primary-foreground font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))" }}
        >{busy ? "Kaydediliyor..." : transaction ? "Kaydet" : "Ekle"}</button>
      </div>
    </BottomSheet>
  );
}

const fmtAmount = (value: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.max(0, value));

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
      {children} {optional && <span className="font-medium normal-case tracking-normal">(opsiyonel)</span>}
    </div>
  );
}
