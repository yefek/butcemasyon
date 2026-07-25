import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compareTransactionsDesc, SEED_TRANSACTIONS, expandRecurring, type RecurringFreq, type ThemeId, type Transaction } from "./data";
import type { FinancialAccount, InvestmentType, MovementType } from "./finance";
import { parseTransactionImport } from "./importTransactions";
import { useAuth } from "./useAuth";

const DATA_KEY = "aurora_budget_v1";
const SETTINGS_KEY = "aurora_settings_v1";
const MIGRATED_KEY = "aurora_migrated_v1";
const FINANCE_KEY = "aurora_finance_v1";

interface Settings { dark: boolean; themeId: ThemeId; }
const defaultSettings: Settings = { dark: true, themeId: "midnight" };

type DbRow = {
  client_id: number; type: "income" | "expense"; category: string;
  subcategory: string | null; amount: number; date: string;
  note: string | null; icon: string | null; recurring: string | null; created_at: string;
  movement_type?: string | null;
  source_account_id?: string | null;
  destination_account_id?: string | null;
};

type DbAccountRow = {
  id: string;
  client_id: number;
  type: "cash" | "investment" | "credit_card";
  name: string;
  opening_balance: number;
  credit_limit: number | null;
  statement_day: number | null;
  due_day: number | null;
  investment_type: string | null;
  is_default: boolean;
  archived_at: string | null;
};

type LocalFinanceState = {
  accounts: FinancialAccount[];
  transactionMeta: Record<string, Pick<Transaction, "movementType" | "sourceAccountId" | "destinationAccountId">>;
};

const rowToTx = (r: DbRow): Transaction => ({
  id: r.client_id,
  type: r.type,
  category: r.category,
  subcategory: r.subcategory ?? "",
  amount: Number(r.amount),
  date: r.date,
  createdAt: r.created_at,
  note: r.note ?? "",
  icon: r.icon ?? "",
  recurring: (r.recurring as Transaction["recurring"]) || undefined,
  movementType: (r.movement_type as MovementType | null) ?? undefined,
  sourceAccountId: r.source_account_id ?? undefined,
  destinationAccountId: r.destination_account_id ?? undefined,
});

const txToRow = (t: Transaction, userId: string, includeFinance = true) => ({
  user_id: userId,
  client_id: t.id,
  type: t.type,
  category: t.category,
  subcategory: t.subcategory || null,
  amount: t.amount,
  date: t.date,
  note: t.note || null,
  icon: t.icon || null,
  recurring: t.recurring || null,
  ...(t.createdAt ? { created_at: t.createdAt } : {}),
  ...(includeFinance ? {
    movement_type: t.movementType ?? t.type,
    source_account_id: t.sourceAccountId ?? null,
    destination_account_id: t.destinationAccountId ?? null,
  } : {}),
});

const rowToAccount = (row: DbAccountRow): FinancialAccount => ({
  id: row.id,
  clientId: row.client_id,
  type: row.type,
  name: row.name,
  openingBalance: Number(row.opening_balance),
  creditLimit: row.credit_limit === null ? undefined : Number(row.credit_limit),
  statementDay: row.statement_day ?? undefined,
  dueDay: row.due_day ?? undefined,
  investmentType: (row.investment_type as InvestmentType | null) ?? undefined,
  isDefault: row.is_default,
  archivedAt: row.archived_at ?? undefined,
});

const accountToRow = (account: FinancialAccount, userId: string) => ({
  id: account.id,
  user_id: userId,
  client_id: account.clientId,
  type: account.type,
  name: account.name,
  opening_balance: account.openingBalance,
  credit_limit: account.creditLimit ?? null,
  statement_day: account.statementDay ?? null,
  due_day: account.dueDay ?? null,
  investment_type: account.investmentType ?? null,
  is_default: account.isDefault ?? false,
  archived_at: account.archivedAt ?? null,
  updated_at: new Date().toISOString(),
});

const createDefaultCashAccount = (): FinancialAccount => ({
  id: crypto.randomUUID(),
  clientId: Date.now(),
  type: "cash",
  name: "Nakit",
  openingBalance: 0,
  isDefault: true,
});

const loadLocalFinance = (scope: string): LocalFinanceState => {
  try {
    const raw = localStorage.getItem(`${FINANCE_KEY}:${scope}`);
    if (raw) return JSON.parse(raw) as LocalFinanceState;
  } catch (error) {
    console.warn("local finance load failed", error);
  }
  return { accounts: [], transactionMeta: {} };
};

export function useBudgetStore() {
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [financialCloudEnabled, setFinancialCloudEnabled] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Load data: cloud if logged in, else local
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoaded(false);
      setLoadedScope(null);
      if (user) {
        userIdRef.current = user.id;
        // One-time migration of local data → cloud
        try {
          const migrated = localStorage.getItem(MIGRATED_KEY + ":" + user.id);
          if (!migrated) {
            const localRaw = localStorage.getItem(DATA_KEY);
            const local: Transaction[] = localRaw ? JSON.parse(localRaw) : [];
            // skip the seed (presence of seed = no real local data)
            const looksLikeSeed =
              local.length === SEED_TRANSACTIONS.length &&
              local[0]?.id === SEED_TRANSACTIONS[0]?.id;
            if (local.length > 0 && !looksLikeSeed) {
              const rows = local.map(t => txToRow(t, user.id));
              await supabase.from("transactions").upsert(rows, { onConflict: "user_id,client_id" });
            }
            localStorage.setItem(MIGRATED_KEY + ":" + user.id, "1");
          }
        } catch (error) {
          console.warn("local data migration failed", error);
        }

        const [txRes, setRes, accountRes] = await Promise.all([
          supabase.from("transactions").select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(2000),
          supabase.from("user_settings").select("*").maybeSingle(),
          supabase.from("accounts")
            .select("id,client_id,type,name,opening_balance,credit_limit,statement_day,due_day,investment_type,is_default,archived_at")
            .order("created_at", { ascending: true }),
        ]);
        if (cancelled) return;
        const localFinance = loadLocalFinance(user.id);
        const cloudFinanceAvailable = !accountRes.error;
        setFinancialCloudEnabled(cloudFinanceAvailable);

        const txs = (txRes.data ?? []).map(row => {
          const transaction = rowToTx(row as unknown as DbRow);
          if (cloudFinanceAvailable) return transaction;
          return {
            ...transaction,
            ...(localFinance.transactionMeta[String(transaction.id)] ?? {}),
          };
        });
        setTransactions(txs.sort(compareTransactionsDesc));
        if (cloudFinanceAvailable) {
          let nextAccounts = (accountRes.data ?? []).map(row => rowToAccount(row as unknown as DbAccountRow));
          if (!nextAccounts.some(account => account.type === "cash" && !account.archivedAt)) {
            const cashAccount = createDefaultCashAccount();
            const { error } = await supabase.from("accounts").insert(accountToRow(cashAccount, user.id));
            if (!error) nextAccounts = [cashAccount, ...nextAccounts];
          }
          setAccounts(nextAccounts);
        } else {
          const nextAccounts = localFinance.accounts.length > 0
            ? localFinance.accounts
            : [createDefaultCashAccount()];
          setAccounts(nextAccounts);
        }
        if (setRes.data) {
          setSettings({ dark: setRes.data.dark, themeId: setRes.data.theme_id as ThemeId });
        } else {
          setSettings(defaultSettings);
        }
      } else {
        userIdRef.current = null;
        setFinancialCloudEnabled(false);
        try {
          const d = localStorage.getItem(DATA_KEY);
          const s = localStorage.getItem(SETTINGS_KEY);
          const parsed = d ? JSON.parse(d) as Transaction[] : SEED_TRANSACTIONS;
          const localFinance = loadLocalFinance("guest");
          setTransactions(parsed.map(transaction => ({
            ...transaction,
            ...(localFinance.transactionMeta[String(transaction.id)] ?? {}),
          })).sort(compareTransactionsDesc));
          setAccounts(localFinance.accounts.length > 0
            ? localFinance.accounts
            : [createDefaultCashAccount()]);
          if (s) setSettings({ ...defaultSettings, ...JSON.parse(s) });
          else setSettings(defaultSettings);
        } catch {
          setTransactions([...SEED_TRANSACTIONS].sort(compareTransactionsDesc));
        }
      }
      setLoadedScope(user?.id ?? "guest");
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Apply theme
  useEffect(() => {
    if (!loaded) return;
    const scope = user?.id ?? "guest";
    if (loadedScope !== scope) return;
    document.documentElement.classList.toggle("dark", settings.dark);
    document.documentElement.setAttribute("data-theme", settings.themeId);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch (error) { console.warn("theme preference save failed", error); }
  }, [loaded, loadedScope, settings, user?.id]);

  useEffect(() => {
    if (!loaded) return;
    const scope = user?.id ?? "guest";
    if (loadedScope !== scope) return;
    const transactionMeta = Object.fromEntries(
      transactions
        .filter(transaction => (
          transaction.movementType
          || transaction.sourceAccountId
          || transaction.destinationAccountId
        ))
        .map(transaction => [String(transaction.id), {
          movementType: transaction.movementType,
          sourceAccountId: transaction.sourceAccountId,
          destinationAccountId: transaction.destinationAccountId,
        }]),
    );
    try {
      localStorage.setItem(`${FINANCE_KEY}:${scope}`, JSON.stringify({
        accounts,
        transactionMeta,
      } satisfies LocalFinanceState));
    } catch (error) {
      console.warn("local finance save failed", error);
    }
  }, [accounts, loaded, loadedScope, transactions, user?.id]);

  const flashSaved = () => {
    setSaveStatus("saving");
    setTimeout(() => setSaveStatus("saved"), 200);
    setTimeout(() => setSaveStatus(null), 1600);
  };

  const addTransaction = useCallback((tx: Omit<Transaction, "id">) => {
    const baseId = Date.now();
    const createdAt = tx.createdAt ?? new Date(baseId).toISOString();
    const items = expandRecurring({ ...tx, createdAt }, baseId);
    const withIds: Transaction[] = items.map((t, i) => ({ ...t, id: baseId + i }));

    setTransactions(prev => {
      const next = [...withIds, ...prev].sort(compareTransactionsDesc);
      if (user) {
        flashSaved();
        const rows = withIds.map(t => txToRow(t, user.id, financialCloudEnabled));
        supabase.from("transactions").insert(rows).then(({ error }) => {
          if (error) console.error("insert tx", error);
        });
      } else {
        try { localStorage.setItem(DATA_KEY, JSON.stringify(next)); flashSaved(); }
        catch (error) { console.warn("local transaction save failed", error); }
      }
      return next;
    });
  }, [financialCloudEnabled, user]);

  const deleteTransaction = useCallback(async (id: number) => {
    const deleted = transactions.find(t => t.id === id);
    if (!deleted) return undefined;

    const next = transactions.filter(t => t.id !== id);
    setTransactions(next);

    try {
      if (user) {
        const { error } = await supabase.from("transactions").delete()
          .eq("user_id", user.id)
          .eq("client_id", id);
        if (error) throw error;
      } else {
        localStorage.setItem(DATA_KEY, JSON.stringify(next));
      }
      flashSaved();
      return deleted;
    } catch (error) {
      setTransactions(current => current.some(t => t.id === id)
        ? current
        : [...current, deleted].sort(compareTransactionsDesc));
      throw error;
    }
  }, [transactions, user]);

  const restoreTransaction = useCallback(async (transaction: Transaction) => {
    setTransactions(current => current.some(t => t.id === transaction.id)
      ? current
      : [...current, transaction].sort(compareTransactionsDesc));

    try {
      if (user) {
        const { error } = await supabase.from("transactions").upsert(
          txToRow(transaction, user.id, financialCloudEnabled),
          { onConflict: "user_id,client_id" },
        );
        if (error) throw error;
      } else {
        const raw = localStorage.getItem(DATA_KEY);
        const stored = raw ? JSON.parse(raw) as Transaction[] : [];
        const next = [transaction, ...stored.filter(t => t.id !== transaction.id)].sort(compareTransactionsDesc);
        localStorage.setItem(DATA_KEY, JSON.stringify(next));
      }
      flashSaved();
    } catch (error) {
      setTransactions(current => current.filter(t => t.id !== transaction.id));
      throw error;
    }
  }, [financialCloudEnabled, user]);

  const updateTransaction = useCallback(async (transaction: Transaction) => {
    const previous = transactions.find(t => t.id === transaction.id);
    if (!previous) return undefined;

    const updated: Transaction = {
      ...previous,
      ...transaction,
      id: previous.id,
      createdAt: previous.createdAt,
    };
    const next = transactions
      .map(t => t.id === updated.id ? updated : t)
      .sort(compareTransactionsDesc);
    setTransactions(next);

    try {
      if (user) {
        const { error } = await supabase.from("transactions").upsert(
          txToRow(updated, user.id, financialCloudEnabled),
          { onConflict: "user_id,client_id" },
        );
        if (error) throw error;
      } else {
        localStorage.setItem(DATA_KEY, JSON.stringify(next));
      }
      flashSaved();
      return updated;
    } catch (error) {
      setTransactions(current => current
        .map(t => t.id === previous.id ? previous : t)
        .sort(compareTransactionsDesc));
      throw error;
    }
  }, [financialCloudEnabled, transactions, user]);

  const updateRecurringTransactions = useCallback(async (ids: number[], recurring: RecurringFreq) => {
    const idSet = new Set(ids);
    const previous = transactions;
    const updated = transactions
      .map(transaction => idSet.has(transaction.id) ? { ...transaction, recurring } : transaction)
      .sort(compareTransactionsDesc);
    setTransactions(updated);

    try {
      if (user) {
        const rows = updated
          .filter(transaction => idSet.has(transaction.id))
          .map(transaction => txToRow(transaction, user.id, financialCloudEnabled));
        const { error } = await supabase.from("transactions").upsert(rows, { onConflict: "user_id,client_id" });
        if (error) throw error;
      } else {
        localStorage.setItem(DATA_KEY, JSON.stringify(updated));
      }
      flashSaved();
    } catch (error) {
      setTransactions(previous);
      throw error;
    }
  }, [financialCloudEnabled, transactions, user]);

  const deleteTransactions = useCallback(async (ids: number[]) => {
    const idSet = new Set(ids);
    const previous = transactions;
    const next = transactions.filter(transaction => !idSet.has(transaction.id));
    setTransactions(next);

    try {
      if (user) {
        const { error } = await supabase.from("transactions").delete()
          .eq("user_id", user.id)
          .in("client_id", ids);
        if (error) throw error;
      } else {
        localStorage.setItem(DATA_KEY, JSON.stringify(next));
      }
      flashSaved();
    } catch (error) {
      setTransactions(previous);
      throw error;
    }
  }, [transactions, user]);

  const importTransactions = useCallback(async (raw: unknown) => {
    const result = parseTransactionImport(raw);
    if (user && result.username) {
      const metadataUsername = user.user_metadata?.username;
      const currentUsername = (
        typeof metadataUsername === "string" && metadataUsername.trim()
          ? metadataUsername
          : user.email?.split("@")[0] ?? ""
      ).trim().toLocaleLowerCase("tr-TR");
      const fileUsername = result.username.trim().toLocaleLowerCase("tr-TR");
      if (currentUsername !== fileUsername) {
        throw new Error(`Bu dosya @${result.username} hesabına ait. Önce doğru hesapla giriş yapmalısın.`);
      }
    }
    if (result.transactions.length === 0) return result;

    const previous = transactions;
    const merged = new Map(previous.map(transaction => [transaction.id, transaction]));
    result.transactions.forEach(transaction => merged.set(transaction.id, transaction));
    const next = Array.from(merged.values()).sort(compareTransactionsDesc);
    setTransactions(next);

    try {
      if (user) {
        const rows = result.transactions.map(transaction => txToRow(transaction, user.id, financialCloudEnabled));
        const { error } = await supabase.from("transactions").upsert(rows, { onConflict: "user_id,client_id" });
        if (error) throw error;
      } else {
        localStorage.setItem(DATA_KEY, JSON.stringify(next));
      }
      flashSaved();
      return result;
    } catch (error) {
      setTransactions(previous);
      throw error;
    }
  }, [financialCloudEnabled, transactions, user]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      if (user) {
        supabase.from("user_settings").upsert({
          user_id: user.id, dark: next.dark, theme_id: next.themeId,
        }).then(({ error }) => { if (error) console.error("settings", error); });
      } else {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }
        catch (error) { console.warn("local settings save failed", error); }
      }
      return next;
    });
  }, [user]);

  const addAccount = useCallback(async (
    input: Omit<FinancialAccount, "id" | "clientId">,
  ) => {
    const account: FinancialAccount = {
      ...input,
      id: crypto.randomUUID(),
      clientId: Date.now(),
    };
    setAccounts(current => [...current, account]);

    try {
      if (user && financialCloudEnabled) {
        const { error } = await supabase.from("accounts").insert(accountToRow(account, user.id));
        if (error) throw error;
      }
      flashSaved();
      return account;
    } catch (error) {
      setAccounts(current => current.filter(item => item.id !== account.id));
      throw error;
    }
  }, [financialCloudEnabled, user]);

  const updateAccount = useCallback(async (account: FinancialAccount) => {
    const previous = accounts.find(item => item.id === account.id);
    if (!previous) return;
    setAccounts(current => current.map(item => item.id === account.id ? account : item));

    try {
      if (user && financialCloudEnabled) {
        const { error } = await supabase.from("accounts").upsert(accountToRow(account, user.id));
        if (error) throw error;
      }
      flashSaved();
    } catch (error) {
      setAccounts(current => current.map(item => item.id === previous.id ? previous : item));
      throw error;
    }
  }, [accounts, financialCloudEnabled, user]);

  const archiveAccount = useCallback(async (accountId: string) => {
    const previous = accounts.find(account => account.id === accountId);
    if (!previous || previous.isDefault) return;
    const archived = { ...previous, archivedAt: new Date().toISOString() };
    await updateAccount(archived);
  }, [accounts, updateAccount]);

  const clearAllTransactions = useCallback(async () => {
    setTransactions([]);
    if (user) {
      const { error } = await supabase.from("transactions").delete().eq("user_id", user.id);
      if (error) throw error;
    } else {
      try { localStorage.setItem(DATA_KEY, JSON.stringify([])); }
      catch (error) { console.warn("local transaction reset failed", error); }
    }
  }, [user]);

  return {
    transactions,
    accounts,
    financialCloudEnabled,
    settings,
    loaded: loaded && !authLoading,
    saveStatus,
    addTransaction,
    deleteTransaction,
    restoreTransaction,
    updateTransaction,
    updateRecurringTransactions,
    deleteTransactions,
    importTransactions,
    addAccount,
    updateAccount,
    archiveAccount,
    updateSettings,
    clearAllTransactions,
    user,
  };
}
