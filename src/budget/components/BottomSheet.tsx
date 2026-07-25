import { useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    window.addEventListener("keydown", onKey);
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: "hsl(220 30% 8% / 0.32)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-card text-card-foreground rounded-t-[28px] sm:rounded-[28px] border border-border/70 shadow-lg animate-slide-up scrollbar-none"
        style={{
          animation: "slide-up 0.45s var(--ease-out-expo) both",
          boxShadow: "0 -10px 40px -12px hsl(220 30% 12% / 0.18), 0 24px 60px -20px hsl(220 30% 18% / 0.20), inset 0 1px 0 hsl(0 0% 100% / 0.55)",
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/85 backdrop-blur-xl border-b border-border/50">
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="press w-9 h-9 rounded-2xl bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
