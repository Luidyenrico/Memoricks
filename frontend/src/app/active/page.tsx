"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, Term } from "@/lib/api";
import Header from "@/components/Header";

export default function ActiveTermsPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<number | null>(null);
  const [cancelingTermIds, setCancelingTermIds] = useState<Set<number>>(new Set());

  // Form states for creating terms in active tab
  const [termText, setTermText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline editing states
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [editTranslation, setEditTranslation] = useState("");
  const [editMeaning, setEditMeaning] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editTip, setEditTip] = useState("");
  const [editExamples, setEditExamples] = useState<Array<{ en: string; pt: string }>>([]);

  const startEditing = (term: Term) => {
    setEditingTermId(term.id);
    setEditTranslation(term.generated_content.translation || "");
    setEditMeaning(term.generated_content.meaning);
    setEditExplanation(term.generated_content.explanation);
    setEditTip(term.generated_content.tip);
    setEditExamples(term.generated_content.examples.map(ex => ({ en: ex.en, pt: ex.pt })));
  };

  const cancelEditing = () => {
    setEditingTermId(null);
  };

  const handleUpdateTerm = async (termId: number) => {
    try {
      const updatedTerm = await api.updateTerm(termId, {
        translation: editTranslation,
        meaning: editMeaning,
        explanation: editExplanation,
        examples: editExamples,
        tip: editTip
      });
      setTerms((prev) => prev.map((t) => (t.id === termId ? updatedTerm : t)));
      setEditingTermId(null);
    } catch (err) {
      console.error("Erro ao atualizar termo:", err);
      alert("Não foi possível salvar as alterações.");
    }
  };

  useEffect(() => {
    fetchActiveTerms();
  }, []);

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = termText.trim();
    if (!cleanText) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      // Cria o termo no backend (retorna instantaneamente com placeholder)
      const newTerm = await api.createTerm(cleanText);
      
      // Limpa e libera a entrada imediatamente para a próxima palavra
      setTermText("");
      
      // Atualiza a lista local de termos para incluir o termo em processo no topo
      setTerms((prev) => [newTerm, ...prev]);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Erro ao cadastrar termo. Verifique se já existe.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Polling para atualizar a lista se houver qualquer termo ativo processando (sem significado)
  useEffect(() => {
    const hasUnprocessed = terms.some(term => term.generated_content.meaning === "");
    if (!hasUnprocessed) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.getActive();
        setTerms(data);
      } catch (err) {
        console.error("Erro ao atualizar termos ativos processando:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [terms]);

  async function fetchActiveTerms() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getActive();
      setTerms(data);
    } catch (err) {
      console.error(err);
      setError("Erro ao buscar termos em estudo. Verifique se o backend está ativo.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteTerm = async (termId: number) => {
    if (!confirm("Tem certeza de que deseja excluir este termo? O progresso de memorização dele será perdido.")) return;
    try {
      await api.deleteTerm(termId);
      if (expandedTermId === termId) {
        setExpandedTermId(null);
      }
      // Atualiza localmente removendo da lista
      setTerms((prev) => prev.filter((t) => t.id !== termId));
    } catch (err) {
      console.error("Erro ao excluir termo:", err);
      alert("Não foi possível excluir o termo.");
    }
  };

  const handleCancelLoading = async (termId: number) => {
    setCancelingTermIds((prev) => new Set(prev).add(termId));
    setError(null);

    try {
      await api.cancelTermGeneration(termId);
      setTerms((prev) => prev.filter((term) => term.id !== termId));
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

  const getReviewStatus = (term: Term) => {
    if (term.generated_content.meaning === "") {
      return {
        text: "Processando IA...",
        style: "bg-brand-blue/10 text-brand-blue border border-brand-blue/20 animate-pulse text-[10px]"
      };
    }
    const now = new Date();
    const nextReview = new Date(term.next_review_date);
    if (nextReview <= now) {
      return {
        text: "Revisar Agora",
        style: "bg-brand-red/10 text-brand-red border border-brand-red/20 text-[10px]"
      };
    } else {
      const diffTime = nextReview.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const formattedDate = nextReview.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      return {
        text: diffDays <= 1 ? `Revisão amanhã` : `Revisão em ${formattedDate}`,
        style: "bg-bg-medium text-text-muted border border-border-custom text-[10px]"
      };
    }
  };

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col justify-between selection:bg-brand-blue selection:text-white font-sans antialiased relative transition-premium">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,94,255,0.02),transparent_60%)] pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-6 py-10 flex-grow flex flex-col relative z-10">
        
        {/* Page title */}
        <div className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2.5">
              <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Termos em Estudo
            </h1>
            <p className="text-text-muted text-xs mt-1">Sua lista de palavras e expressões sendo memorizadas.</p>
          </div>
          <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-blue/10 text-brand-blue border border-brand-blue/20 self-center select-none">
            {isLoading && terms.length === 0 ? "Carregando..." : `${terms.length} Termos Ativos`}
          </div>
        </div>

        {/* Formulário de Cadastro Rápido na Aba Em Estudo */}
        <div className="mb-8 p-6 bg-bg-dark border border-border-custom rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5 select-none">
            <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Novo Termo
          </h2>
          <form onSubmit={handleCreateTerm} className="flex gap-2">
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={termText}
              onChange={(e) => setTermText(e.target.value)}
              placeholder="Ex: despite, give up, by the way"
              className="flex-1 bg-bg-black border border-border-custom rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-brand-blue text-text-white placeholder-text-muted/40 transition-premium"
            />
            <button
              type="submit"
              disabled={isSubmitting || !termText.trim()}
              className="bg-brand-blue hover:opacity-90 text-white font-bold px-5 py-2.5 rounded-lg transition-premium disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-2 shadow-lg shadow-brand-blue/10 uppercase tracking-widest"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Adicionar"
              )}
            </button>
          </form>

          {formError && (
            <p className="mt-2 text-[10px] font-bold text-brand-red animate-fade-in">{formError}</p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 flex items-center justify-between gap-3 text-xs">
            <p>{error}</p>
            <button onClick={fetchActiveTerms} className="font-bold underline hover:text-white uppercase tracking-wider text-[10px]">Tentar Recarregar</button>
          </div>
        )}

        {/* Content list */}
        {isLoading && terms.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
            <p className="text-xs text-text-muted animate-pulse">Buscando termos sob estudo...</p>
          </div>
        ) : terms.length === 0 ? (
          // Empty state
          <div className="py-20 px-6 border border-border-custom rounded-2xl text-center bg-bg-dark max-w-xl mx-auto w-full flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-bg-medium flex items-center justify-center mb-4 text-text-muted">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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
              const isProcessing = term.generated_content.meaning === "";
              const isCanceling = cancelingTermIds.has(term.id);
              
              return (
                <div
                  key={term.id}
                  className={`border rounded-xl overflow-hidden transition-premium bg-bg-dark ${isExpanded ? "border-brand-blue/30 shadow-lg shadow-brand-blue/5" : "border-border-custom hover:border-text-muted/20"}`}
                >
                  {/* Row Header */}
                  <div
                    onClick={() => !isProcessing && setExpandedTermId(isExpanded ? null : term.id)}
                    className={`p-4 flex items-center justify-between gap-4 select-none ${isProcessing ? "cursor-default" : "cursor-pointer hover:bg-bg-medium/40"} transition-premium`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <h3 className="text-md font-bold text-text-white capitalize tracking-tight truncate">{term.text}</h3>
                      <span className="text-[9px] uppercase font-bold text-text-muted bg-bg-black px-2 py-0.5 rounded border border-border-custom flex-shrink-0">
                        {term.type === "word" ? "Palavra" : "Expressão"}
                      </span>
                    </div>

                    <div className="flex items-center gap-5 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded text-[9px] font-bold border transition-premium ${status.style}`}>
                        {status.text}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {isProcessing ? (
                          <button
                            type="button"
                            disabled={isCanceling}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelLoading(term.id);
                            }}
                            className="text-[9px] uppercase font-bold text-brand-red hover:text-white border border-brand-red/20 hover:bg-brand-red rounded px-2.5 py-1 transition-premium disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Cancelar carregamento"
                          >
                            {isCanceling ? "Cancelando..." : "Cancelar"}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTerm(term.id);
                            }}
                            className="p-1.5 text-text-muted hover:text-brand-red hover:bg-brand-red/5 rounded-lg transition-premium"
                            title="Excluir Termo"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        
                        {/* Chevron icon */}
                        {!isProcessing && (
                          <div className="text-text-muted p-0.5">
                            <svg className={`w-3.5 h-3.5 transform transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded AI Details */}
                  {isExpanded && !isProcessing && (
                    <div className="px-5 pb-5 border-t border-border-custom pt-5 bg-bg-black/20 animate-fade-in text-xs space-y-4">
                      {editingTermId === term.id ? (
                        <div className="space-y-4">
                          {/* Translation Edit */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-brand-blue mb-1">
                              Tradução Direta
                            </label>
                            <input
                              type="text"
                              value={editTranslation}
                              onChange={(e) => setEditTranslation(e.target.value)}
                              className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-2.5 text-xs text-text-white focus:outline-none focus:border-brand-blue"
                            />
                          </div>

                          {/* Meaning Edit */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-brand-blue mb-1">
                              Significado
                            </label>
                            <input
                              type="text"
                              value={editMeaning}
                              onChange={(e) => setEditMeaning(e.target.value)}
                              className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-2.5 text-xs text-text-white focus:outline-none focus:border-brand-blue"
                            />
                          </div>

                          {/* Explanation Edit */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-text-muted mb-1">
                              Explicação
                            </label>
                            <textarea
                              value={editExplanation}
                              onChange={(e) => setEditExplanation(e.target.value)}
                              rows={3}
                              className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-2.5 text-xs text-text-white focus:outline-none focus:border-brand-blue"
                            />
                          </div>

                          {/* Examples Edit */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-brand-red mb-2">
                              Exemplos Práticos
                            </label>
                            <div className="space-y-3">
                              {editExamples.map((ex, index) => (
                                <div key={index} className="pl-3 border-l border-brand-blue/25 space-y-2">
                                  <input
                                    type="text"
                                    value={ex.en}
                                    placeholder="Exemplo em Inglês"
                                    onChange={(e) => {
                                      const newExs = [...editExamples];
                                      newExs[index].en = e.target.value;
                                      setEditExamples(newExs);
                                    }}
                                    className="w-full bg-bg-black border border-border-custom rounded-lg px-3 py-2 text-xs text-text-white focus:outline-none focus:border-brand-blue"
                                  />
                                  <input
                                    type="text"
                                    value={ex.pt}
                                    placeholder="Tradução em Português"
                                    onChange={(e) => {
                                      const newExs = [...editExamples];
                                      newExs[index].pt = e.target.value;
                                      setEditExamples(newExs);
                                    }}
                                    className="w-full bg-bg-black border border-border-custom rounded-lg px-3 py-2 text-xs text-text-muted focus:outline-none focus:border-brand-blue"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Tip Edit */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-text-muted mb-1">
                              Dica Rápida
                            </label>
                            <input
                              type="text"
                              value={editTip}
                              onChange={(e) => setEditTip(e.target.value)}
                              className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-2.5 text-xs text-text-white focus:outline-none focus:border-brand-blue"
                            />
                          </div>

                          {/* Buttons */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleUpdateTerm(term.id)}
                              className="px-4 py-2 bg-brand-blue hover:opacity-90 font-bold rounded-lg text-white text-xs transition-premium hover:scale-[1.01] active:scale-[0.99] uppercase tracking-wider"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-4 py-2 border border-border-custom hover:bg-bg-medium font-bold rounded-lg text-text-muted text-xs transition-premium"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {term.generated_content.translation && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue block mb-1">Tradução Direta</span>
                              <p className="text-text-white leading-relaxed font-bold">
                                {term.generated_content.translation}
                              </p>
                            </div>
                          )}

                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue block mb-1">Significado</span>
                            <p className="text-text-white leading-relaxed font-semibold">
                              {term.generated_content.meaning}
                            </p>
                          </div>

                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Explicação</span>
                            <p className="text-text-muted leading-relaxed text-[11px]">
                              {term.generated_content.explanation}
                            </p>
                          </div>

                          {term.generated_content.examples && term.generated_content.examples.length > 0 && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-brand-red block mb-1.5">Exemplos Práticos</span>
                              <ul className="space-y-2 text-[11px]">
                                {term.generated_content.examples.map((ex, i) => (
                                  <li key={i} className="pl-3 border-l border-border-custom leading-relaxed">
                                    <p className="text-text-white font-medium">{ex.en}</p>
                                    <p className="text-text-muted text-[9px] mt-0.5">{ex.pt}</p>
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

                          {/* Edit action button */}
                          <div className="pt-3 border-t border-border-custom flex justify-end">
                            <button
                              onClick={() => startEditing(term)}
                              className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:underline font-bold"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Editar Explicações
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-border-custom py-6 bg-bg-black mt-12">
        <div className="max-w-5xl mx-auto px-6 flex justify-between items-center text-[10px] text-text-muted">
          <p>© 2026 Memoricks - Seu sistema pessoal de memorização.</p>
          <Link href="/" className="hover:text-text-white font-bold tracking-wider uppercase">Voltar ao Painel</Link>
        </div>
      </footer>
    </div>
  );
}
