"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { api, LanguageOption, ProfileSettings } from "@/lib/api";
import { DEFAULT_LANGUAGES, languageName } from "@/lib/languages";

export default function LanguageSelectionPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [languages, setLanguages] =
    useState<LanguageOption[]>(DEFAULT_LANGUAGES);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOptions = async () => {
      try {
        const [profileData, languageData] = await Promise.all([
          api.getProfile(),
          api.getLanguages(),
        ]);
        if (!isMounted) return;
        setProfile(profileData);
        setLanguages(languageData);
        setSelectedLanguage(profileData.learning_language);
      } catch (err) {
        console.error("Erro ao carregar idiomas:", err);
        if (isMounted)
          setError("Não foi possível carregar os idiomas disponíveis.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleContinue = async () => {
    if (!selectedLanguage || isSaving || !profile) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.updateProfile({ learning_language: selectedLanguage });
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o idioma de estudo.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const availableLanguages = languages.filter(
    (language) => language.code !== profile?.native_language,
  );

  return (
    <div className="min-h-screen bg-bg-black text-text-white flex flex-col selection:bg-brand-blue selection:text-white">
      <header className="border-b border-border-custom">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <Image
              src="/memoricks-logo.png"
              alt="Logo Memoricks"
              width={42}
              height={42}
              priority
              className="h-10 w-10 object-contain"
            />
            <span className="hidden sm:block text-sm font-extrabold tracking-[0.18em]">
              MEMORICKS
            </span>
          </div>

          {profile?.learning_language_selected && (
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-muted hover:text-text-white transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Voltar
            </Link>
          )}
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-4xl w-full mx-auto px-5 sm:px-6 py-10 sm:py-14 flex-grow"
      >
        <div className="max-w-xl mb-9">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
            Idioma de estudo
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold mt-3">
            Qual idioma você quer aprender?
          </h1>
          {profile && (
            <p className="text-xs text-text-muted mt-3">
              Idioma nativo:{" "}
              <span className="font-bold text-text-white">
                {languageName(profile.native_language, languages)}
              </span>
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-9 h-9 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-2 lg:grid-cols-3 gap-3"
              role="group"
              aria-label="Idioma de estudo"
            >
              {availableLanguages.map((language) => {
                const isSelected = selectedLanguage === language.code;
                return (
                  <button
                    key={language.code}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isSaving || !profile}
                    onClick={() => setSelectedLanguage(language.code)}
                    className={`min-w-0 h-16 px-3 sm:px-4 rounded-lg border flex items-center gap-2 sm:gap-3 text-left transition-premium ${
                      isSelected
                        ? "border-brand-blue bg-brand-blue/10 text-text-white"
                        : "border-border-custom bg-bg-dark text-text-muted hover:border-text-muted/40 hover:text-text-white"
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black uppercase border ${
                        isSelected
                          ? "border-brand-blue/30 bg-brand-blue text-white"
                          : "border-border-custom bg-bg-black text-text-muted"
                      }`}
                    >
                      {language.code}
                    </span>
                    <span className="min-w-0 text-xs font-bold flex-grow truncate">
                      {language.name}
                    </span>
                    {isSelected && (
                      <svg
                        className="w-4 h-4 text-accent"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-danger text-xs"
              >
                {error}
                {!profile && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="block mt-2 underline font-bold"
                  >
                    Tentar carregar novamente
                  </button>
                )}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => void handleContinue()}
                disabled={!selectedLanguage || isSaving || !profile}
                className="w-full sm:w-auto min-w-44 bg-brand-blue hover:opacity-90 text-white font-bold px-6 py-3.5 rounded-lg transition-premium disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-widest"
              >
                {isSaving
                  ? "Salvando..."
                  : profile?.learning_language_selected
                    ? "Confirmar idioma"
                    : "Continuar"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
