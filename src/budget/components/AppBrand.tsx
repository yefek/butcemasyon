interface AppBrandProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: "w-7 h-7", text: "text-[16px]" },
  md: { icon: "w-8 h-8", text: "text-[17px]" },
  lg: { icon: "w-11 h-11", text: "text-[22px]" },
};

export function AppBrand({ size = "md", showName = true, className = "" }: AppBrandProps) {
  const scale = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <svg
        role="img"
        aria-label="Bütçemasyon logosu"
        viewBox="0 0 32 32"
        className={`${scale.icon} shrink-0 text-[hsl(var(--v2-text))] dark:text-white`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="6" cy="8" r="3" fill="currentColor" />
        <rect x="4" y="17" width="5" height="10" rx="2.5" fill="currentColor" opacity="0.7" />
        <rect x="13.5" y="12" width="5" height="15" rx="2.5" fill="currentColor" opacity="0.85" />
        <rect x="23" y="5" width="5" height="22" rx="2.5" fill="currentColor" />
      </svg>
      {showName && (
        <span className={`truncate ${scale.text} font-semibold tracking-normal text-[hsl(var(--v2-text))] dark:text-white`}>
          Bütçemasyon
        </span>
      )}
    </div>
  );
}
