"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { api, LanguageOption, ProfileSettings } from "@/lib/api";
import { DEFAULT_LANGUAGES, languageName } from "@/lib/languages";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [languages, setLanguages] =
    useState<LanguageOption[]>(DEFAULT_LANGUAGES);
  const [nativeLanguage, setNativeLanguage] = useState("pt");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const [profileData, languageData] = await Promise.all([
          api.getProfile(),
          api.getLanguages(),
        ]);
        if (!isMounted) return;
        setProfile(profileData);
        setNativeLanguage(profileData.native_language);
        setLanguages(languageData);
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
        if (isMounted) {
          setMessage({
            type: "error",
            text: "Não foi possível carregar o perfil.",
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving || !profile) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateProfile({
        native_language: nativeLanguage,
      });
      setProfile(updated);
      setMessage({ type: "success", text: "Idioma nativo atualizado." });
    } catch (err: unknown) {
      const text =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o perfil.";
      setMessage({ type: "error", text });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col selection:bg-brand-blue selection:text-white font-sans antialiased transition-premium">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-xl w-full mx-auto px-6 py-12 flex-grow"
      >
        <div className="mb-8">
          <span className="text-xs uppercase font-bold tracking-[0.25em] text-accent">
            Perfil
          </span>
          <h1 className="text-2xl font-bold tracking-tight mt-2">
            Preferências de idioma
          </h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-9 h-9 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="bg-bg-dark border border-border-custom rounded-lg p-6 shadow-2xl space-y-6"
          >
            <div>
              <label
                htmlFor="native-language"
                className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2"
              >
                Idioma nativo
              </label>
              <select
                id="native-language"
                disabled={isSaving || !profile}
                value={nativeLanguage}
                onChange={(event) => setNativeLanguage(event.target.value)}
                className="w-full bg-bg-black border border-border-custom rounded-lg px-4 py-3 text-xs font-bold focus:outline-none focus:border-brand-blue text-text-white cursor-pointer"
              >
                {languages
                  .filter(
                    (language) => language.code !== profile?.learning_language,
                  )
                  .map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
              </select>
            </div>

            {profile && (
              <div className="border-t border-border-custom pt-5 flex items-center justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
                  Idioma de estudo atual
                </span>
                <span className="text-xs font-bold text-text-white">
                  {languageName(profile.learning_language, languages)}
                </span>
              </div>
            )}

            {message && (
              <div
                role={message.type === "error" ? "alert" : "status"}
                className={`p-3 rounded-lg border text-xs ${
                  message.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/5 text-success"
                    : "border-red-500/20 bg-red-500/5 text-danger"
                }`}
              >
                {message.text}
              </div>
            )}

            {!profile && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-accent text-sm underline"
              >
                Tentar carregar novamente
              </button>
            )}
            <button
              type="submit"
              disabled={
                isSaving ||
                !profile ||
                nativeLanguage === profile?.native_language
              }
              className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-3.5 rounded-lg transition-premium disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-widest"
            >
              {isSaving ? "Salvando..." : "Salvar perfil"}
            </button>
          </form>
        )}
      </main>

      <footer className="border-t border-border-custom py-6 bg-bg-black">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center text-xs text-text-muted gap-3">
          <p>© 2026 Memoricks - Seu sistema pessoal de memorização.</p>
          <Link
            href="/"
            className="hover:text-text-white font-bold tracking-wider uppercase"
          >
            Voltar ao painel
          </Link>
        </div>
      </footer>
    </div>
  );
}
