import { useEffect, useRef, useState } from "react";

/** Smoothly animates a number from previous value to target. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const startRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = startRef.current;
    const to = target;
    if (from === to) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      const v = from + (to - from) * eased;
      setValue(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else startRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}
