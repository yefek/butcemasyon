import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { welcomeSlides } from "./WelcomePreviews";

export function AuthInformation() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (paused || hovered || focused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && window.matchMedia("(min-width: 1024px)").matches) {
        setActive(index => (index + 1) % welcomeSlides.length);
      }
    }, 7000);
    return () => window.clearInterval(timer);
  }, [active, paused, hovered, focused]);

  const slide = welcomeSlides[active];
  const move = (step: number) => setActive(index => (index + step + welcomeSlides.length) % welcomeSlides.length);

  return (
    <aside className="auth-information" aria-label="Bütçemasyon tanıtımı" aria-roledescription="slayt gösterisi"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}>
      <div className="auth-slide" key={active} role="group" aria-roledescription="slayt" aria-label={`${active + 1} / ${welcomeSlides.length}`}>
        <div className="min-h-[260px] flex items-center justify-center">{slide.visual}</div>
        <p className="mt-7 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary))" }}>{slide.eyebrow}</p>
        <h2 className="mt-2 text-[29px] leading-[1.12] font-semibold tracking-normal">{slide.title}</h2>
        <p className="mt-3 max-w-sm text-[14px] leading-6 v2-text-muted">{slide.description}</p>
      </div>
      <div className="mt-7 flex items-center justify-center gap-2">
        <button type="button" onClick={() => move(-1)} className="auth-slide-control" aria-label="Önceki bilgi kartı"><ChevronLeft size={18} /></button>
        {welcomeSlides.map((item, index) => (
          <button key={item.title} type="button" className="auth-slide-control" onClick={() => setActive(index)}
            aria-label={`${index + 1}. bilgi kartı`} aria-current={active === index ? "step" : undefined}>
            <span className="h-2 w-2 rounded-full transition-colors" style={{ background: active === index ? "hsl(var(--primary))" : "hsl(var(--v2-hairline))" }} />
          </button>
        ))}
        <button type="button" onClick={() => move(1)} className="auth-slide-control" aria-label="Sonraki bilgi kartı"><ChevronRight size={18} /></button>
        <button type="button" onClick={() => setPaused(value => !value)} className="auth-slide-control"
          aria-label={paused ? "Otomatik geçişi başlat" : "Otomatik geçişi duraklat"}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
    </aside>
  );
}
