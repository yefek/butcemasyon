import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, AtSign, CircleCheck, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppBrand } from "@/budget/components/AppBrand";
import { ONBOARDING_KEY } from "@/budget/onboarding";
import { usePublicTheme } from "@/budget/usePublicTheme";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";

const USERNAME_DOMAIN = "butce.local";
const REMEMBER_KEY = "butce_remember";
const toEmail = (username: string) => `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
const validUsername = (username: string) => /^[a-z0-9_.]{3,24}$/i.test(username.trim());

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  usePublicTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(() => searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) !== "0");

  useEffect(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
  }, []);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setSearchParams({ mode: nextMode }, { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validUsername(username)) {
      toast.error("Kullanıcı adı 3–24 karakter, harf/rakam/._ olmalı");
      return;
    }
    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalı");
      return;
    }

    setBusy(true);
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    try {
      const email = toEmail(username);
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username.trim().toLowerCase(), name: username.trim() },
          },
        });
        if (error) {
          if (/registered|exists|duplicate/i.test(error.message)) throw new Error("Bu kullanıcı adı alınmış");
          throw error;
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
        }
        const signedUpUserId = signUpData.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
        if (signedUpUserId) {
          const dark = document.documentElement.classList.contains("dark");
          const themeId = document.documentElement.getAttribute("data-theme") ?? "midnight";
          const { error: settingsError } = await supabase.from("user_settings").upsert({
            user_id: signedUpUserId,
            dark,
            theme_id: themeId,
          });
          if (settingsError) console.warn("initial theme save failed", settingsError);
        }
        toast.success("Hoş geldin!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/invalid/i.test(error.message)) throw new Error("Kullanıcı adı veya şifre hatalı");
          throw error;
        }
      }
      navigate("/", { replace: true });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Bir hata oluştu"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="public-shell v2-root min-h-screen">
      <main
        className="min-h-screen w-full max-w-sm mx-auto px-5"
        style={{
          paddingTop: "calc(var(--safe-top) + 0.75rem)",
          paddingBottom: "calc(var(--safe-bottom) + 1.25rem)",
        }}
      >
        <header className="h-11 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/welcome")}
            aria-label="Tanıtım ekranına dön"
            title="Geri"
            className="press w-10 h-10 rounded-full border flex items-center justify-center"
            style={{ borderColor: "hsl(var(--v2-border))" }}
          >
            <ArrowLeft size={18} />
          </button>
          <span className="w-10" aria-hidden />
        </header>

        <section className="mt-12">
          <AppBrand size="lg" className="mb-8" />

          <div className="v2-seg" role="tablist" aria-label="Hesap işlemi">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              data-active={mode === "signin"}
              onClick={() => changeMode("signin")}
            >
              Giriş yap
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              data-active={mode === "signup"}
              onClick={() => changeMode("signup")}
            >
              Kayıt ol
            </button>
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary))" }}>
              {mode === "signin" ? "Tekrar hoş geldin" : "Aramıza katıl"}
            </p>
            <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-normal">
              {mode === "signin" ? "Hesabına giriş yap" : "Hesabını oluştur"}
            </h1>
            <p className="mt-2 text-[13px] leading-5 v2-text-muted">
              {mode === "signin"
                ? "Bütçene kaldığın yerden devam et."
                : "Bir kullanıcı adı ve şifre belirle; e-posta gerekmez."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <AuthField label="Kullanıcı adı" icon={<AtSign size={16} />}>
              <input
                type="text"
                required
                placeholder="Kullanıcı adınız"
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoComplete="username"
                spellCheck={false}
                className="w-full bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
              />
            </AuthField>

            <AuthField label="Şifre" icon={<Lock size={16} />}>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Şifreniz"
                value={password}
                minLength={6}
                onChange={event => setPassword(event.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                className="v2-text-muted shrink-0 p-1"
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                title={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </AuthField>

            {mode === "signup" && (
              <div
                className="flex items-center gap-2 px-1 text-[11.5px] leading-5"
                style={{ color: "hsl(var(--primary))" }}
              >
                <CircleCheck size={14} className="shrink-0" aria-hidden />
                <span>Şifreniz en az 6 karakter olmalıdır.</span>
              </div>
            )}

            <button
              type="button"
              role="switch"
              aria-checked={remember}
              onClick={() => setRemember(value => !value)}
              className="inline-flex items-center gap-3 text-[13px] font-medium v2-text-muted"
            >
              <span
                aria-hidden
                className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: remember ? "hsl(var(--primary))" : "hsl(var(--v2-surface-2))" }}
              >
                <span
                  className="absolute left-[3px] top-[3px] w-[18px] h-[18px] rounded-full transition-transform"
                  style={{
                    background: "hsl(var(--primary-foreground))",
                    transform: remember ? "translateX(16px)" : "translateX(0)",
                    boxShadow: "0 1px 4px hsl(220 30% 8% / 0.25)",
                  }}
                />
              </span>
              Beni hatırla
            </button>

            <button
              type="submit"
              disabled={busy}
              className="press w-full h-[52px] rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              {busy ? "İşleniyor…" : mode === "signin" ? "Giriş yap" : "Hesap oluştur"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 text-[11px] leading-5 v2-text-muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <span>Verilerin hesabına özel tutulur ve cihazların arasında senkronlanır.</span>
          </div>
        </section>
      </main>
    </div>
  );
}

function AuthField({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block px-1 mb-2 text-[11px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
        {label}
      </span>
      <span
        className="flex items-center gap-3 h-14 px-4 rounded-2xl border focus-within:ring-2 transition"
        style={{
          borderColor: "hsl(var(--primary) / 0.42)",
          "--tw-ring-color": "hsl(var(--primary) / 0.25)",
        } as CSSProperties}
      >
        <span className="v2-text-muted shrink-0">{icon}</span>
        {children}
      </span>
    </label>
  );
}
