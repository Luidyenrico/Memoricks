export default function AppIcon({ name }: { name: "home" | "review" | "themes" | "statistics" | "settings" | "menu" | "sun" | "moon" | "edit" | "trash" | "check" | "chevron" | "logout" }) {
  const paths = {
    edit: "m16 3 5 5-12 12-6 1 1-6zM14 5l5 5",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    check: "m5 12 4 4L19 6",
    home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
    review: "m13 2-9 12h7l-1 8 10-13h-8z",
    themes: "M12 5v16M3 4c4-1 6 0 9 1 3-1 5-2 9-1v15c-4-1-6 0-9 2-3-2-5-3-9-2z",
    statistics: "M4 20V10h3v10zm7 0V4h3v16zm7 0V8h3v12z",
    settings: "m9 3-1 3-3 1-2 3 2 2v3l2 3h3l2 3 3-2 3-1 1-3 2-3-2-3-1-3-3-1-3-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    menu: "M4 6h16M4 12h16M4 18h16",
    sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    moon: "M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11",
    chevron: "m8 10 4 4 4-4",
    logout: "M10 17l5-5-5-5m5 5H3m11-8h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5",
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
