import { capitalizeFirstLetterTR, compareTransactionsDesc, type RecurringFreq, type Transaction, type TxType } from "./data";

export interface TransactionImportResult {
  transactions: Transaction[];
  skipped: number;
  username?: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const firstValue = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const asText = (value: unknown) => typeof value === "string" ? value.trim() : "";

function asAmount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  let normalized = value.replace(/[^\d,.-]/g, "");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma > dot) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else normalized = normalized.replace(/,/g, "");
  return Number(normalized);
}

function asDate(value: unknown) {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? "" : date;
}

function asType(value: unknown): TxType | undefined {
  const normalized = asText(value).toLocaleLowerCase("tr-TR");
  if (["income", "gelir"].includes(normalized)) return "income";
  if (["expense", "gider", "harcama"].includes(normalized)) return "expense";
  return undefined;
}

function asRecurring(value: unknown): RecurringFreq | undefined {
  const normalized = asText(value).toLocaleLowerCase("tr-TR");
  if (["weekly", "haftalık", "haftalik"].includes(normalized)) return "weekly";
  if (["monthly", "aylık", "aylik"].includes(normalized)) return "monthly";
  return undefined;
}

function sourceRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ["transactions", "işlemler", "islemler", "data", "records"]) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return [];
}

export function parseTransactionImport(value: unknown, idSeed = Date.now()): TransactionImportResult {
  const username = isRecord(value) ? asText(firstValue(value, ["username", "user_name", "kullanici_adi"])) : "";
  let skipped = 0;
  const transactions = sourceRows(value).flatMap((raw, index): Transaction[] => {
    if (!isRecord(raw)) {
      skipped += 1;
      return [];
    }

    const type = asType(firstValue(raw, ["type", "transaction_type", "tur", "tür"]));
    const category = asText(firstValue(raw, ["category", "kategori"]));
    const amount = asAmount(firstValue(raw, ["amount", "tutar", "value"]));
    const date = asDate(firstValue(raw, ["date", "tarih", "transaction_date", "created_at"]));
    if (!type || !category || !(amount > 0) || !date) {
      skipped += 1;
      return [];
    }

    const rawId = Number(firstValue(raw, ["client_id", "clientId", "id"]));
    const createdAtValue = asText(firstValue(raw, ["created_at", "createdAt", "created"]));
    const createdAt = Number.isNaN(Date.parse(createdAtValue)) ? undefined : new Date(createdAtValue).toISOString();
    const recurring = asRecurring(firstValue(raw, ["recurring", "repeat", "tekrar"]));

    return [{
      id: Number.isSafeInteger(rawId) && rawId > 0 ? rawId : idSeed + index,
      type,
      category: capitalizeFirstLetterTR(category),
      subcategory: capitalizeFirstLetterTR(asText(firstValue(raw, ["subcategory", "sub_category", "alt_kategori"]))),
      amount,
      date,
      createdAt,
      note: capitalizeFirstLetterTR(asText(firstValue(raw, ["note", "description", "aciklama", "açıklama"]))),
      icon: asText(firstValue(raw, ["icon", "emoji"])),
      recurring,
    }];
  });

  return {
    transactions: transactions.sort(compareTransactionsDesc),
    skipped,
    username: username || undefined,
  };
}
