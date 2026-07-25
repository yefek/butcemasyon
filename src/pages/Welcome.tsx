import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChartNoAxesCombined, ChevronLeft, ListChecks, Pencil, Trash2, WalletCards } from "lucide-react";
import { AppBrand } from "@/budget/components/AppBrand";
import { ONBOARDING_KEY } from "@/budget/onboarding";
import { usePublicTheme } from "@/budget/usePublicTheme";

const slides = [
  {
    eyebrow: "Aylık görünüm",
    title: "Bütçeni tek bakışta gör.",
    description: "Gelirini, giderini ve kalan bakiyeni aynı akışta takip et.",
    visual: <BalancePreview />,
  },
  {
    eyebrow: "Hızlı işlemler",
    title: "Kayıtlarını kolayca yönet.",
    description: "İşlemlerini tarih sırasıyla incele; kaydırarak düzenle veya sil.",
    visual: <TransactionPreview />,
  },
  {
    eyebrow: "Net analiz",
    title: "Ayını daha bilinçli kapat.",
    description: "Harcama dağılımını gör ve bütçe kullanımını anlık olarak izle.",
    visual: <AnalysisPreview />,
  },
];

export default function WelcomePage() {
  usePublicTheme();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = slides[activeIndex];
  const isLast = activeIndex === slides.length - 1;

  const openAuth = (mode: "signin" | "signup") => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    navigate(`/auth?mode=${mode}`);
  };

  return (
    <div className="public-shell v2-root min-h-screen">
      <main
        className="min-h-screen max-w-md mx-auto px-5 flex flex-col"
        style={{
          paddingTop: "calc(var(--safe-top) + 0.75rem)",
          paddingBottom: "calc(var(--safe-bottom) + 1rem)",
        }}
      >
        <header className="flex items-center justify-between min-h-10">
          <AppBrand size="sm" />
          {!isLast && (
            <button
              type="button"
              onClick={() => setActiveIndex(slides.length - 1)}
              className="text-[12px] font-semibold v2-text-muted hover:text-foreground"
            >
              Atla
            </button>
          )}
        </header>

        <div className="mt-5 flex gap-1.5" aria-label={`${activeIndex + 1} / ${slides.length}`}>
          {slides.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-label={`${index + 1}. tanıtım ekranı`}
              aria-current={index === activeIndex ? "step" : undefined}
              onClick={() => setActiveIndex(index)}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: index <= activeIndex ? "hsl(var(--primary))" : "hsl(var(--v2-hairline))" }}
            />
          ))}
        </div>

        <section className="flex-1 flex flex-col justify-center py-7 animate-fade-in" key={slide.title}>
          <div className="min-h-[260px] flex items-center justify-center">
            {slide.visual}
          </div>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary))" }}>
            {slide.eyebrow}
          </p>
          <h1 className="mt-2 text-[29px] leading-[1.12] font-semibold tracking-normal">
            {slide.title}
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-6 v2-text-muted">
            {slide.description}
          </p>
        </section>

        <footer className="mt-auto">
          {isLast ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveIndex(index => Math.max(index - 1, 0))}
                aria-label="Önceki ekran"
                title="Geri"
                className="press w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center"
                style={{ borderColor: "hsl(var(--v2-border))" }}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                onClick={() => openAuth("signin")}
                className="press h-12 min-w-0 flex-1 rounded-2xl text-[14px] font-semibold text-primary-foreground"
                style={{ background: "hsl(var(--primary))" }}
              >
                Giriş yap
              </button>
              <button
                type="button"
                onClick={() => openAuth("signup")}
                className="press h-12 min-w-0 flex-1 rounded-2xl border text-[14px] font-semibold"
                style={{ borderColor: "hsl(var(--primary) / 0.45)", color: "hsl(var(--primary))" }}
              >
                Kayıt ol
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {activeIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveIndex(index => index - 1)}
                  aria-label="Önceki ekran"
                  className="press w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center"
                  style={{ borderColor: "hsl(var(--v2-border))" }}
                >
                  <ChevronLeft size={19} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveIndex(index => Math.min(index + 1, slides.length - 1))}
                className="press h-12 flex-1 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-semibold text-primary-foreground"
                style={{ background: "hsl(var(--primary))" }}
              >
                Devam et <ArrowRight size={17} />
              </button>
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}

function PreviewFrame({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full max-w-[330px] v2-card p-5">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
        style={{ background: "hsl(var(--primary) / 0.14)", color: "hsl(var(--primary))" }}
      >
        {icon}
      </div>
      {children}
    </div>
  );
}

function BalancePreview() {
  return (
    <PreviewFrame icon={<WalletCards size={20} />}>
      <div className="text-[10px] font-semibold uppercase tracking-wider v2-text-muted">Net bakiye</div>
      <div className="mt-1 text-[30px] font-semibold tabular">18.750 <span className="text-[15px] v2-text-muted">₺</span></div>
      <div className="mt-5 grid grid-cols-2">
        <PreviewValue label="Gelir" value="25.000 ₺" color="hsl(var(--v2-pos))" />
        <PreviewValue label="Gider" value="6.250 ₺" color="hsl(var(--v2-neg))" bordered />
      </div>
      <div className="mt-5 h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--v2-surface-2))" }}>
        <div className="h-full w-1/4 rounded-full" style={{ background: "hsl(var(--primary))" }} />
      </div>
    </PreviewFrame>
  );
}

function TransactionPreview() {
  return (
    <PreviewFrame icon={<ListChecks size={20} />}>
      <div className="text-[11px] font-semibold v2-text-muted mb-2">20 Temmuz 2026</div>
      <div className="space-y-2">
        <div className="flex items-center rounded-2xl overflow-hidden" style={{ background: "hsl(var(--primary))" }}>
          <div className="w-[58px] text-white flex flex-col items-center gap-1"><Pencil size={15} /><span className="text-[9px]">Düzenle</span></div>
          <PreviewTransaction label="Market" value="−1.250 ₺" />
        </div>
        <div className="flex items-center rounded-2xl overflow-hidden" style={{ background: "hsl(var(--v2-neg))" }}>
          <PreviewTransaction label="Abonelik" value="−149 ₺" />
          <div className="w-[58px] text-white flex flex-col items-center gap-1"><Trash2 size={15} /><span className="text-[9px]">Sil</span></div>
        </div>
      </div>
    </PreviewFrame>
  );
}

function AnalysisPreview() {
  return (
    <PreviewFrame icon={<ChartNoAxesCombined size={20} />}>
      <div className="flex items-end justify-between gap-2 h-28 px-2">
        {[42, 68, 52, 88, 74, 100].map((height, index) => (
          <div
            key={height}
            className="w-7 rounded-t-lg"
            style={{
              height: `${height}%`,
              background: index === 5 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.25)",
            }}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] v2-text-muted">
        <span>Aylık bütçe kullanımı</span>
        <span className="font-semibold" style={{ color: "hsl(var(--v2-text))" }}>%64</span>
      </div>
    </PreviewFrame>
  );
}

function PreviewValue({ label, value, color, bordered = false }: { label: string; value: string; color: string; bordered?: boolean }) {
  return (
    <div className={bordered ? "pl-4 border-l" : "pr-4"} style={bordered ? { borderColor: "hsl(var(--v2-hairline))" } : undefined}>
      <div className="flex items-center gap-1.5 text-[10px] v2-text-muted">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} /> {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold tabular">{value}</div>
    </div>
  );
}

function PreviewTransaction({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0 h-14 px-3 flex items-center justify-between" style={{ background: "hsl(var(--v2-surface))" }}>
      <span className="text-[12px] font-semibold truncate">{label}</span>
      <span className="text-[12px] font-semibold tabular shrink-0">{value}</span>
    </div>
  );
}
