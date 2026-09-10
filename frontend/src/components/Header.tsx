"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { getTheme, subscribeTheme, toggleTheme } from "@/lib/theme";

export default function Header() {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleToggleTheme = () => {
    toggleTheme();
  };

  const navItems = [
    { label: "INÍCIO", href: "/" },
    { label: "REVISAR", href: "/review" },
    { label: "EM ESTUDO", href: "/active" },
    { label: "APRENDIDO", href: "/mastered" },
    { label: "CONFIGURAÇÕES", href: "/ai" },
  ];

  return (
    <header className="border-b border-border-custom bg-bg-black/80 backdrop-blur-md sticky top-0 z-40 transition-premium">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-3 text-text-white hover:opacity-85 transition-premium select-none"
            aria-label="Memoricks - pagina inicial"
          >
            <Image
              src="/memoricks-logo.png"
              alt="Logo Memoricks"
              width={44}
              height={44}
              priority
              className="h-11 w-11 object-contain"
            />
            <span className="hidden sm:block font-extrabold text-base tracking-[0.08em]">
              MEMORICKS
            </span>
          </Link>
        </div>

        <nav
          aria-label="Navegação principal"
          className="hidden lg:flex items-center gap-4"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`text-xs font-bold tracking-widest transition-premium pb-1 border-b ${
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

        <div className="flex items-center gap-3 sm:gap-5">
          <button
            onClick={handleToggleTheme}
            className="text-text-muted hover:text-text-white transition-colors p-3"
            aria-label={
              theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
            }
            title={
              theme === "dark" ? "Ativar Tema Claro" : "Ativar Tema Escuro"
            }
          >
            {theme === "dark" ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            )}
          </button>
          <Link
            href="/language"
            aria-label="Trocar idioma de estudo"
            title="Trocar idioma de estudo"
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-premium ${
              pathname === "/language"
                ? "border-brand-blue text-accent bg-brand-blue/10"
                : "border-border-custom text-text-muted hover:text-text-white hover:border-brand-blue/50"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.2-2.46 3.33-5.46 3.4-9C15.33 8.46 14.2 5.46 12 3m0 18c-2.2-2.46-3.33-5.46-3.4-9C8.67 8.46 9.8 5.46 12 3M3.6 9h16.8M3.6 15h16.8"
              />
            </svg>
          </Link>
          <Link
            href="/profile"
            aria-label="Abrir perfil"
            title="Perfil"
            className={`w-11 h-11 rounded-full bg-bg-medium border flex items-center justify-center text-text-white shadow-sm transition-premium ${
              pathname === "/profile"
                ? "border-brand-blue"
                : "border-border-custom hover:border-brand-blue/50"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0 17.9 17.9 0 01-15 0z"
              />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            className="lg:hidden w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-white transition-colors"
          >
            {isMenuOpen ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Navegação principal"
          className="lg:hidden border-t border-border-custom bg-bg-black px-4 py-3 grid grid-cols-2 gap-2"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsMenuOpen(false)}
                className={`px-3 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  isActive
                    ? "bg-brand-blue/10 text-accent"
                    : "text-text-muted hover:bg-bg-medium hover:text-text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
