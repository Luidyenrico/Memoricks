"use client";

type Theme = "light" | "dark";
const STORAGE_KEY = "memoricks-theme";
const THEME_EVENT = "memoricks-theme-change";

export function getTheme(): Theme {
  return typeof document !== "undefined" &&
    document.documentElement.classList.contains("light")
    ? "light"
    : "dark";
}

export function toggleTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const nextTheme = getTheme() === "light" ? "dark" : "light";
  document.documentElement.classList.toggle("light", nextTheme === "light");
  try {
    localStorage.setItem(STORAGE_KEY, nextTheme);
  } catch {
    /* Theme still works when storage is blocked. */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
  return nextTheme;
}

export function subscribeTheme(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    document.documentElement.classList.toggle(
      "light",
      event.newValue === "light",
    );
    onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}
