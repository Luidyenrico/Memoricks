"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getTheme, toggleTheme } from "@/lib/theme";

export default function Header() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">(() => getTheme());

  const handleToggleTheme = () => {
    const nextTheme = toggleTheme();
    setTheme(nextTheme);
  };

  const navItems = [
    { label: "HOME", href: "/" },
    { label: "REVISAR", href: "/review" },
    { label: "EM ESTUDO", href: "/active" },
    { label: "APRENDIDO", href: "/mastered" },
    { label: "CONFIGURAÇÕES", href: "/ai" },
  ];

  return (
    <header className="border-b border-border-custom bg-bg-black/80 backdrop-blur-md sticky top-0 z-40 transition-premium">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="font-extrabold text-lg tracking-[0.20em] text-text-white hover:opacity-85 transition-premium select-none">
            MEMORICKS
          </Link>
        </div>
        
        <nav className="flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[10px] font-bold tracking-widest transition-premium pb-1 border-b ${
                  isActive
                    ? "text-text-white border-brand-blue"
                    : "text-text-muted border-transparent hover:text-text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-5">
          <button
            onClick={handleToggleTheme}
            className="text-text-muted hover:text-text-white transition-colors p-1"
            title={theme === "dark" ? "Ativar Tema Claro" : "Ativar Tema Escuro"}
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
          <div className="w-8 h-8 rounded-full bg-bg-medium border border-border-custom flex items-center justify-center text-xs font-bold text-text-white select-none shadow-sm hover:border-brand-blue/50 transition-premium cursor-pointer">
            G
          </div>
        </div>
      </div>
    </header>
  );
}
