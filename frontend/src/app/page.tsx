"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ProfileSettings, ReviewStats, Term } from "@/lib/api";
import { languageName } from "@/lib/languages";
import Modal from "@/components/Modal";
import { TermContentView } from "@/components/TermContent";
import Header from "@/components/Header";
import TermLanguageSelector from "@/components/TermLanguageSelector";

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [isDashboardReady, setIsDashboardReady] = useState(false);

  // New Term Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [termText, setTermText] = useState("");
  const [termLanguage, setTermLanguage] = useState("en");
  const [explanationLanguage, setExplanationLanguage] = useState("pt");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTerms, setRecentTerms] = useState<Term[]>([]);
  const termInput = useRef<HTMLInputElement>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const fetchStats = useCallback(async (learningLanguage?: string) => {
    setIsLoadingStats(true);
    try {
      const data = await api.getStats(learningLanguage);
      setStats(data);
      setDashboardError(null);
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
      setDashboardError(
        "Não foi possível atualizar as estatísticas. Recarregue o painel.",
      );
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        const profileData = await api.getProfile();
        if (!isMounted) return;
        if (!profileData.learning_language_selected) {
          router.replace("/language");
          return;
        }
        const statsData = await api.getStats(profileData.learning_language);
        if (!isMounted) return;
        setProfile(profileData);
        setTermLanguage(profileData.learning_language);
        setExplanationLanguage(profileData.native_language);
        setStats(statsData);
        setIsDashboardReady(true);
      } catch (err) {
        console.error("Erro ao carregar preferências de idioma:", err);
        if (isMounted) {
          setDashboardError(
            "Não foi possível carregar o painel. Verifique a conexão e tente novamente.",
          );
          setIsDashboardReady(true);
        }
      } finally {
        if (isMounted) setIsLoadingStats(false);
      }
    };

    void loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = termText.trim();
    if (!cleanText || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // O backend só persiste o termo depois que a geração terminar com sucesso.
      const newTerm = await api.createTerm(
        cleanText,
        termLanguage,
        explanationLanguage,
      );
      setRecentTerms((prev) => [newTerm, ...prev]);
      setTermText("");
      try {
        const updatedProfile = await api.getProfile();
        setProfile(updatedProfile);
        await fetchStats(updatedProfile.learning_language);
      } catch {
        setDashboardError(
          "O termo foi salvo, mas não foi possível atualizar o painel. Recarregue a página.",
        );
      }
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível cadastrar o termo. Verifique a conexão com o backend.";
      setError(message);
    } finally {
      setIsSubmitting(false);
      requestAnimationFrame(() => termInput.current?.focus());
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setRecentTerms([]);
    setError(null);
  };

  if (!isDashboardReady) {
    return (
      <div className="min-h-screen bg-bg-black text-text-white flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col justify-between selection:bg-brand-blue selection:text-white font-sans antialiased relative transition-premium">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,94,255,0.03),transparent_50%)] pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main Content (Centered Hero) */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-5xl w-full mx-auto px-6 py-20 flex-grow flex flex-col justify-center items-center relative z-10 text-center"
      >
        {dashboardError && (
          <div
            role="alert"
            className="w-full mb-6 rounded-lg border border-brand-red/30 p-4 text-sm text-danger"
          >
            <p>{dashboardError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 underline font-bold"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {/* Pequeno texto: "Bem-vindo de volta" */}
        <span className="text-xs uppercase font-bold tracking-[0.35em] text-text-muted mb-4 block animate-pulse select-none">
          BEM-VINDO DE VOLTA
        </span>

        {/* Título principal enorme: MEMORICKS */}
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-normal leading-none text-text-white mb-5 select-none drop-shadow-sm">
          MEMORICKS
        </h1>

        {/* Linha decorativa sutil usando azul e vermelho abaixo do título */}
        <div className="flex w-32 h-[3px] rounded-full overflow-hidden mb-6 justify-center mx-auto shadow-sm animate-float">
          <div className="w-1/2 bg-brand-blue" />
          <div className="w-1/2 bg-brand-red" />
        </div>

        {/* Subtítulo */}
        <p className="text-text-muted text-sm md:text-base font-medium tracking-wide max-w-xl mb-7 select-none">
          Aprenda. Revise. Lembre. Domine.
        </p>

        <div className="flex items-center gap-2 mb-10 text-xs font-bold uppercase tracking-widest">
          <span className="text-text-muted">Aprendendo</span>
          <span className="text-accent">
            {profile ? languageName(profile.learning_language) : ""}
          </span>
        </div>

        {/* Ações principais (Botões centralizados) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 w-full max-w-md">
          {/* Botão primário: "Revisar agora" */}
          {stats && stats.pending_review > 0 ? (
            <Link
              href="/review"
              className="w-full sm:w-auto px-8 py-4 bg-brand-blue hover:opacity-90 text-white text-xs font-bold tracking-widest uppercase rounded-lg transition-premium hover:scale-[1.03] active:scale-[0.97] shadow-xl shadow-brand-blue/10 flex items-center justify-center gap-2"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17"
                />
              </svg>
              Revisar agora ({stats.pending_review})
            </Link>
          ) : stats && stats.total_active > 0 ? (
            <Link
              href="/review?all=true"
              className="w-full sm:w-auto px-8 py-4 bg-brand-blue hover:opacity-90 text-white text-xs font-bold tracking-widest uppercase rounded-lg transition-premium hover:scale-[1.03] active:scale-[0.97] shadow-xl shadow-brand-blue/10 flex items-center justify-center gap-2"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17"
                />
              </svg>
              Revisar tudo de novo
            </Link>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-8 py-4 bg-bg-medium text-text-muted text-xs font-bold tracking-widest uppercase rounded-lg cursor-not-allowed border border-border-custom select-none"
            >
              Nenhum termo ativo
            </button>
          )}

          {/* Botão secundário: "Novo termo" */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-8 py-4 bg-bg-dark hover:bg-bg-medium text-text-white text-xs font-bold tracking-widest uppercase rounded-lg border border-border-custom hover:border-text-muted/30 transition-premium hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center gap-2"
          >
            <svg
              className="w-3.5 h-3.5 text-text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Novo termo
          </button>
        </div>

        {/* Estatísticas Horizontais Minimalistas */}
        <div className="w-full max-w-3xl border-t border-border-custom pt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border-custom select-none">
          {/* Termos Cadastrados */}
          <div className="flex flex-col items-center justify-center text-center p-4">
            <span className="text-3xl font-black tracking-tight text-text-white mb-1">
              {isLoadingStats ? (
                <span className="inline-block w-8 h-8 bg-bg-medium animate-pulse rounded" />
              ) : stats ? (
                stats.total_active +
                stats.mastered_words +
                stats.mastered_expressions
              ) : (
                "—"
              )}
            </span>
            <span className="text-xs uppercase font-bold tracking-[0.2em] text-text-muted">
              TERMOS CADASTRADOS
            </span>
          </div>

          {/* Dominados */}
          <div className="flex flex-col items-center justify-center text-center p-4 pt-8 sm:pt-4">
            <span className="text-3xl font-black tracking-tight text-text-white mb-1">
              {isLoadingStats ? (
                <span className="inline-block w-8 h-8 bg-bg-medium animate-pulse rounded" />
              ) : stats ? (
                stats.mastered_words + stats.mastered_expressions
              ) : (
                "—"
              )}
            </span>
            <span className="text-xs uppercase font-bold tracking-[0.2em] text-text-muted">
              DOMINADOS
            </span>
          </div>

          {/* Revisões Pendentes */}
          <div className="flex flex-col items-center justify-center text-center p-4 pt-8 sm:pt-4">
            <span className="text-3xl font-black tracking-tight text-text-white mb-1">
              {isLoadingStats ? (
                <span className="inline-block w-8 h-8 bg-bg-medium animate-pulse rounded" />
              ) : stats ? (
                stats.pending_review
              ) : (
                "—"
              )}
            </span>
            <span className="text-xs uppercase font-bold tracking-[0.2em] text-text-muted">
              REVISÕES PENDENTES
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-custom py-8 bg-bg-black">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-text-muted gap-4">
          <p>© 2026 Memoricks — Sistema de memorização inteligente.</p>
          <div className="flex gap-4 items-center">
            <span className="cursor-default">Interface Premium</span>
            <span>•</span>
            <span className="cursor-default">Estilo Minimalista</span>
          </div>
        </div>
      </footer>

      {/* Modal "+ Novo Termo" com Backdrop Blur */}
      {isModalOpen && (
        <Modal
          initialFocusRef={termInput}
          titleId="new-term-title"
          onClose={closeModal}
          busy={isSubmitting}
        >
          {/* Botão de Fechar */}
          <button
            onClick={closeModal}
            disabled={isSubmitting}
            aria-label="Fechar cadastro de termo"
            className="absolute top-5 right-5 text-text-muted hover:text-text-white transition-colors p-1"
          >
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
          </button>

          {/* Título do Modal */}
          <h2
            id="new-term-title"
            className="text-lg font-bold text-text-white mb-6 flex items-center gap-2.5"
          >
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Adicionar Novo Termo
          </h2>

          {/* Formulário */}
          <form onSubmit={handleCreateTerm} className="space-y-6">
            <TermLanguageSelector
              termLanguage={termLanguage}
              explanationLanguage={explanationLanguage}
              onTermLanguageChange={setTermLanguage}
              onExplanationLanguageChange={setExplanationLanguage}
              disabled={isSubmitting}
            />

            <div>
              <label
                htmlFor="new-term-text"
                className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2"
              >
                Palavra ou Expressão
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="new-term-text"
                  ref={termInput}
                  maxLength={300}
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={termText}
                  onChange={(e) => setTermText(e.target.value)}
                  placeholder={`Digite o termo em ${languageName(termLanguage)}`}
                  className="flex-1 min-w-0 bg-bg-black border border-border-custom rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-brand-blue text-text-white placeholder-text-muted/40 transition-premium"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !termText.trim()}
                  className="bg-brand-blue hover:opacity-90 text-white font-bold px-5 py-3 rounded-lg transition-premium disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider flex items-center gap-2 shadow-md shadow-brand-blue/10"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Alerta de Erro */}
          {error && (
            <div
              role="alert"
              className="mt-4 p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-danger flex items-start gap-2.5 text-xs animate-fade-in leading-relaxed"
            >
              <svg
                className="w-4.5 h-4.5 text-red-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-bold mb-0.5">Cadastro não concluído:</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {isSubmitting && (
            <p role="status" className="mt-4 text-sm text-text-muted">
              Gerando conteúdo. Aguarde para cadastrar o próximo termo.
            </p>
          )}
          {recentTerms.length > 0 && (
            <div className="mt-6 space-y-5">
              <p role="status" className="text-sm font-bold text-accent">
                Termo cadastrado com sucesso.
              </p>
              {recentTerms.map((term) => (
                <article
                  key={term.id}
                  className="rounded-xl border border-border-custom p-4 space-y-4"
                >
                  <h3
                    className="text-xl font-bold break-words"
                    lang={term.learning_language}
                    dir="auto"
                  >
                    {term.text}
                  </h3>
                  <TermContentView term={term} />
                </article>
              ))}
              <div className="flex flex-wrap justify-between gap-3">
                <Link
                  href="/review"
                  aria-disabled={isSubmitting}
                  tabIndex={isSubmitting ? -1 : 0}
                  onClick={(event) => {
                    if (isSubmitting) event.preventDefault();
                  }}
                  className="text-sm text-accent font-bold py-2"
                >
                  Ir para revisões
                </Link>
                <button
                  type="button"
                  onClick={() => termInput.current?.focus()}
                  className="text-sm text-text-muted py-2"
                >
                  Adicionar outro
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
