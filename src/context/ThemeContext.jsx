import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "uofa-theme";
const FONT_KEY = "uofa-font-scale";

/** Allowed scales: slightly smaller → default → larger → largest (readable on phone from a distance) */
export const FONT_SCALES = [
  { id: "sm", label: "Small", value: 0.92 },
  { id: "md", label: "Medium", value: 1 },
  { id: "lg", label: "Large", value: 1.12 },
  { id: "xl", label: "Extra large", value: 1.25 },
];

function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function applyFontScale(scaleId) {
  const entry = FONT_SCALES.find((s) => s.id === scaleId) || FONT_SCALES[1];
  const root = document.documentElement;
  root.style.setProperty("--font-scale", String(entry.value));
  root.dataset.fontScale = entry.id;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      /* ignore */
    }
    return "light";
  });

  const [fontScale, setFontScaleState] = useState(() => {
    try {
      const saved = localStorage.getItem(FONT_KEY);
      if (FONT_SCALES.some((s) => s.id === saved)) return saved;
    } catch {
      /* ignore */
    }
    // Default a bit larger than old tiny UI for readability
    return "lg";
  });

  // Apply on mount + whenever theme / scale changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    applyFontScale(fontScale);
    try {
      localStorage.setItem(FONT_KEY, fontScale);
    } catch {
      /* ignore */
    }
  }, [fontScale]);

  // Apply immediately on first paint (avoid flash)
  useEffect(() => {
    applyTheme(theme);
    applyFontScale(fontScale);
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      return value === "dark" ? "dark" : "light";
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const setFontScale = useCallback((next) => {
    setFontScaleState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      return FONT_SCALES.some((s) => s.id === value) ? value : "md";
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === "dark",
      fontScale,
      setFontScale,
      fontScales: FONT_SCALES,
    }),
    [theme, setTheme, toggleTheme, fontScale, setFontScale]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
