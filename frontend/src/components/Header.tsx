"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getTheme, subscribeTheme, toggleTheme } from "@/lib/theme";
import AppIcon from "./AppIcon";

const navigation = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/themes", label: "Meus temas", icon: "themes" },
  { href: "/statistics", label: "Estatísticas", icon: "statistics" },
  { href: "/settings", label: "Configurações", icon: "settings" },
] as const;

const accountNavigation = [
  { href: "/settings", label: "Configurações da conta", description: "Idioma e preferências", icon: "settings" },
  { href: "/themes", label: "Meus temas", description: "Organize seus estudos", icon: "themes" },
  { href: "/statistics", label: "Estatísticas", description: "Acompanhe sua evolução", icon: "statistics" },
] as const;

type HeaderProps = {
  userEmail?: string;
  userName?: string;
  onLogout?: () => void | Promise<void>;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts.at(-1)![0]).toUpperCase();
}

export default function Header({ userEmail, userName, onLogout }: HeaderProps) {
  const pathname = usePathname();
  const reviewing = pathname.startsWith("/review/");
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark");
  const [busy, setBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const displayName = userName?.trim() || userEmail?.split("@")[0] || "Sua conta";
  const initials = initialsFor(displayName);
  const section = pathname.startsWith("/groups/") || pathname.startsWith("/subgroups/") || pathname.startsWith("/review")
    ? "/themes" : pathname === "/" ? "/" : "/" + pathname.split("/")[1];
  const current = navigation.find((item) => item.href === section) || navigation[0];
  useEffect(() => {
    const update = (event: Event) => setBusy((event as CustomEvent<boolean>).detail);
    window.addEventListener("memoricks-review-busy", update);
    return () => window.removeEventListener("memoricks-review-busy", update);
  }, []);
  useEffect(() => {
    if (!accountOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!accountMenu.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      accountButton.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);
  async function handleLogout() {
    if (!onLogout || loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setAccountOpen(false);
    }
  }
  function closeMenu() {
    drawer.current?.close();
    menuButton.current?.focus();
  }
  function links() {
    return navigation.map((item) => (
      <Link key={item.href} href={item.href} title={item.label}
        aria-current={section === item.href ? "page" : undefined}
        aria-disabled={busy || undefined} tabIndex={busy ? -1 : undefined}
        onClick={(event) => { if (busy) event.preventDefault(); else drawer.current?.close(); }}>
        <AppIcon name={item.icon} /><span>{item.label}</span>
      </Link>
    ));
  }
  const brand = <Link href="/" className="app-brand" aria-label="Memoricks — início"
    aria-disabled={busy || undefined} onClick={(event) => { if (busy) event.preventDefault(); else drawer.current?.close(); }}>
    <Image src="/memoricks-logo.png" alt="" width={180} height={167} priority />
    <span>Memoricks<small>Seu conhecimento, conectado.</small></span>
  </Link>;
  return <>
    {!reviewing && <aside className="app-sidebar">
      {brand}
      <nav className="app-navigation" aria-label="Navegação principal">{links()}</nav>
      <div className="sidebar-note"><AppIcon name="review" /><p>Um pouco hoje.<br />Mais aprendido amanhã.</p></div>
    </aside>}
    <header className="app-topbar" data-review={reviewing || undefined}>
      <div className="topbar-location">
        {!reviewing && <button ref={menuButton} className="icon-button mobile-menu" aria-label="Abrir menu" aria-haspopup="dialog"
          onClick={() => drawer.current?.showModal()}><AppIcon name="menu" /></button>}
        <AppIcon name={reviewing ? "review" : current.icon} /><span>{reviewing ? "Revisão" : current.label}</span>
      </div>
      <div className="topbar-actions">
        <button className="icon-button theme-toggle" onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}>
          <AppIcon name={theme === "dark" ? "sun" : "moon"} />
        </button>
        {onLogout && !reviewing && <div className="account-menu" ref={accountMenu}>
          <button ref={accountButton} className="account-trigger" type="button"
            aria-label="Abrir menu da conta" aria-expanded={accountOpen} aria-controls="account-popover"
            onClick={() => setAccountOpen((open) => !open)}>
            <span className="account-avatar" aria-hidden="true">{initials}</span>
            <span className="account-trigger-copy"><strong>{displayName}</strong><small>Minha conta</small></span>
            <span className="account-chevron" data-open={accountOpen || undefined}><AppIcon name="chevron" /></span>
          </button>
          {accountOpen && <div id="account-popover" className="account-popover" aria-label="Menu da conta">
            <div className="account-summary">
              <span className="account-avatar account-avatar-large" aria-hidden="true">{initials}</span>
              <div><strong>{displayName}</strong><span>{userEmail}</span></div>
            </div>
            <div className="account-provider"><span aria-hidden="true" />Conectado com Google</div>
            <nav className="account-links" aria-label="Atalhos da conta">
              {accountNavigation.map((item) => <Link key={item.href} href={item.href}
                onClick={() => setAccountOpen(false)}>
                <span className="account-link-icon"><AppIcon name={item.icon} /></span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </Link>)}
            </nav>
            <button className="account-logout" type="button" disabled={loggingOut} onClick={handleLogout}>
              <AppIcon name="logout" /><span>{loggingOut ? "Saindo…" : "Sair da conta"}</span>
            </button>
          </div>}
        </div>}
      </div>
    </header>
    {!reviewing && <dialog ref={drawer} className="navigation-drawer" aria-label="Menu de navegação"
      onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className="drawer-heading">{brand}<button className="icon-button" aria-label="Fechar menu" onClick={closeMenu}>×</button></div>
      <nav className="app-navigation" aria-label="Navegação móvel">{links()}</nav>
    </dialog>}
  </>;
}
