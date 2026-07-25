import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronRight, CircleHelp, Clock, CreditCard, Home, Plus, PieChart as PieIcon, Settings as SettingsIcon, ListOrdered, Download, Repeat2, TrendingUp } from "lucide-react";
import { compareTransactionsDesc, dateLabel, formatDateTR, fmtTRY, groupTransactionsByDate, monthLabel, todayLabelTR, type Transaction } from "../budget/data";
import { useBudgetStore } from "../budget/useBudgetStore";
import { useCountUp } from "../budget/useCountUp";
import { AddTransactionSheet } from "../budget/components/AddTransactionSheet";
import { HistorySheet } from "../budget/components/HistorySheet";
import { SettingsSheet } from "../budget/components/SettingsSheet";
import { SwipeableTransactionRow } from "../budget/components/SwipeableTransactionRow";
import { AppBrand } from "../budget/components/AppBrand";
import { SubscriptionCenterSheet } from "../budget/components/SubscriptionCenterSheet";
import { FinancialAccountsPage } from "../budget/components/FinancialAccountsPage";
import { BottomSheet } from "../budget/components/BottomSheet";
import { SankeyV2, type SankeyV2Handle } from "../budget/charts/SankeyV2";
import { PieV2 } from "../budget/charts/PieV2";
import { getSavingsStatus } from "../budget/stats";
import { computeFinancialSummary, movementLabel, reportTypeOf, type FinancialAccount } from "../budget/finance";
import { toast } from "sonner";
import { getErrorMessage } from "../lib/errors";

type Tab = "home" | "list" | "analysis" | "settings";

export default function IndexV2() {
  const {
    transactions: allTransactions, accounts, settings, loaded, addTransaction, deleteTransaction,
    restoreTransaction, updateTransaction, updateRecurringTransactions, deleteTransactions,
    importTransactions, updateSettings, clearAllTransactions, addAccount, updateAccount, archiveAccount,
  } = useBudgetStore();
  const [tab, setTab] = useState<Tab>("home");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [financeView, setFinanceView] = useState<"cards" | "investments" | null>(null);
  const [balanceView, setBalanceView] = useState<"net" | "available">("net");
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);

  // Only current-month data is shown in Home/List/Analysis.
  // Past months remain accessible from the History sheet.
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const transactions = useMemo(
    () => allTransactions
      .filter(t => t.date.startsWith(currentMonthKey))
      .sort(compareTransactionsDesc),
    [allTransactions, currentMonthKey]
  );

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => reportTypeOf(t) === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => reportTypeOf(t) === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpense;
    const usagePct = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
    const savingPct = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
    const expTxs = transactions.filter(t => reportTypeOf(t) === "expense");
    const avgExp = expTxs.length > 0 ? Math.round(totalExpense / expTxs.length) : 0;
    return { totalIncome, totalExpense, balance, usagePct, savingPct, avgExp };
  }, [transactions]);

  const financialSummary = useMemo(
    () => computeFinancialSummary(accounts, allTransactions),
    [accounts, allTransactions],
  );
  const displayedBalance = balanceView === "net"
    ? financialSummary.netWorth
    : financialSummary.availableCash;
  const balanceAnim = useCountUp(displayedBalance);
  const incomeAnim = useCountUp(stats.totalIncome);
  const expenseAnim = useCountUp(stats.totalExpense);

  const handleDeleteTransaction = async (id: number) => {
    try {
      const deleted = await deleteTransaction(id);
      if (!deleted) return;

      toast("İşlem silindi", {
        description: `${deleted.subcategory || deleted.category} · ${fmtTRY(deleted.amount)} ₺`,
        duration: 6000,
        action: {
          label: "Geri al",
          onClick: () => {
            void restoreTransaction(deleted)
              .then(() => toast.success("İşlem geri alındı"))
              .catch(error => toast.error(getErrorMessage(error, "İşlem geri alınamadı")));
          },
        },
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "İşlem silinemedi"));
    }
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
    try {
      const updated = await updateTransaction(transaction);
      if (updated) toast.success("İşlem güncellendi");
    } catch (error) {
      toast.error(getErrorMessage(error, "İşlem güncellenemedi"));
    }
  };

  if (!loaded) {
    return <div className="v2-root min-h-screen flex items-center justify-center v2-text-muted">Yükleniyor…</div>;
  }

  return (
    <div className="v2-root min-h-screen">
      <main
        className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto"
        style={{ paddingBottom: "var(--nav-offset)" }}
      >
        {/* ── Top bar ─────────────────────────────────────── */}
        <header
          className="px-5 pb-2 flex items-center justify-between"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          <AppBrand />
          {!financeView && (
            <div className="flex gap-2">
              <TopBtn aria="Abonelik merkezi" onClick={() => setShowSubscriptions(true)}><Repeat2 size={17} /></TopBtn>
              <TopBtn aria="Geçmiş" onClick={() => setShowHistory(true)}><Clock size={17} /></TopBtn>
            </div>
          )}
        </header>

        {/* ── Balance summary — hidden on settings tab ──── */}
        {tab !== "settings" && !financeView && (
          <section className="px-5 mt-4">
            <div className="px-1 pt-2 pb-3 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceView(current => current === "net" ? "available" : "net")}
                    className="press inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase v2-text-muted"
                    aria-label={`${balanceView === "net" ? "Net bakiye" : "Kullanılabilir bakiye"} gösteriliyor, değiştirmek için dokun`}
                  >
                    {balanceView === "net" ? "Net bakiye" : "Kullanılabilir bakiye"}
                    <ArrowLeftRight size={13} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBalanceInfo(true)}
                    aria-label="Bakiye türlerini açıkla"
                    title="Bu değerler ne anlama geliyor?"
                    className="press w-6 h-6 rounded-full border flex items-center justify-center v2-text-muted"
                    style={{ borderColor: "hsl(var(--v2-border))" }}
                  >
                    <CircleHelp size={14} />
                  </button>
                </div>
                <span className="v2-chip">
                  {todayLabelTR()}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[44px] font-semibold tabular leading-none" style={{ letterSpacing: 0 }}>
                  {fmtTRY(Math.round(balanceAnim))}
                </span>
                <span className="text-[19px] font-semibold v2-text-muted">₺</span>
              </div>
              <div className="mt-1.5 text-[12px] v2-text-muted">
                Bu ay <span className="font-semibold" style={{ color: stats.balance < 0 ? "hsl(var(--v2-neg))" : "hsl(var(--v2-text))" }}>
                  {stats.balance >= 0 ? "+" : ""}{fmtTRY(stats.balance)} ₺
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-0">
                <div className="pr-4">
                  <div className="text-[11px] font-medium v2-text-muted mb-1">Gelir</div>
                  <div className="text-[16px] font-semibold tabular v2-text-pos">{fmtTRY(Math.round(incomeAnim))} <span className="text-[11px] v2-text-muted font-medium">₺</span></div>
                </div>
                <div className="pl-4 border-l" style={{ borderColor: "hsl(var(--v2-hairline))" }}>
                  <div className="text-[11px] font-medium v2-text-muted mb-1">Gider</div>
                  <div className="text-[16px] font-semibold tabular">{fmtTRY(Math.round(expenseAnim))} <span className="text-[11px] v2-text-muted font-medium">₺</span></div>
                </div>
              </div>

              {stats.totalIncome > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-[10.5px] font-semibold v2-text-muted mb-1.5">
                    <span>BÜTÇE KULLANIMI</span>
                    <span className="tabular" style={{ color: "hsl(var(--v2-text))" }}>%{stats.usagePct.toFixed(0)}</span>
                  </div>
                  <div
                    className="h-2.5 rounded-full overflow-hidden p-[2px]"
                    style={{
                      background: "hsl(var(--v2-surface-2))",
                      border: "1px solid hsl(var(--v2-text) / 0.16)",
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(2, Math.min(stats.usagePct, 100))}%`,
                        background: stats.usagePct > 90 ? "hsl(var(--v2-neg))" : "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Page header (İşlem / Analiz / Ayarlar) ─────── */}
        {tab !== "home" && !financeView && (
          <section className="px-5 mt-5">
            <PageHeader
              title={tab === "list" ? "İşlemler" : tab === "analysis" ? "Analiz" : "Ayarlar"}
              subtitle={
                tab === "list"
                  ? "Tüm gelir ve giderlerin tek bir akışta."
                  : tab === "analysis"
                  ? "Para akışını ve kategori dağılımını incele."
                  : "Hesabını, görünümü ve verilerini yönet."
              }
            />
          </section>
        )}

        {/* ── Content ─────────────────────────────────────── */}
        <section className="px-5 mt-4">
          {financeView ? (
            <FinancialAccountsPage
              view={financeView}
              accounts={accounts}
              transactions={allTransactions}
              onBack={() => setFinanceView(null)}
              onChangeView={setFinanceView}
              onAddAccount={addAccount}
              onUpdateAccount={updateAccount}
              onArchiveAccount={archiveAccount}
              onAddTransaction={addTransaction}
            />
          ) : tab === "home" ? (
            <HomeTab
              transactions={transactions}
              accounts={accounts}
              financialSummary={financialSummary}
              stats={stats}
              onSeeAll={() => setTab("list")}
              onOpenFinance={setFinanceView}
            />
          ) : tab === "list" ? (
            <ListTab
              transactions={transactions}
              onDelete={handleDeleteTransaction}
              onEdit={transaction => {
                setShowAdd(false);
                setEditingTransaction(transaction);
              }}
              monthKey={currentMonthKey}
              stats={stats}
            />
          ) : tab === "analysis" ? (
            <AnalysisTab transactions={transactions} />
          ) : (
            <SettingsSheet
              asPage
              dark={settings.dark}
              themeId={settings.themeId}
              onChangeDark={v => updateSettings({ dark: v })}
              onChangeTheme={v => updateSettings({ themeId: v })}
              onResetData={clearAllTransactions}
              onImportData={importTransactions}
            />
          )}
        </section>
      </main>

      {/* ── Floating glass bottom navigation + add (centered, contained) ── */}
      {!financeView && (
        <div
          className="fixed left-0 right-0 z-30 px-4 pointer-events-none"
          style={{ bottom: "var(--safe-bottom)" }}
        >
          <div className="max-w-md md:max-w-lg mx-auto v2-bottom-nav px-3 py-2 flex items-center gap-1 pointer-events-auto">
          <NavItem active={tab === "home"} onClick={() => setTab("home")} icon={<Home size={18} />} label="Ana" />
          <NavItem active={tab === "list"} onClick={() => setTab("list")} icon={<ListOrdered size={18} />} label="İşlem" />
          <button
            onClick={() => { setEditingTransaction(null); setShowAdd(true); }}
            aria-label="Yeni işlem"
            className="press mx-1 w-12 h-12 rounded-full text-primary-foreground flex items-center justify-center shrink-0 self-center"
            style={{
              background: "hsl(var(--primary))",
              boxShadow:
                "0 8px 22px -8px hsl(var(--primary) / 0.45), 0 2px 6px hsl(220 30% 12% / 0.10), inset 0 1px 0 hsl(0 0% 100% / 0.25)",
            }}
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
          <NavItem active={tab === "analysis"} onClick={() => setTab("analysis")} icon={<PieIcon size={18} />} label="Analiz" />
          <NavItem active={tab === "settings"} onClick={() => setTab("settings")} icon={<SettingsIcon size={18} />} label="Ayarlar" />
          </div>
        </div>
      )}

      {/* ── Sheets (bottom drawers) ──────────────────────── */}
      <AddTransactionSheet
        open={showAdd || editingTransaction !== null}
        onClose={() => { setShowAdd(false); setEditingTransaction(null); }}
        transactions={allTransactions}
        onAdd={addTransaction}
        transaction={editingTransaction}
        onUpdate={handleUpdateTransaction}
        accounts={accounts}
        accountBalances={financialSummary.balances}
        onAddAccount={addAccount}
      />
      <HistorySheet open={showHistory} onClose={() => setShowHistory(false)} transactions={allTransactions} />
      <SubscriptionCenterSheet
        open={showSubscriptions}
        onClose={() => setShowSubscriptions(false)}
        transactions={allTransactions}
        onChangeFrequency={updateRecurringTransactions}
        onDelete={deleteTransactions}
      />
      <BottomSheet open={showBalanceInfo} onClose={() => setShowBalanceInfo(false)} title="Bakiye türleri">
        <div className="space-y-4 text-[12.5px] leading-5">
          <div>
            <div className="font-semibold">Net bakiye</div>
            <p className="mt-1 v2-text-muted">
              Kullanılabilir nakit ile yatırımların toplamından kredi kartı borçlarının çıkarılmış halidir.
            </p>
          </div>
          <div className="pt-4 v2-divider">
            <div className="font-semibold">Kullanılabilir bakiye</div>
            <p className="mt-1 v2-text-muted">
              Şu anda nakit hesabında bulunan ve harcayabileceğin paradır. Yatırımdaki para buna dahil değildir.
            </p>
          </div>
        </div>
      </BottomSheet>

    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
      <p className="text-[12.5px] v2-text-muted mt-0.5">{subtitle}</p>
      <div className="mt-3 h-px w-full" style={{ background: "hsl(var(--v2-hairline))" }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function TopBtn({ children, onClick, aria }: { children: React.ReactNode; onClick: () => void; aria: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="press v2-soft w-10 h-10 rounded-2xl flex items-center justify-center"
      style={{ color: "hsl(var(--v2-text))" }}
    >
      {children}
    </button>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="press flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl"
      style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--v2-text-muted))" }}
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

/* ── Home ──────────────────────────────────────────────────────── */

function HomeTab({
  transactions,
  accounts,
  financialSummary,
  stats,
  onSeeAll,
  onOpenFinance,
}: {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  financialSummary: ReturnType<typeof computeFinancialSummary>;
  stats: { avgExp: number; savingPct: number };
  onSeeAll: () => void;
  onOpenFinance: (view: "cards" | "investments") => void;
}) {
  const savingsStatus = getSavingsStatus(stats.savingPct);
  const recent = transactions.slice(0, 6);
  const groups: Record<string, Transaction[]> = {};
  recent.forEach(t => {
    const lbl = dateLabel(t.date);
    if (!groups[lbl]) groups[lbl] = [];
    groups[lbl].push(t);
  });

  // Top expense categories — by total spend
  const topExp = useMemo(() => {
    const m: Record<string, { name: string; icon: string; total: number; count: number }> = {};
    transactions.filter(t => reportTypeOf(t) === "expense").forEach(t => {
      if (!m[t.category]) m[t.category] = { name: t.category, icon: t.icon || "📦", total: 0, count: 0 };
      m[t.category].total += t.amount;
      m[t.category].count += 1;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 4);
  }, [transactions]);
  // Most-active categories — by transaction count (income + expense)
  const topCount = useMemo(() => {
    const m: Record<string, { name: string; icon: string; count: number; total: number }> = {};
    transactions.filter(t => reportTypeOf(t) !== null).forEach(t => {
      if (!m[t.category]) m[t.category] = { name: t.category, icon: t.icon || "📦", count: 0, total: 0 };
      m[t.category].count += 1;
      m[t.category].total += t.amount;
    });
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [transactions]);
  return (
    <div className="space-y-5 animate-fade-in">
      <StatsStrip
        items={[
          { label: "İşlem", value: String(transactions.length) },
          { label: "Ort. gider", value: `${fmtTRY(stats.avgExp)}₺` },
          { label: savingsStatus.label, value: savingsStatus.value, negative: savingsStatus.isOverspent },
        ]}
      />

      <FinancialOverview
        accounts={accounts}
        summary={financialSummary}
        onOpen={onOpenFinance}
      />

      {/* Top categories */}
      <section className="grid items-start gap-4 md:grid-cols-2">
        <CategoryPanel
          title="En çok harcama"
          hint="Toplam tutara göre"
          emptyText="Henüz harcama verisi yok"
          items={topExp.map(c => ({
            name: c.name, icon: c.icon,
            primary: `${fmtTRY(c.total)} ₺`,
            secondary: `${c.count} işlem`,
          }))}
        />
        <CategoryPanel
          title="En çok işlem"
          hint="İşlem adedine göre"
          emptyText="Henüz işlem verisi yok"
          items={topCount.map(c => ({
            name: c.name, icon: c.icon,
            primary: `${c.count} işlem`,
            secondary: `${fmtTRY(c.total)} ₺`,
          }))}
        />
      </section>

      {/* Recent activity */}
      <section>
        <SectionHeader title="Son işlemler" action={transactions.length > 6 ? "Tümü" : ""} onAction={onSeeAll} />
        <div className="v2-card overflow-hidden">
          {recent.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-[13px] font-semibold">Henüz işlem verisi yok</div>
              <p className="mt-1 text-[11.5px] v2-text-muted">İlk gelir veya giderin burada görünecek.</p>
            </div>
          ) : (
            Object.entries(groups).map(([lbl, txs], gi) => (
              <div key={lbl}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider v2-text-muted">{lbl}</div>
                {txs.map((t, i) => <TxRow key={t.id} t={t} divider={!(gi === 0 && i === 0)} />)}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function FinancialOverview({
  accounts,
  summary,
  onOpen,
}: {
  accounts: FinancialAccount[];
  summary: ReturnType<typeof computeFinancialSummary>;
  onOpen: (view: "cards" | "investments") => void;
}) {
  const cards = accounts.filter(account => account.type === "credit_card" && !account.archivedAt);
  const investments = accounts.filter(account => account.type === "investment" && !account.archivedAt);

  return (
    <section>
      <SectionHeader title="Finansal hesaplar" />
      <div className="v2-card overflow-hidden">
        <button type="button" onClick={() => onOpen("cards")}
                className="press w-full px-4 py-3.5 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl v2-soft flex items-center justify-center shrink-0">
              <CreditCard size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">Kredi kartları</div>
              <div className="mt-0.5 text-[10.5px] v2-text-muted">
                {cards.length > 0
                  ? `${cards.length} kart · ${fmtTRY(summary.cardLimit)} ₺ toplam limit`
                  : "Kartlarını ve borç ödemelerini takip et"}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13px] font-semibold tabular">{fmtTRY(summary.cardDebt)} ₺</div>
              <div className="text-[10px] v2-text-muted">%{summary.cardUsagePct.toFixed(0)} kullanım</div>
            </div>
            <ChevronRight size={16} className="v2-text-muted shrink-0" />
          </div>
          {cards.length > 0 && (
            <div className="mt-3 h-1 overflow-hidden" style={{ background: "hsl(var(--v2-surface-2))" }}>
              <div className="h-full"
                   style={{
                     width: `${Math.min(Math.max(summary.cardUsagePct, 0), 100)}%`,
                     background: summary.cardUsagePct > 80 ? "hsl(var(--v2-neg))" : "hsl(var(--primary))",
                   }} />
            </div>
          )}
        </button>
        <button type="button" onClick={() => onOpen("investments")}
                className="press w-full px-4 py-3.5 text-left v2-divider">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl v2-soft flex items-center justify-center shrink-0">
              <TrendingUp size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">Yatırımlar</div>
              <div className="mt-0.5 text-[10.5px] v2-text-muted">
                {investments.length > 0
                  ? `${investments.length} yatırım hesabı`
                  : "Yatırıma ayırdığın tutarı takip et"}
              </div>
            </div>
            <div className="text-[13px] font-semibold tabular shrink-0">{fmtTRY(summary.investmentTotal)} ₺</div>
            <ChevronRight size={16} className="v2-text-muted shrink-0" />
          </div>
        </button>
      </div>
    </section>
  );
}

interface StatStripItem { label: string; value: string; negative?: boolean }

function StatsStrip({ items }: { items: StatStripItem[] }) {
  return (
    <div className="v2-card grid grid-cols-3 overflow-hidden">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`min-w-0 px-3 py-3.5 ${index > 0 ? "border-l" : ""}`}
          style={index > 0 ? { borderColor: "hsl(var(--v2-hairline))" } : undefined}
        >
          <div className="truncate text-[10px] font-semibold uppercase tracking-wider v2-text-muted mb-1">
            {item.label}
          </div>
          <div
            className="truncate text-[14px] sm:text-[15px] font-semibold tabular"
            style={item.negative ? { color: "hsl(var(--v2-neg))" } : undefined}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

interface CategoryItem { name: string; icon: string; primary: string; secondary: string }
function CategoryPanel({ title, hint, items, emptyText }: { title: string; hint: string; items: CategoryItem[]; emptyText: string }) {
  return (
    <div className="v2-card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <span className="text-[10.5px] v2-text-muted">{hint}</span>
      </div>
      <div>
        {items.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-[12.5px] font-semibold">{emptyText}</div>
            <p className="mt-1 text-[11px] v2-text-muted">İşlem ekledikçe bu alan kendiliğinden dolacak.</p>
          </div>
        )}
        {items.map((c, i) => (
          <div
            key={c.name}
            className={`flex items-center gap-3 py-3 ${i > 0 ? "v2-divider" : ""}`}
            style={{
              animation: `slide-up 0.4s var(--ease-out-expo) ${i * 55}ms both`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
              style={{ background: "hsl(var(--v2-surface-2) / 0.72)" }}
            >
              {c.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">{c.name}</div>
              <div className="text-[11px] v2-text-muted truncate">{c.secondary}</div>
            </div>
            <div className="text-[13px] font-semibold tabular shrink-0">{c.primary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-[12px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
          {action} →
        </button>
      )}
    </div>
  );
}

function TxRow({ t, divider }: { t: Transaction; divider?: boolean }) {
  const reportType = reportTypeOf(t);
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${divider ? "v2-divider" : ""}`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: "hsl(var(--v2-surface-2))" }}>
        {t.icon || "📦"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{movementLabel(t)}</div>
        <div className="text-[11px] v2-text-muted truncate">
          {t.subcategory ? `${t.category}` : ""}{t.note ? `${t.subcategory ? " · " : ""}${t.note}` : ""}
        </div>
      </div>
      <div className={`text-[13.5px] font-semibold tabular shrink-0 ${reportType === "income" ? "v2-text-pos" : ""}`}
           style={{ color: reportType === "expense" ? "hsl(var(--v2-text))" : reportType === null ? "hsl(var(--primary))" : undefined }}>
        {reportType === "income" ? "+" : reportType === "expense" ? "−" : "↔"}{fmtTRY(t.amount)} ₺
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="v2-card p-10 text-center animate-fade-in">
      <div className="text-4xl mb-3">📊</div>
      <div className="text-base font-semibold mb-1">Hadi başlayalım</div>
      <div className="text-sm v2-text-muted">İlk işlemini eklemek için + butonuna dokun.</div>
    </div>
  );
}

/* ── List ──────────────────────────────────────────────────────── */

function ListTab({
  transactions,
  onDelete,
  onEdit,
  monthKey,
  stats,
}: {
  transactions: Transaction[];
  onDelete: (id: number) => void | Promise<void>;
  onEdit: (transaction: Transaction) => void;
  monthKey: string;
  stats: { avgExp: number; savingPct: number };
}) {
  const savingsStatus = getSavingsStatus(stats.savingPct);
  const transactionGroups = useMemo(() => groupTransactionsByDate(transactions), [transactions]);

  return (
    <div className="space-y-4 animate-fade-in">
      <StatsStrip
        items={[
          { label: "İşlem", value: String(transactions.length) },
          { label: "Ort. gider", value: `${fmtTRY(stats.avgExp)}₺` },
          { label: savingsStatus.label, value: savingsStatus.value, negative: savingsStatus.isOverspent },
        ]}
      />

      {transactions.length === 0 ? <EmptyState /> : (
        <div className="space-y-5">
          {transactionGroups.map(([date, items]) => (
            <section key={date}>
              <time
                dateTime={date}
                className="block px-1 text-[12px] font-semibold v2-text-muted"
              >
                {formatDateTR(date)}
              </time>
              <div className="mt-2 space-y-2">
                {items.map(transaction => (
                  <SwipeableTransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="px-1 pt-1 text-center text-[11px] v2-text-muted">
        Yalnızca {monthLabel(monthKey)} dönemine ait işlemler gösteriliyor.
      </p>
    </div>
  );
}

/* ── Analysis ──────────────────────────────────────────────────── */

function AnalysisTab({ transactions }: { transactions: Transaction[] }) {
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

  const sankeyRef = useRef<SankeyV2Handle>(null);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="v2-card-solid p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[13px] font-semibold mb-1">Para akışı</div>
            <div className="text-[12px] v2-text-muted">Gelirin nereye gittiğini gör.</div>
          </div>
          <button
            type="button"
            onClick={() => sankeyRef.current?.download()}
            aria-label="Diyagramı indir"
            className="press w-9 h-9 rounded-xl v2-soft flex items-center justify-center shrink-0"
            style={{ color: "hsl(var(--v2-text))" }}
          >
            <Download size={15} />
          </button>
        </div>
        <SankeyV2 ref={sankeyRef} transactions={transactions.filter(t => reportTypeOf(t) !== null)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="v2-card-solid p-5">
          <div className="text-[13px] font-semibold mb-3">Gider dağılımı</div>
          {expGrps.length === 0 ? <div className="text-center text-sm v2-text-muted py-8">Veri yok</div> : <PieV2 groups={expGrps} totalLabel="Toplam gider" />}
        </div>

        <div className="v2-card-solid p-5">
          <div className="text-[13px] font-semibold mb-3">Gelir dağılımı</div>
          {incGrps.length === 0 ? <div className="text-center text-sm v2-text-muted py-8">Veri yok</div> : <PieV2 groups={incGrps} totalLabel="Toplam gelir" />}
        </div>
      </div>
    </div>
  );
}
