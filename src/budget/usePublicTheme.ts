import { useEffect } from "react";
import type { ThemeId } from "./data";

const SETTINGS_KEY = "aurora_settings_v1";

type StoredSettings = {
  dark?: boolean;
  themeId?: ThemeId;
};

export function usePublicTheme() {
  useEffect(() => {
    let settings: StoredSettings = { dark: true, themeId: "midnight" };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) settings = { ...settings, ...JSON.parse(raw) as StoredSettings };
    } catch {
      // The public screens can safely use their default theme.
    }

    document.documentElement.classList.toggle("dark", settings.dark !== false);
    document.documentElement.setAttribute("data-theme", settings.themeId ?? "midnight");
  }, []);
}
