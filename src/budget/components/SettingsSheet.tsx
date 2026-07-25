import { useRef, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, LogOut, Moon, Sun, Trash2, AlertTriangle, Upload } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { THEMES, type ThemeId } from "../data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../useAuth";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open?: boolean;
  onClose?: () => void;
  dark: boolean;
  themeId: ThemeId;
  onChangeDark: (v: boolean) => void;
  onChangeTheme: (v: ThemeId) => void;
  onResetData?: () => Promise<void> | void;
  onImportData?: (value: unknown) => Promise<{ transactions: unknown[]; skipped: number }>;
  asPage?: boolean;
}

export function SettingsSheet({
  open, onClose, dark, themeId, onChangeDark, onChangeTheme, onResetData, onImportData, asPage,
}: Props) {
  const Body = (
    <SettingsBody
      dark={dark}
      themeId={themeId}
      onChangeDark={onChangeDark}
      onChangeTheme={onChangeTheme}
      onResetData={onResetData}
      onImportData={onImportData}
      onAfterAction={() => onClose?.()}
    />
  );

  if (asPage) return <div className="animate-fade-in">{Body}</div>;

  return (
    <BottomSheet open={!!open} onClose={() => onClose?.()} title="Ayarlar">
      {Body}
    </BottomSheet>
  );
}

function SettingsBody({
  dark, themeId, onChangeDark, onChangeTheme, onResetData, onImportData, onAfterAction,
}: {
  dark: boolean;
  themeId: ThemeId;
  onChangeDark: (v: boolean) => void;
  onChangeTheme: (v: ThemeId) => void;
  onResetData?: () => Promise<void> | void;
  onImportData?: (value: unknown) => Promise<{ transactions: unknown[]; skipped: number }>;
  onAfterAction: () => void;
}) {
  const { user } = useAuth();
  const metadataUsername = user?.user_metadata?.username;
  const username = (typeof metadataUsername === "string" ? metadataUsername : "")
    || (user?.email ? user.email.split("@")[0] : "");

  return (
    <>
      {user && (
        <Section label="Hesap">
          <div className="v2-card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold shrink-0"
                 style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
              {(username[0] || "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold truncate">@{username}</div>
              <div className="text-[11px] v2-text-muted">Veriler buluta senkronlanıyor</div>
            </div>
          </div>
          <div className="mt-3">
            <ChangePassword />
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); onAfterAction(); }}
            className="press w-full h-11 mt-2 rounded-2xl v2-soft flex items-center justify-center gap-2 text-[13px] font-semibold"
          >
            <LogOut size={15} /> Çıkış yap
          </button>
        </Section>
      )}

      <Section label="Görünüm">
        <div className="grid grid-cols-2 gap-3">
          {[
            { isDark: false, label: "Aydınlık", Icon: Sun },
            { isDark: true,  label: "Karanlık", Icon: Moon },
          ].map(({ isDark, label, Icon }) => {
            const active = dark === isDark;
            return (
              <button
                key={label}
                onClick={() => onChangeDark(isDark)}
                className={`press relative p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all ${
                  active ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-foreground/20"
                }`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary text-foreground">
                  <Icon size={18} />
                </div>
                <div className="text-sm font-semibold">{label}</div>
                {active && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Tema rengi">
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(t => {
            const active = themeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChangeTheme(t.id)}
                className={`press relative p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  active ? "border-primary/50" : "border-border bg-card hover:border-foreground/20"
                }`}
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.hue} shadow-sm`} />
                <div className="text-[11px] font-semibold">{t.name}</div>
                {active && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check size={10} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Veri yönetimi">
        <ImportData onImport={onImportData} />
        <ResetData onReset={onResetData} />
        {user && <DeleteAccount onDeleted={onAfterAction} />}
      </Section>

      <div className="text-center text-[11px] text-muted-foreground mt-6 mb-1">Bütçe</div>
    </>
  );
}

function ImportData({ onImport }: { onImport?: (value: unknown) => Promise<{ transactions: unknown[]; skipped: number }> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!onImport) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const parsed: unknown = JSON.parse(await file.text());
            const result = await onImport(parsed);
            if (result.transactions.length === 0) {
              toast.error("Dosyada geçerli işlem bulunamadı");
              return;
            }
            const skippedText = result.skipped > 0 ? `, ${result.skipped} satır atlandı` : "";
            toast.success(`${result.transactions.length} işlem yüklendi${skippedText}`);
          } catch (error) {
            toast.error(getErrorMessage(error, "Dosya okunamadı"));
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="press w-full h-11 mb-2 rounded-2xl v2-soft flex items-center justify-center gap-2 text-[13px] font-semibold disabled:opacity-60"
      >
        <Upload size={15} /> {busy ? "Yükleniyor..." : "Veri yükle"}
      </button>
      <p className="px-1 mb-3 text-[11px] leading-4 v2-text-muted">
        Lovable'dan aldığın JSON işlem dosyası mevcut kayıtlarla birleştirilir.
      </p>
    </>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("Yeni şifre en az 6 karakter olmalı");
    if (next !== confirm) return toast.error("Şifreler uyuşmuyor");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Oturum bulunamadı");
      const { error: sErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (sErr) throw new Error("Mevcut şifre hatalı");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Şifre güncellendi");
      setCurrent(""); setNext(""); setConfirm(""); setOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Şifre değiştirilemedi"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="press w-full h-11 rounded-2xl v2-soft flex items-center justify-center gap-2 text-[13px] font-semibold"
      >
        <KeyRound size={15} /> Şifre değiştir
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="v2-card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Şifre değiştir</div>
        <button type="button" onClick={() => setShow(s => !s)}
                className="text-muted-foreground hover:text-foreground">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      <input type={show ? "text" : "password"} placeholder="Mevcut şifre" value={current}
        onChange={e => setCurrent(e.target.value)} required autoComplete="current-password"
        className="w-full h-11 px-3.5 rounded-2xl v2-soft text-[14px] outline-none" />
      <input type={show ? "text" : "password"} placeholder="Yeni şifre" value={next}
        onChange={e => setNext(e.target.value)} minLength={6} required autoComplete="new-password"
        className="w-full h-11 px-3.5 rounded-2xl v2-soft text-[14px] outline-none" />
      <input type={show ? "text" : "password"} placeholder="Yeni şifre (tekrar)" value={confirm}
        onChange={e => setConfirm(e.target.value)} minLength={6} required autoComplete="new-password"
        className="w-full h-11 px-3.5 rounded-2xl v2-soft text-[14px] outline-none" />
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => { setOpen(false); setCurrent(""); setNext(""); setConfirm(""); }}
                className="press flex-1 h-10 rounded-2xl v2-soft text-[13px] font-semibold">
          Vazgeç
        </button>
        <button type="submit" disabled={busy}
                className="press flex-1 h-10 rounded-2xl text-[13px] font-semibold"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
          {busy ? "..." : "Kaydet"}
        </button>
      </div>
    </form>
  );
}

function ResetData({ onReset }: { onReset?: () => Promise<void> | void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!onReset) return null;

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="press w-full h-11 rounded-2xl v2-soft flex items-center justify-center gap-2 text-[13px] font-semibold"
      >
        <Trash2 size={15} /> Verileri sıfırla
      </button>
    );
  }

  return (
    <div className="v2-card p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--v2-neg))" }} />
        <div className="text-[12.5px] leading-relaxed">
          Tüm işlemlerin <span className="font-semibold">kalıcı olarak</span> silinecek. Hesabın korunacak.
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setConfirm(false)}
                className="press flex-1 h-10 rounded-2xl v2-soft text-[13px] font-semibold">
          Vazgeç
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await onReset(); toast.success("Veriler sıfırlandı"); setConfirm(false); }
            catch (error: unknown) { toast.error(getErrorMessage(error, "Sıfırlanamadı")); }
            finally { setBusy(false); }
          }}
          className="press flex-1 h-10 rounded-2xl text-[13px] font-semibold text-white"
          style={{ background: "hsl(var(--v2-neg))" }}>
          {busy ? "..." : "Sıfırla"}
        </button>
      </div>
    </div>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [stage, setStage] = useState<"idle" | "confirm">("idle");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (stage === "idle") {
    return (
      <button
        onClick={() => setStage("confirm")}
        className="press w-full h-11 mt-2 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-semibold"
        style={{ background: "hsl(var(--v2-neg) / 0.10)", color: "hsl(var(--v2-neg))",
                 border: "1px solid hsl(var(--v2-neg) / 0.25)" }}
      >
        <Trash2 size={15} /> Hesabı sil
      </button>
    );
  }

  return (
    <div className="v2-card p-4 mt-2 space-y-3"
         style={{ borderColor: "hsl(var(--v2-neg) / 0.35)" }}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--v2-neg))" }} />
        <div className="text-[12.5px] leading-relaxed">
          Hesabın ve tüm verilerin <span className="font-semibold">kalıcı olarak</span> silinecek.
          Onaylamak için aşağıya <span className="font-semibold">SIL</span> yaz.
        </div>
      </div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='Onaylamak için "SIL" yaz'
        className="w-full h-11 px-3.5 rounded-2xl v2-soft text-[14px] outline-none"
      />
      <div className="flex gap-2">
        <button onClick={() => { setStage("idle"); setText(""); }}
                className="press flex-1 h-10 rounded-2xl v2-soft text-[13px] font-semibold">
          Vazgeç
        </button>
        <button
          disabled={busy || text.trim().toUpperCase() !== "SIL"}
          onClick={async () => {
            setBusy(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error("Oturum bulunamadı");
              const { error } = await supabase.functions.invoke("delete-account");
              if (error) throw error;
              await supabase.auth.signOut();
              toast.success("Hesap silindi");
              onDeleted();
            } catch (error: unknown) {
              toast.error(getErrorMessage(error, "Hesap silinemedi"));
            } finally { setBusy(false); }
          }}
          className="press flex-1 h-10 rounded-2xl text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "hsl(var(--v2-neg))" }}>
          {busy ? "..." : "Hesabı sil"}
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{label}</div>
      {children}
    </div>
  );
}
