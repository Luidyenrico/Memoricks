"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, Term, termHasGenerationError } from "@/lib/api";
import TermContent from "@/components/TermContent";
import { reviewDueLabel } from "@/lib/dates";
import { languageName } from "@/lib/languages";
import Header from "@/components/Header";
import TermLanguageSelector from "@/components/TermLanguageSelector";

export default function ActiveTermsPage() {
  const termInput = useRef<HTMLInputElement>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<number | null>(null);
  const [deletingTermId, setDeletingTermId] = useState<number | null>(null);

  // Form states for creating terms in active tab
  const [termText, setTermText] = useState("");
  const [termLanguage, setTermLanguage] = useState("en");
  const [explanationLanguage, setExplanationLanguage] = useState("pt");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([api.getActive(), api.getProfile()])
      .then(([data, profile]) => {
        if (!active) return;
        setTerms(data);
        setTermLanguage(profile.learning_language);
        setExplanationLanguage(profile.native_language);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar os termos e suas preferências. Tente novamente.",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = termText.trim();
    if (!cleanText || isSubmitting) return;

    setIsSubmitting(true);
    setFormError(null);
    setSuccess(null);

    try {
      const newTerm = await api.createTerm(
        cleanText,
        termLanguage,
        explanationLanguage,
      );

      setTermText("");

      setSuccess(`“${newTerm.text}” cadastrado com sucesso.`);
      // Keep the selected-language list coherent after creating in another language.
      await fetchActiveTerms();
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao cadastrar termo. Verifique se já existe.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
      requestAnimationFrame(() => termInput.current?.focus());
    }
  };

  async function fetchActiveTerms() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getActive();
      setTerms(data);
    } catch (err) {
      console.error(err);
      setError(
        "Erro ao buscar termos em estudo. Verifique se o backend está ativo.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteTerm = async (termId: number) => {
    if (deletingTermId !== null) return;
    if (
      !confirm(
        "Tem certeza de que deseja excluir este termo? O progresso de memorização dele será perdido.",
      )
    )
      return;
    setDeletingTermId(termId);
    setError(null);
    try {
      await api.deleteTerm(termId);
      if (expandedTermId === termId) {
        setExpandedTermId(null);
      }
      // Atualiza localmente removendo da lista
      setTerms((prev) => prev.filter((t) => t.id !== termId));
    } catch (err) {
      console.error("Erro ao excluir termo:", err);
      setError("Não foi possível excluir o termo. Tente novamente.");
    } finally {
      setDeletingTermId(null);
    }
  };

  const getReviewStatus = (term: Term) => {
    if (termHasGenerationError(term)) {
      return {
        text: "Falha na geração",
        style: "bg-brand-red/10 text-danger border border-brand-red/20 text-xs",
      };
    }
    if (term.generated_content.meaning === "") {
      return {
        text: "Conteúdo incompleto",
        style:
          "bg-brand-blue/10 text-accent border border-brand-blue/20 text-xs",
      };
    }
    return {
      text: reviewDueLabel(term.next_review_date),
      style: "bg-bg-medium text-text-muted border border-border-custom text-xs",
    };
  };

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col justify-between selection:bg-brand-blue selection:text-white font-sans antialiased relative transition-premium">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,94,255,0.02),transparent_60%)] pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-4xl w-full mx-auto px-6 py-10 flex-grow flex flex-col relative z-10"
      >
        {/* Page title */}
        <div className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2.5">
              <svg
                className="w-6 h-6 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Termos em Estudo
            </h1>
            <p className="text-text-muted text-xs mt-1">
              Sua lista de palavras e expressões sendo memorizadas.
            </p>
          </div>
          <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-blue/10 text-accent border border-brand-blue/20 self-center select-none">
            {isLoading && terms.length === 0
              ? "Carregando..."
              : `${terms.length} Termos Ativos`}
          </div>
        </div>

        {/* Formulário de Cadastro Rápido na Aba Em Estudo */}
        <div className="mb-8 p-6 bg-bg-dark border border-border-custom rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl pointer-events-none" />

          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5 select-none">
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Adicionar Novo Termo
          </h2>
          <form onSubmit={handleCreateTerm} className="space-y-3">
            <TermLanguageSelector
              termLanguage={termLanguage}
              explanationLanguage={explanationLanguage}
              onTermLanguageChange={setTermLanguage}
              onExplanationLanguageChange={setExplanationLanguage}
              disabled={isSubmitting || isLoading}
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={termInput}
                aria-label="Palavra ou expressão"
                maxLength={300}
                type="text"
                required
                disabled={isSubmitting || isLoading}
                value={termText}
                onChange={(e) => setTermText(e.target.value)}
                placeholder={`Digite o termo em ${languageName(termLanguage)}`}
                className="flex-1 min-w-0 bg-bg-black border border-border-custom rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-brand-blue text-text-white placeholder-text-muted/40 transition-premium"
              />
              <button
                type="submit"
                disabled={isSubmitting || isLoading || !termText.trim()}
                className="bg-brand-blue hover:opacity-90 text-white font-bold px-5 py-2.5 rounded-lg transition-premium disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-2 shadow-lg shadow-brand-blue/10 uppercase tracking-widest"
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
          </form>

          {success && (
            <p role="status" className="mt-3 text-sm text-accent">
              {success}
            </p>
          )}
          {formError && (
            <p
              role="alert"
              className="mt-2 text-xs font-bold text-danger animate-fade-in"
            >
              {formError}
            </p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div
            role="alert"
            className="mb-8 p-4 rounded-lg border border-red-500/20 bg-red-500/10 text-danger flex items-center justify-between gap-3 text-xs"
          >
            <p>{error}</p>
            <button
              onClick={fetchActiveTerms}
              className="font-bold underline hover:text-white uppercase tracking-wider text-xs"
            >
              Tentar Recarregar
            </button>
          </div>
        )}

        {/* Content list */}
        {isLoading && terms.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
            <p className="text-xs text-text-muted animate-pulse">
              Buscando termos sob estudo...
            </p>
          </div>
        ) : error && terms.length === 0 ? null : terms.length === 0 ? (
          // Empty state
          <div className="py-20 px-6 border border-border-custom rounded-2xl text-center bg-bg-dark max-w-xl mx-auto w-full flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-bg-medium flex items-center justify-center mb-4 text-text-muted">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-sm font-bold mb-1">Nenhum termo ativo</h3>
            <p className="text-text-muted text-xs max-w-xs mb-6 leading-relaxed">
              Você não possui palavras ou expressões sendo estudadas no momento.
            </p>
            <Link
              href="/"
              className="rounded-lg bg-brand-blue hover:opacity-90 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-blue/10 uppercase tracking-widest"
            >
              Adicionar Novo Termo
            </Link>
          </div>
        ) : (
          // List layout
          <div className="space-y-3">
            {terms.map((term) => {
              const isExpanded = expandedTermId === term.id;
              const status = getReviewStatus(term);

              return (
                <div
                  key={term.id}
                  className={`border rounded-xl overflow-hidden transition-premium bg-bg-dark ${isExpanded ? "border-brand-blue/30 shadow-lg shadow-brand-blue/5" : "border-border-custom hover:border-text-muted/20"}`}
                >
                  {/* Row Header */}
                  <div className="p-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`term-content-${term.id}`}
                      onClick={() =>
                        setExpandedTermId(isExpanded ? null : term.id)
                      }
                      className="w-full sm:w-auto sm:flex-1 min-w-0 text-left py-2"
                    >
                      <span
                        className="block text-base font-bold break-words"
                        lang={term.learning_language}
                        dir="auto"
                      >
                        {term.text}
                      </span>
                      <span className="text-xs text-text-muted">
                        {term.type === "word" ? "Palavra" : "Expressão"} ·{" "}
                        {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                      </span>
                    </button>
                    <span
                      className={`mr-auto sm:mr-0 px-2.5 py-1 rounded font-bold ${status.style}`}
                    >
                      {status.text}
                    </span>
                    <button
                      type="button"
                      disabled={deletingTermId !== null}
                      onClick={() => void handleDeleteTerm(term.id)}
                      aria-label={`Excluir ${term.text}`}
                      className="p-3 rounded-lg text-text-muted hover:text-danger border border-border-custom text-xs"
                    >
                      {deletingTermId === term.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>

                  {/* Expanded AI Details */}
                  <div
                    hidden={!isExpanded}
                    id={`term-content-${term.id}`}
                    className="px-5 pb-5 border-t border-border-custom pt-5 bg-bg-black/20 animate-fade-in text-xs space-y-4"
                  >
                    <TermContent
                      expanded={isExpanded}
                      term={term}
                      onUpdated={(updated) =>
                        setTerms((current) =>
                          current.map((item) =>
                            item.id === updated.id ? updated : item,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-custom py-6 bg-bg-black mt-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row gap-3 justify-between items-center text-xs text-text-muted">
          <p>© 2026 Memoricks - Seu sistema pessoal de memorização.</p>
          <Link
            href="/"
            className="hover:text-text-white font-bold tracking-wider uppercase"
          >
            Voltar ao Painel
          </Link>
        </div>
      </footer>
    </div>
  );
}
