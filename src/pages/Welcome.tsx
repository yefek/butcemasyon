import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { AppBrand } from "@/budget/components/AppBrand";
import { ONBOARDING_KEY } from "@/budget/onboarding";
import { usePublicTheme } from "@/budget/usePublicTheme";

import { welcomeSlides as slides } from "@/budget/components/WelcomePreviews";

export default function WelcomePage() {
  usePublicTheme();
  const navigate = useNavigate();
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      navigate("/auth", { replace: true });
    }
  }, [navigate]);
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
