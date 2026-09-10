"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, AISettings } from "@/lib/api";
import Header from "@/components/Header";

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings>({
    meaning_limit: "Curto (até 10 palavras)",
    explanation_style: "Padrão (até 2 frases)",
    examples_count: 3,
    tone_focus: "Geral",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAISettings();
      setSettings(data);
      setHasLoaded(true);
      setMessage(null);
    } catch (err) {
      console.error("Erro ao buscar configurações de IA:", err);
      setMessage({
        type: "error",
        text: "Não foi possível carregar as configurações de IA.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !hasLoaded) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateAISettings(settings);
      setSettings(updated);
      setMessage({
        type: "success",
        text: "Configurações de IA salvas com sucesso!",
      });
    } catch (err) {
      console.error("Erro ao salvar configurações de IA:", err);
      setMessage({
        type: "error",
        text: "Não foi possível salvar as configurações de IA.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col justify-between selection:bg-brand-blue selection:text-white font-sans antialiased relative transition-premium">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,94,255,0.02),transparent_60%)] pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-xl w-full mx-auto px-6 py-10 flex-grow flex flex-col justify-center relative z-10"
      >
        {/* Page Title */}
        <div className="mb-8 text-center md:text-left">
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
                strokeWidth="2"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            Personalização da IA
          </h1>
          <p className="text-text-muted text-xs mt-1">
            Configure o comportamento do assistente de IA ao gerar explicações
            para novos termos.
          </p>
        </div>

        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
            <p className="text-xs text-text-muted animate-pulse">
              Carregando preferências...
            </p>
          </div>
        ) : (
          <div className="bg-bg-dark border border-border-custom rounded-xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl pointer-events-none" />

            <form onSubmit={handleSave} className="space-y-6">
              {/* Meaning limit */}
              <div>
                <label
                  htmlFor="ai-meaning_limit"
                  className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2 select-none"
                >
                  Tamanho do Significado (Tradução)
                </label>
                <select
                  disabled={isSaving || !hasLoaded}
                  id="ai-meaning_limit"
                  value={settings.meaning_limit}
                  onChange={(e) =>
                    setSettings({ ...settings, meaning_limit: e.target.value })
                  }
                  className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-brand-blue text-text-white transition-premium cursor-pointer"
                >
                  <option value="Muito curto (até 5 palavras)">
                    Muito curto (até 5 palavras)
                  </option>
                  <option value="Curto (até 10 palavras)">
                    Curto (até 10 palavras)
                  </option>
                  <option value="Completo (até 20 palavras)">
                    Completo (até 20 palavras)
                  </option>
                </select>
              </div>

              {/* Explanation style */}
              <div>
                <label
                  htmlFor="ai-explanation_style"
                  className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2 select-none"
                >
                  Estilo de Explicação Didática
                </label>
                <select
                  disabled={isSaving || !hasLoaded}
                  id="ai-explanation_style"
                  value={settings.explanation_style}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      explanation_style: e.target.value,
                    })
                  }
                  className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-brand-blue text-text-white transition-premium cursor-pointer"
                >
                  <option value="Super Direto (1 frase)">
                    Super Direto (1 frase)
                  </option>
                  <option value="Padrão (até 2 frases)">
                    Padrão (até 2 frases)
                  </option>
                  <option value="Detalhado (até 3 frases com contexto)">
                    Detalhado (até 3 frases com contexto)
                  </option>
                </select>
              </div>

              {/* Examples count */}
              <div>
                <label
                  htmlFor="ai-examples_count"
                  className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2 select-none"
                >
                  Quantidade de Exemplos Práticos
                </label>
                <select
                  disabled={isSaving || !hasLoaded}
                  id="ai-examples_count"
                  value={settings.examples_count}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      examples_count: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-brand-blue text-text-white transition-premium cursor-pointer"
                >
                  <option value={2}>2 Exemplos</option>
                  <option value={3}>3 Exemplos</option>
                  <option value={4}>4 Exemplos</option>
                </select>
              </div>

              {/* Tone/Focus */}
              <div>
                <label
                  htmlFor="ai-tone_focus"
                  className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2 select-none"
                >
                  Foco / Frequência de Aprendizado
                </label>
                <select
                  disabled={isSaving || !hasLoaded}
                  id="ai-tone_focus"
                  value={settings.tone_focus}
                  onChange={(e) =>
                    setSettings({ ...settings, tone_focus: e.target.value })
                  }
                  className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-3 text-xs focus:outline-none focus:border-brand-blue text-text-white transition-premium cursor-pointer"
                >
                  <option value="Geral">Geral (Uso Comum)</option>
                  <option value="Informal/Slangs">
                    Gírias e Linguagem Informal
                  </option>
                  <option value="Negócios/Business">
                    Profissional / Business English
                  </option>
                  <option value="Pronúncia e Fonética">
                    Pronúncia e Dicas de Fala
                  </option>
                </select>
              </div>

              {/* Feedback messages */}
              {message && (
                <div
                  role={message.type === "error" ? "alert" : "status"}
                  className={`p-4 rounded-lg border text-xs leading-relaxed animate-fade-in ${message.type === "success" ? "border-emerald-500/20 bg-emerald-500/5 text-success" : "border-red-500/20 bg-red-500/5 text-danger"}`}
                >
                  {message.text}
                </div>
              )}

              {!hasLoaded && (
                <button
                  type="button"
                  onClick={() => void fetchSettings()}
                  className="text-sm text-accent underline"
                >
                  Tentar carregar novamente
                </button>
              )}
              {/* Submit button */}
              <button
                type="submit"
                disabled={isSaving || !hasLoaded}
                className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-3.5 rounded-lg transition-premium disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/10"
              >
                {isSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Salvar Configurações"
                )}
              </button>
            </form>
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
