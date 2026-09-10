"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, Term } from "@/lib/api";
import TermContent from "@/components/TermContent";
import { formatDate } from "@/lib/dates";
import Header from "@/components/Header";

export default function MasteredPage() {
  const [activeTab, setActiveTab] = useState<"word" | "expression">("word");
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which card is currently expanded to view details
  const [expandedTermId, setExpandedTermId] = useState<number | null>(null);

  const requestId = useRef(0);

  const fetchMasteredTerms = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    setExpandedTermId(null);
    try {
      const data = await api.getMastered(activeTab);
      if (id === requestId.current) setTerms(data);
    } catch (err) {
      console.error(err);
      if (id === requestId.current)
        setError(
          "Erro ao buscar termos dominados. Verifique se o backend está sendo executado.",
        );
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [activeTab]);

  const cancelRequests = useCallback(() => {
    requestId.current++;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMasteredTerms();
    return cancelRequests;
  }, [fetchMasteredTerms, cancelRequests]);

  const toggleExpand = (id: number) => {
    setExpandedTermId((prev) => (prev === id ? null : id));
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
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            Termos Aprendidos
          </h1>
          <p className="text-text-muted text-xs mt-1">
            Sua base de conhecimento de palavras e expressões dominadas.
          </p>
        </div>

        {/* Custom Tabs */}
        <div className="flex border-b border-border-custom mb-8 gap-6 select-none">
          <button
            aria-pressed={activeTab === "word"}
            onClick={() => setActiveTab("word")}
            className={`pb-3 font-bold text-xs tracking-wider uppercase border-b-2 transition-premium relative ${activeTab === "word" ? "border-brand-blue text-text-white" : "border-transparent text-text-muted hover:text-text-white"}`}
          >
            Palavras
          </button>
          <button
            aria-pressed={activeTab === "expression"}
            onClick={() => setActiveTab("expression")}
            className={`pb-3 font-bold text-xs tracking-wider uppercase border-b-2 transition-premium relative ${activeTab === "expression" ? "border-brand-blue text-text-white" : "border-transparent text-text-muted hover:text-text-white"}`}
          >
            Expressões
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border border-red-500/20 bg-red-500/10 text-danger flex items-center justify-between gap-3 text-xs">
            <p>{error}</p>
            <button
              onClick={fetchMasteredTerms}
              className="font-bold underline hover:text-white uppercase tracking-wider text-xs"
            >
              Tentar Recarregar
            </button>
          </div>
        )}

        {/* Content list */}
        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
            <p className="text-xs text-text-muted animate-pulse">
              Buscando termos na base...
            </p>
          </div>
        ) : error && terms.length === 0 ? null : terms.length === 0 ? (
          // Empty Tab state
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
            <h3 className="text-sm font-bold mb-1 text-text-white">
              Nenhum item dominado
            </h3>
            <p className="text-text-muted text-xs max-w-xs mb-6 leading-relaxed">
              Você ainda não tem{" "}
              {activeTab === "word" ? "palavras" : "expressões"} marcadas como
              dominadas. Estude seus termos na fila de revisão!
            </p>
            <Link
              href="/"
              className="rounded-lg border border-border-custom bg-bg-black hover:bg-bg-dark px-5 py-2.5 text-xs font-bold text-text-muted hover:text-text-white transition-premium uppercase tracking-widest"
            >
              Voltar ao Início
            </Link>
          </div>
        ) : (
          // List layout
          <div className="space-y-3">
            {terms.map((term) => {
              const isExpanded = expandedTermId === term.id;
              return (
                <div
                  key={term.id}
                  className={`border rounded-xl overflow-hidden transition-premium bg-bg-dark ${isExpanded ? "border-brand-blue/30 shadow-lg shadow-brand-blue/5" : "border-border-custom hover:border-text-muted/20"}`}
                >
                  {/* Row Header */}
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`term-content-${term.id}`}
                    onClick={() => toggleExpand(term.id)}
                    className="w-full text-left p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-bg-medium/40 transition-premium"
                  >
                    <div>
                      <h3 className="text-base font-bold text-text-white tracking-tight">
                        {term.text}
                      </h3>
                      <p className="text-text-muted text-xs mt-1 truncate max-w-md">
                        {term.generated_content.meaning}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-text-muted md:self-center">
                      <div>
                        <span className="text-xs text-text-muted/60 uppercase tracking-wider block">
                          Cadastrado
                        </span>
                        <span className="font-semibold">
                          {formatDate(term.created_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-text-muted/60 uppercase tracking-wider block">
                          Dominado
                        </span>
                        <span className="font-semibold text-emerald-500">
                          {formatDate(term.mastered_at)}
                        </span>
                      </div>
                      <div className="text-text-muted">
                        {isExpanded ? (
                          <svg
                            className="w-3.5 h-3.5 transform rotate-180 transition-transform duration-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5 transition-transform duration-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>

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
