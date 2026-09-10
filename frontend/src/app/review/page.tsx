"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, Term, termIsReviewable } from "@/lib/api";
import { languageName } from "@/lib/languages";
import { TermContentView } from "@/components/TermContent";
import Header from "@/components/Header";
import TranslationQuizReview from "@/components/TranslationQuizReview";

type ReviewMode = "flashcards" | "translationQuiz";

export default function ReviewPage() {
  const [reviewMode, setReviewMode] = useState<ReviewMode>("flashcards");
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCustomReview, setIsCustomReview] = useState(false);

  const saving = useRef(false);
  const [isQuizSaving, setIsQuizSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Track statistics for the current session
  const [sessionCount, setSessionCount] = useState(0);

  const requestVersion = useRef(0);
  const cancelRequests = useCallback(() => {
    requestVersion.current++;
  }, []);

  const loadTerms = useCallback(async (practice: boolean) => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const data = await (practice ? api.getActive() : api.getPending());
      if (version !== requestVersion.current) return;
      const available = data.filter(termIsReviewable);
      if (practice) {
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [available[i], available[j]] = [available[j], available[i]];
        }
        if (available.length === 0)
          setError(
            "Nenhum termo está pronto para praticar. Adicione ou complete o conteúdo dos termos em estudo.",
          );
      }
      setTerms(available);
      setSessionCount(available.length);
      setCurrentIdx(0);
      setIsFlipped(false);
      setIsCustomReview(practice);
    } catch (error) {
      if (version === requestVersion.current)
        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a revisão.",
        );
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, []);

  const fetchPendingTerms = () => loadTerms(false);
  const fetchActiveTermsForReview = () => loadTerms(true);

  useEffect(() => {
    // Loading state belongs to this asynchronous initial request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTerms(
      new URLSearchParams(window.location.search).get("all") === "true",
    );
    return cancelRequests;
  }, [loadTerms, cancelRequests]);

  const handleFlip = () => {
    if (!saving.current) setIsFlipped((flipped) => !flipped);
  };

  const handleAction = async (
    action: "difficult" | "medium" | "easy" | "master",
  ) => {
    const term = terms[currentIdx];
    if (!term || saving.current || !isFlipped) return;
    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.reviewTerm(term.id, action);
      setIsFlipped(false);
      if (currentIdx + 1 < terms.length) {
        setCurrentIdx((index) => index + 1);
        requestAnimationFrame(() => cardRef.current?.focus());
      } else {
        setTerms([]);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  const switchToFlashcards = () => {
    setReviewMode("flashcards");
    void fetchPendingTerms();
  };

  const currentTerm = terms[currentIdx];
  const progressPercent =
    sessionCount > 0 ? (currentIdx / sessionCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col justify-between selection:bg-brand-blue selection:text-white font-sans antialiased relative transition-premium">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,94,255,0.02),transparent_60%)] pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-xl w-full mx-auto px-6 py-10 flex-grow flex flex-col justify-center relative z-10"
      >
        <div className="mb-8 grid grid-cols-2 gap-2 rounded-xl border border-border-custom bg-bg-dark p-1">
          <button
            type="button"
            disabled={isSaving || isQuizSaving}
            aria-pressed={reviewMode === "flashcards"}
            onClick={switchToFlashcards}
            className={`rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-widest transition-premium ${
              reviewMode === "flashcards"
                ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/10"
                : "text-text-muted hover:text-text-white hover:bg-bg-medium"
            }`}
          >
            Flashcards
          </button>
          <button
            type="button"
            disabled={isSaving || isQuizSaving}
            aria-pressed={reviewMode === "translationQuiz"}
            onClick={() => setReviewMode("translationQuiz")}
            className={`rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-widest transition-premium ${
              reviewMode === "translationQuiz"
                ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/10"
                : "text-text-muted hover:text-text-white hover:bg-bg-medium"
            }`}
          >
            Quiz de tradução
          </button>
        </div>

        {reviewMode === "translationQuiz" ? (
          <TranslationQuizReview
            onSwitchToFlashcards={switchToFlashcards}
            onSavingChange={setIsQuizSaving}
          />
        ) : (
          <>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                <p className="text-xs text-text-muted animate-pulse">
                  Buscando termos agendados...
                </p>
              </div>
            ) : error ? (
              <div className="p-8 border border-border-custom bg-bg-dark rounded-2xl text-center w-full shadow-2xl">
                <div className="w-14 h-14 rounded-xl bg-bg-medium flex items-center justify-center mb-6 text-text-muted mx-auto">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-bold mb-3 text-text-white">
                  Erro na Fila
                </h3>
                <p className="text-text-muted text-xs mb-6 leading-relaxed">
                  {error}
                </p>
                <Link
                  href="/"
                  className="inline-block text-center bg-brand-blue hover:opacity-90 px-5 py-2.5 rounded-lg text-xs font-bold text-white transition-premium"
                >
                  Voltar ao Dashboard
                </Link>
              </div>
            ) : terms.length === 0 ? (
              // Empty state / Session completed successfully
              <div className="p-8 border border-border-custom bg-bg-dark rounded-2xl text-center w-full shadow-2xl animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />

                <div className="w-14 h-14 rounded-full bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center mb-6 mx-auto text-accent">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>

                <h2 className="text-xl font-bold mb-2 text-text-white">
                  {sessionCount > 0
                    ? "Sessão concluída!"
                    : "Nenhuma revisão pendente"}
                </h2>
                <p className="text-text-muted text-xs mb-8 leading-relaxed max-w-xs mx-auto">
                  {sessionCount > 0
                    ? `Você revisou ${sessionCount} termos nesta sessão.`
                    : "Quando chegar o horário, seus termos aparecerão aqui. Você também pode praticar os termos em estudo."}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={fetchActiveTermsForReview}
                    className="rounded-lg bg-brand-blue hover:opacity-90 px-6 py-3 text-xs font-bold text-white transition-premium hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Revisar Novamente
                  </button>
                  <Link
                    href="/"
                    className="inline-block rounded-lg border border-border-custom bg-bg-black hover:bg-bg-dark px-6 py-3 text-xs font-bold text-text-muted hover:text-text-white transition-premium"
                  >
                    Voltar ao Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              // Active review card layout
              <div className="flex flex-col items-center w-full">
                {/* Header counters */}
                <div className="w-full mb-4 flex justify-between items-center text-xs text-text-muted">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">
                      Termo {currentIdx + 1} de {terms.length}
                    </span>
                    {isCustomReview && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-brand-blue/10 text-accent border border-brand-blue/20 font-bold uppercase tracking-wider">
                        Modo Prática
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-bg-dark border border-border-custom text-text-muted font-medium">
                      Dificuldade:{" "}
                      {currentTerm.difficulty_level === "Difficult"
                        ? "Difícil"
                        : currentTerm.difficulty_level === "Medium"
                          ? "Médio"
                          : "Fácil"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-bg-dark border border-border-custom text-text-muted uppercase font-bold tracking-wider">
                      {currentTerm.type === "word" ? "Palavra" : "Expressão"}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-bg-medium rounded-full mb-8 overflow-hidden">
                  <div
                    className="h-full bg-brand-blue rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Card Perspective */}
                <div
                  ref={cardRef}
                  key={currentTerm.id}
                  role="group"
                  tabIndex={-1}
                  aria-label={`${isFlipped ? "Resposta" : "Pergunta"}: ${currentTerm.text}`}
                  className="card-perspective w-full h-[480px] mb-8 rounded-2xl"
                >
                  <div
                    className={`card-inner ${isFlipped ? "card-flipped" : ""}`}
                  >
                    {/* Front Side */}
                    <button
                      type="button"
                      onClick={handleFlip}
                      tabIndex={isFlipped ? -1 : 0}
                      inert={isFlipped}
                      aria-hidden={isFlipped}
                      className="card-front bg-bg-dark border border-border-custom hover:border-brand-blue/30 shadow-2xl justify-center items-center p-6 text-center transition-premium"
                    >
                      <span className="absolute top-5 left-5 text-xs font-bold uppercase tracking-widest text-accent bg-brand-blue/5 px-2.5 py-0.5 rounded border border-brand-blue/10">
                        Termo em {languageName(currentTerm.learning_language)}
                      </span>
                      <p
                        lang={currentTerm.learning_language}
                        dir="auto"
                        className="text-3xl font-extrabold text-text-white leading-relaxed tracking-tight break-words max-w-full px-4"
                      >
                        {currentTerm.text}
                      </p>
                      <div className="absolute bottom-5 text-xs text-text-muted flex items-center gap-1.5 animate-pulse">
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
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                        Clique para revelar a tradução e explicações
                      </div>
                    </button>

                    {/* Back Side (Explanation) */}
                    <div
                      inert={!isFlipped}
                      aria-hidden={!isFlipped}
                      className="card-back bg-bg-dark border border-border-custom hover:border-brand-blue/30 shadow-2xl p-6 text-left flex flex-col justify-between overflow-y-auto transition-premium"
                    >
                      <div>
                        {/* Header reference */}
                        <div className="flex justify-between items-center border-b border-border-custom pb-3 mb-4">
                          <h3 className="text-lg font-bold text-text-white ">
                            {currentTerm.text}
                          </h3>
                          <span className="text-xs font-bold text-accent uppercase tracking-widest bg-brand-blue/5 px-2.5 py-0.5 rounded border border-brand-blue/10">
                            Resposta (IA)
                          </span>
                        </div>

                        <TermContentView term={currentTerm} />
                      </div>

                      <button
                        type="button"
                        onClick={handleFlip}
                        className="text-center text-xs text-text-muted mt-4 py-3 border-t border-border-custom"
                      >
                        Voltar à pergunta
                      </button>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                {saveError && (
                  <p role="alert" className="mb-4 text-sm text-danger">
                    {saveError}
                  </p>
                )}
                {isSaving && (
                  <p role="status" className="mb-3 text-sm text-text-muted">
                    Salvando revisão...
                  </p>
                )}
                <div className="w-full flex flex-col gap-3">
                  {!isFlipped ? (
                    <button
                      onClick={handleFlip}
                      className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-4 rounded-lg shadow-lg shadow-brand-blue/10 transition-premium active:scale-[0.98] text-xs uppercase tracking-widest"
                    >
                      Revelar Explicação
                    </button>
                  ) : (
                    <div className="space-y-3 w-full">
                      {/* Spaced repetition buttons */}
                      <div className="flex gap-2 w-full">
                        <button
                          disabled={isSaving}
                          onClick={() => handleAction("difficult")}
                          className="flex-1 bg-brand-red/10 hover:bg-brand-red text-danger hover:text-white font-bold py-3.5 rounded-lg border border-brand-red/20 transition-premium hover:scale-[1.01] active:scale-[0.99] text-xs uppercase tracking-wider"
                          title="Termo difícil. Aparecerá novamente em breve (5 minutos)."
                        >
                          Difícil (5m)
                        </button>
                        <button
                          disabled={isSaving}
                          onClick={() => handleAction("medium")}
                          className="flex-1 bg-bg-medium hover:opacity-90 text-text-muted hover:text-text-white font-bold py-3.5 rounded-lg border border-border-custom transition-premium hover:scale-[1.01] active:scale-[0.99] text-xs uppercase tracking-wider"
                          title="Termo médio. Frequência reduzida (1 hora)."
                        >
                          Médio (1h)
                        </button>
                        <button
                          disabled={isSaving}
                          onClick={() => handleAction("easy")}
                          className="flex-1 bg-brand-blue/10 hover:bg-brand-blue text-accent hover:text-white font-bold py-3.5 rounded-lg border border-brand-blue/20 transition-premium hover:scale-[1.01] active:scale-[0.99] text-xs uppercase tracking-wider"
                          title="Termo fácil. Aparecerá em 1 dia."
                        >
                          Fácil (1d)
                        </button>
                      </div>

                      {/* Complete master button */}
                      {currentTerm.difficulty_level === "Easy" && (
                        <button
                          disabled={isSaving}
                          onClick={() => handleAction("master")}
                          className="w-full py-4 rounded-lg font-bold text-xs tracking-widest uppercase bg-text-white text-bg-black hover:opacity-90 transition-premium hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 border border-border-custom shadow-sm"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                            />
                          </svg>
                          Dominei Completamente
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
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
