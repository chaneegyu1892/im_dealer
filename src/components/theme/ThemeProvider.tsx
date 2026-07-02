"use client";

import { useEffect, type ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "im-dealer-theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const themeScript = `
(function() {
  var storageKey = "${STORAGE_KEY}";
  var darkMediaQuery = "${DARK_MEDIA_QUERY}";
  var storedTheme = null;

  try {
    storedTheme = window.localStorage.getItem(storageKey);
  } catch (_) {
    storedTheme = null;
  }

  if (storedTheme !== "light" && storedTheme !== "dark") {
    storedTheme = window.matchMedia(darkMediaQuery).matches ? "dark" : "light";
  }

  document.documentElement.classList.toggle("dark", storedTheme === "dark");
  document.documentElement.style.colorScheme = storedTheme;
})();
`;

function getSystemTheme(): Theme {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    if (storedTheme !== null) {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    return null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function restoreTheme(): void {
  applyTheme(getStoredTheme() ?? getSystemTheme());
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    restoreTheme();

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    const handleSystemThemeChange = (): void => {
      if (getStoredTheme() === null) {
        applyTheme(getSystemTheme());
      }
    };
    const handleStorageChange = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY) {
        restoreTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: themeScript }}
      />
      {children}
    </>
  );
}
