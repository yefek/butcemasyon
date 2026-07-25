export interface SavingsStatus {
  isOverspent: boolean;
  label: "Tasarruf" | "Aşım";
  value: string;
}

export function getSavingsStatus(savingPct: number): SavingsStatus {
  const normalized = Number.isFinite(savingPct) ? savingPct : 0;
  const isOverspent = normalized < 0;

  return {
    isOverspent,
    label: isOverspent ? "Aşım" : "Tasarruf",
    value: `%${Math.abs(normalized).toFixed(0)}`,
  };
}
