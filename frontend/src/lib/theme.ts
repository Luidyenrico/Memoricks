"use client";

export function initTheme() {
  if (typeof window !== "undefined") {
    const savedTheme = localStorage.getItem("memoricks-theme");
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }
}

export function toggleTheme(): "light" | "dark" {
  if (typeof window !== "undefined") {
    const isLight = document.documentElement.classList.contains("light");
    if (isLight) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("memoricks-theme", "dark");
      return "dark";
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("memoricks-theme", "light");
      return "light";
    }
  }
  return "dark";
}

export function getTheme(): "light" | "dark" {
  if (typeof window !== "undefined") {
    return document.documentElement.classList.contains("light") ? "light" : "dark";
  }
  return "dark";
}
