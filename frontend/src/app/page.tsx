"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, ReviewStats, Term } from "@/lib/api";
import Header from "@/components/Header";

const LOADING_MESSAGES = [
  "Analisando termo...",
  "Gerando explicação...",
  "Criando exemplos...",
  "Finalizando conteúdo...",
  "Preparando revisão..."
];

export default function Home() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  // New Term Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [termText, setTermText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTerms, setRecentTerms] = useState<Term[]>([]);
  const [cancelingTermIds, setCancelingTermIds] = useState<Set<number>>(new Set());
  
  // Asynchronous Loading States
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const hasProcessingTerms = recentTerms.some((term) => term.generated_content.meaning === "");

  // Polling para carregar conteúdo da IA em segundo plano do termo recém-adicionado
  useEffect(() => {
    if (!hasProcessingTerms) {
      return;
    }

    const poll = async () => {
      try {
        const processingTerms = recentTerms.filter((term) => term.generated_content.meaning === "");
        const results = await Promise.allSettled(
          processingTerms.map((term) => api.getTerm(term.id))
        );
        const updates = new Map<number, Term>();

        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            updates.set(processingTerms[index].id, result.value);
          }
        });

        const shouldRefreshStats = Array.from(updates.values()).some(
          (term) => term.generated_content.meaning !== ""
        );
        // Quando a IA preencher o significado no banco de dados, interrompe o polling
        if (updates.size > 0) {
          setRecentTerms((prev) =>
            prev.map((term) => updates.get(term.id) ?? term)
          );
          // Atualiza as estatísticas do painel
          if (shouldRefreshStats) {
            fetchStats();
          }
        }
      } catch (err) {
        console.error("Erro ao sincronizar detalhes do termo:", err);
      }
    };

    // Executa a busca a cada 1,5 segundos
    const pollInterval = setInterval(poll, 1500);

    return () => clearInterval(pollInterval);
  }, [hasProcessingTerms, recentTerms]);

  // Rotatividade das mensagens de carregamento da IA
  useEffect(() => {
    if (!hasProcessingTerms) {
      return;
    }

    const messageInterval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(messageInterval);
  }, [hasProcessingTerms]);

  async function fetchStats() {
    setIsLoadingStats(true);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = termText.trim();
    if (!cleanText) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // O backend salva instantaneamente e retorna o placeholder vazio
      const newTerm = await api.createTerm(cleanText);
      setRecentTerms((prev) => [newTerm, ...prev]);
      setTermText("");
      
      // Atualiza o painel de estatísticas imediatamente
      await fetchStats();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Não foi possível cadastrar o termo. Verifique a conexão com o backend.";
      setError(message);
    } finally {
      // O input do usuário é desbloqueado IMEDIATAMENTE após a inserção
      setIsSubmitting(false);
    }
  };

  const handleCancelLoading = async (termId: number) => {
    setCancelingTermIds((prev) => new Set(prev).add(termId));
    setError(null);

    try {
      await api.cancelTermGeneration(termId);
      setRecentTerms((prev) => prev.filter((term) => term.id !== termId));
      await fetchStats();
    } catch (err: unknown) {
      console.error("Erro ao cancelar carregamento:", err);
      const message = err instanceof Error ? err.message : "Não foi possível cancelar o carregamento do termo.";
      setError(message);
    } finally {
      setCancelingTermIds((prev) => {
        const next = new Set(prev);
        next.delete(termId);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col justify-between selection:bg-brand-blue selection:text-white font-sans antialiased relative transition-premium">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,94,255,0.03),transparent_50%)] pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main Content (Centered Hero) */}
      <main className="max-w-5xl w-full mx-auto px-6 py-20 flex-grow flex flex-col justify-center items-center relative z-10 text-center">
        
        {/* Pequeno texto: "Bem-vindo de volta" */}
        <span className="text-[10px] uppercase font-bold tracking-[0.35em] text-text-muted mb-4 block animate-pulse select-none">
          BEM-VINDO DE VOLTA
        </span>

        {/* Título principal enorme: MEMORICKS */}
        <h1 className="text-6xl md:text-8xl font-black tracking-[0.2em] leading-none text-text-white mb-5 select-none drop-shadow-sm pl-[0.2em]">
          MEMORICKS
        </h1>

        {/* Linha decorativa sutil usando azul e vermelho abaixo do título */}
        <div className="flex w-32 h-[3px] rounded-full overflow-hidden mb-6 justify-center mx-auto shadow-sm animate-float">
          <div className="w-1/2 bg-brand-blue" />
          <div className="w-1/2 bg-brand-red" />
        </div>

        {/* Subtítulo */}
        <p className="text-text-muted text-sm md:text-base font-medium tracking-wide max-w-xl mb-12 select-none">
          Aprenda. Revise. Lembre. Domine.
        </p>

        {/* Ações principais (Botões centralizados) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 w-full max-w-md">
          {/* Botão primário: "Revisar agora" */}
          {stats && stats.pending_review > 0 ? (
            <Link
              href="/review"
              className="w-full sm:w-auto px-8 py-4 bg-brand-blue hover:opacity-90 text-white text-xs font-bold tracking-widest uppercase rounded-lg transition-premium hover:scale-[1.03] active:scale-[0.97] shadow-xl shadow-brand-blue/10 flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
              </svg>
              Revisar agora ({stats.pending_review})
            </Link>
          ) : stats && stats.total_active > 0 ? (
            <Link
              href="/review?all=true"
              className="w-full sm:w-auto px-8 py-4 bg-brand-blue hover:opacity-90 text-white text-xs font-bold tracking-widest uppercase rounded-lg transition-premium hover:scale-[1.03] active:scale-[0.97] shadow-xl shadow-brand-blue/10 flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
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
            <svg className="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
              ) : (
                (stats ? stats.total_active + stats.mastered_words + stats.mastered_expressions : 0)
              )}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-text-muted">
              TERMOS CADASTRADOS
            </span>
          </div>

          {/* Dominados */}
          <div className="flex flex-col items-center justify-center text-center p-4 pt-8 sm:pt-4">
            <span className="text-3xl font-black tracking-tight text-text-white mb-1">
              {isLoadingStats ? (
                <span className="inline-block w-8 h-8 bg-bg-medium animate-pulse rounded" />
              ) : (
                (stats ? stats.mastered_words + stats.mastered_expressions : 0)
              )}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-text-muted">
              DOMINADOS
            </span>
          </div>

          {/* Revisões Pendentes */}
          <div className="flex flex-col items-center justify-center text-center p-4 pt-8 sm:pt-4">
            <span className="text-3xl font-black tracking-tight text-text-white mb-1">
              {isLoadingStats ? (
                <span className="inline-block w-8 h-8 bg-bg-medium animate-pulse rounded" />
              ) : (
                (stats ? stats.pending_review : 0)
              )}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-text-muted">
              REVISÕES PENDENTES
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-custom py-8 bg-bg-black">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-[11px] text-text-muted gap-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300">
          <div className="bg-bg-dark border border-border-custom rounded-2xl w-full max-w-lg p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            
            {/* Botão de Fechar */}
            <button
              onClick={() => {
                setIsModalOpen(false);
                setRecentTerms([]);
                setError(null);
                setTermText("");
              }}
              className="absolute top-5 right-5 text-text-muted hover:text-text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Título do Modal */}
            <h2 className="text-lg font-bold text-text-white mb-6 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Novo Termo
            </h2>

            {/* Formulário */}
            <form onSubmit={handleCreateTerm} className="space-y-6">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2">
                  Palavra ou Expressão
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={termText}
                    onChange={(e) => setTermText(e.target.value)}
                    placeholder="Ex: despite, give up, by the way"
                    className="flex-1 bg-bg-black border border-border-custom rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-brand-blue text-text-white placeholder-text-muted/40 transition-premium"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !termText.trim()}
                    className="bg-brand-blue hover:opacity-90 text-white font-bold px-5 py-3 rounded-lg transition-premium disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider flex items-center gap-2 shadow-md shadow-brand-blue/10"
                  >
                    {isSubmitting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Adicionar"
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Alerta de Erro */}
            {error && (
              <div className="mt-4 p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 flex items-start gap-2.5 text-xs animate-fade-in leading-relaxed">
                <svg className="w-4.5 h-4.5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-bold mb-0.5">Falha ao salvar:</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {recentTerms.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                    Termos adicionados agora
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecentTerms((prev) => prev.filter((term) => term.generated_content.meaning === ""))}
                    className="text-[10px] font-bold text-text-muted hover:text-text-white transition-colors"
                  >
                    Limpar concluídos
                  </button>
                </div>

                {recentTerms.map((term) => {
                  const isProcessing = term.generated_content.meaning === "";
                  const isCanceling = cancelingTermIds.has(term.id);

                  return (
                    <div
                      key={term.id}
                      className={`p-5 rounded-xl animate-fade-in ${
                        isProcessing
                          ? "border border-brand-blue/20 bg-brand-blue/5"
                          : "border border-border-custom bg-bg-dark"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-4 border-b border-border-custom pb-2">
                        <span className={`text-xs font-bold flex items-center gap-2 ${isProcessing ? "text-brand-blue" : "text-brand-blue"}`}>
                          {isProcessing ? (
                            <span className="w-3.5 h-3.5 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin flex-shrink-0" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {isProcessing ? LOADING_MESSAGES[loadingMessageIndex] : "Cadastrado com Sucesso"}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase font-bold text-text-muted bg-bg-black px-2.5 py-0.5 rounded border border-border-custom">
                            {term.type === "word" ? "Palavra" : "Expressão"}
                          </span>
                          {isProcessing && (
                            <button
                              type="button"
                              disabled={isCanceling}
                              onClick={() => handleCancelLoading(term.id)}
                              className="text-[9px] uppercase font-bold text-brand-red hover:text-white border border-brand-red/20 hover:bg-brand-red rounded px-2.5 py-0.5 transition-premium disabled:opacity-50"
                            >
                              {isCanceling ? "Cancelando..." : "Cancelar"}
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className={`${isProcessing ? "text-lg font-black mb-4" : "text-xl font-bold mb-4"} text-text-white capitalize`}>
                        {term.text}
                      </h4>

                      {isProcessing ? (
                        <div className="space-y-4 animate-pulse">
                          <div>
                            <div className="h-2.5 w-16 bg-bg-medium rounded mb-1.5" />
                            <div className="h-3 w-3/4 bg-bg-black rounded" />
                          </div>
                          <div>
                            <div className="h-2.5 w-20 bg-bg-medium rounded mb-1.5" />
                            <div className="h-3 w-5/6 bg-bg-black rounded mb-1" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 text-xs">
                          {term.generated_content.translation && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-blue block mb-1">Tradução Direta</span>
                              <p className="text-text-white font-bold text-sm leading-relaxed">
                                {term.generated_content.translation}
                              </p>
                            </div>
                          )}

                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted block mb-1">Significado/Definição</span>
                            <p className="text-text-muted leading-relaxed">
                              {term.generated_content.meaning}
                            </p>
                          </div>

                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted block mb-1">Explicação</span>
                            <p className="text-text-muted leading-relaxed">
                              {term.generated_content.explanation}
                            </p>
                          </div>

                          {term.generated_content.examples && term.generated_content.examples.length > 0 && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-red block mb-2">Exemplos</span>
                              <ul className="space-y-2.5">
                                {term.generated_content.examples.map((ex, i) => (
                                  <li key={i} className="pl-3 border-l border-border-custom leading-relaxed">
                                    <p className="text-text-white font-medium">{ex.en}</p>
                                    <p className="text-text-muted text-[10px] mt-0.5">{ex.pt}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {term.generated_content.tip && (
                            <div className="bg-bg-black p-3 rounded-lg border border-border-custom text-[10px] text-text-muted leading-relaxed">
                              <strong>Dica Rápida:</strong> {term.generated_content.tip}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {recentTerms.some((term) => term.generated_content.meaning !== "") && (
                  <div className="pt-2 flex justify-between items-center">
                    <Link
                      href="/review"
                      onClick={() => setIsModalOpen(false)}
                      className="text-xs text-brand-blue hover:underline font-bold"
                    >
                      Ir para fila de revisões
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTermText("")}
                      className="text-xs text-text-muted hover:text-text-white font-bold transition-colors"
                    >
                      Adicionar outro
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
