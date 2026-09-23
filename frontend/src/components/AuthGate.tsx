"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Header from "./Header";
import "./auth.css";

const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

type Account = { mode: "local" | "accounts"; email?: string; name?: string };
type GoogleResponse = { credential: string };
type GoogleIdentity = {
  initialize: (options: { client_id: string; nonce: string; callback: (response: GoogleResponse) => void }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; width: number; shape: string }) => void;
};

declare global {
  interface Window { google?: { accounts: { id: GoogleIdentity } } }
}

let googleScript: Promise<void> | undefined;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScript) {
    googleScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => {
        if (window.google?.accounts?.id) resolve();
        else {
          script.remove();
          reject(new Error("Não foi possível carregar o login Google."));
        }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Não foi possível carregar o login Google."));
      };
      document.head.appendChild(script);
    }).catch((reason) => { googleScript = undefined; throw reason; });
  }
  return googleScript;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLDivElement>(null);
  const googleSetup = useRef<Promise<string> | null>(null);
  const [googleAttempt, setGoogleAttempt] = useState(0);
  const authBusy = useRef(false);

  function retryGoogle() {
    googleSetup.current = null;
    setGoogleError("");
    setGoogleAttempt((attempt) => attempt + 1);
  }

  useEffect(() => {
    let canceled = false;
    fetch(`${BASE}/auth/me`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (canceled) return;
        if (response.ok) setAccount(await response.json());
        else if (response.status !== 401) setError("Não foi possível verificar sua conta. Tente atualizar a página.");
      })
      .catch(() => { if (!canceled) setError("Não foi possível conectar ao Memoricks."); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (loading || account || !CLIENT_ID || !button.current) return;
    button.current.replaceChildren();
    // Share pending setup between effect replays, but let the active effect
    // render the button. A canceled effect must not permanently block login.
    if (!googleSetup.current) {
      googleSetup.current = (async () => {
        const challenge = await fetch(`${BASE}/auth/challenge`, {
          credentials: "include", cache: "no-store", signal: AbortSignal.timeout(20_000),
        });
        if (!challenge.ok) throw new Error("Não foi possível iniciar o login.");
        const { nonce } = await challenge.json();
        await loadGoogle();
        return nonce as string;
      })();
    }
    const pendingSetup = googleSetup.current;
    let canceled = false;
    async function setup() {
      try {
        const nonce = await pendingSetup;
        if (canceled || !button.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce,
          callback: async ({ credential }) => {
            if (canceled || authBusy.current) return;
            authBusy.current = true;
            setBusy(true);
            setGoogleError("");
            try {
              const response = await fetch(`${BASE}/auth/google`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json", "X-Memoricks-Request": "1" },
                body: JSON.stringify({ credential, nonce }),
                signal: AbortSignal.timeout(20_000),
              });
              if (!response.ok) {
                const body = await response.json();
                throw new Error(typeof body.detail === "string" ? body.detail : "Não foi possível entrar com o Google.");
              }
              setAccount(await response.json());
            } catch (reason) {
              setGoogleError(reason instanceof Error ? reason.message : "Falha no login.");
            } finally { authBusy.current = false; setBusy(false); }
          },
        });
        window.google.accounts.id.renderButton(button.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", width: Math.min(380, button.current.clientWidth) });
      } catch (reason) {
        if (!canceled) setGoogleError(reason instanceof Error ? reason.message : "Falha no login.");
      }
    }
    void setup();
    return () => { canceled = true; };
  }, [loading, account, googleAttempt]);

  async function logout() {
    await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include", headers: { "X-Memoricks-Request": "1" } });
    window.location.reload();
  }

  if (loading) return <main className="auth-loading" aria-live="polite">Carregando Memoricks…</main>;
  if (!account) return <main id="main-content" className="auth-page">
    <div className="auth-shell">
      <section className="auth-story" aria-label="Sobre o Memoricks">
        <div className="auth-brand"><Image src="/memoricks-logo.png" alt="" width={180} height={167} priority /><span>Memoricks<span className="auth-brand-dot">.</span></span></div>
        <div className="auth-story-copy"><span className="auth-eyebrow"><i /> UM POUCO TODOS OS DIAS</span>
          <h1>Aprenda hoje.<br /><span>Lembre amanhã.</span></h1>
          <p>Transforme o que você estuda em conhecimento que fica. Um card de cada vez.</p>
        </div>
        <div className="auth-card-scene" aria-hidden="true">
          <div className="auth-card-back" />
          <div className="auth-demo-card"><div className="auth-demo-top"><span>REVISÃO DO DIA</span><span>01 / 12</span></div>
            <div className="auth-demo-tag">Aprender a aprender</div>
            <h2>Como fazer uma ideia<br />ficar na memória?</h2>
            <p>Revisite o que aprendeu.<br />Dê tempo ao tempo. Repita.</p>
            <div className="auth-demo-bottom"><span><b>✓</b> Um passo a mais</span><span>↗</span></div>
          </div>
        </div>
        <div className="auth-story-footer"><span>Organize.</span><span>Revise.</span><span>Evolua.</span><div>Seu conhecimento, conectado.</div></div>
      </section>
      <section className="auth-form-panel" aria-labelledby="auth-title">
        <div className="auth-form-inner">
          <div className="auth-form-heading"><h2 id="auth-title">Seu conhecimento começa aqui.</h2>
            <p>Entre com o Google para acessar seus temas e cards.</p></div>
          {CLIENT_ID ? <>
            <div ref={button} className="auth-google" inert={busy} />
            {busy && <p className="auth-form-footer" role="status">Entrando…</p>}
            {googleError && <><p className="auth-error" role="alert">{googleError}</p><button className="auth-retry" type="button" disabled={busy} onClick={retryGoogle}>Tentar Google novamente</button></>}
          </> : <p className="auth-error" role="alert">O acesso com Google ainda não foi configurado. Entre em contato com o responsável pelo Memoricks.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <p className="auth-form-footer">Primeira vez? Sua conta é criada automaticamente ao continuar.</p>
          <p className="auth-form-footer">Um espaço só seu para aprender no seu ritmo.</p>
        </div>
      </section>
    </div>
  </main>;
  return <>
    <Header userEmail={account.email} userName={account.name} onLogout={account.mode === "accounts" ? logout : undefined} />
    <div className="app-workspace">{children}</div>
  </>;
}
