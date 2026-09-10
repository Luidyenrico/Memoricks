"use client";

import { DEFAULT_LANGUAGES, LanguageOption } from "@/lib/languages";

interface TermLanguageSelectorProps {
  termLanguage: string;
  explanationLanguage: string;
  onTermLanguageChange: (language: string) => void;
  onExplanationLanguageChange: (language: string) => void;
  languages?: LanguageOption[];
  disabled?: boolean;
}

export default function TermLanguageSelector({
  termLanguage,
  explanationLanguage,
  onTermLanguageChange,
  onExplanationLanguageChange,
  languages = DEFAULT_LANGUAGES,
  disabled = false,
}: TermLanguageSelectorProps) {
  const swapLanguages = () => {
    onTermLanguageChange(explanationLanguage);
    onExplanationLanguageChange(termLanguage);
  };

  const renderOptions = () =>
    languages.map((language) => (
      <option key={language.code} value={language.code}>
        {language.name}
      </option>
    ));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_44px] sm:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-end gap-2">
      <label className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
          Idioma do termo
        </span>
        <select
          value={termLanguage}
          onChange={(event) => onTermLanguageChange(event.target.value)}
          disabled={disabled}
          className="w-full min-w-0 bg-bg-black border border-border-custom rounded-lg px-3 py-2.5 text-xs text-text-white focus:outline-none focus:border-brand-blue transition-premium disabled:opacity-50"
        >
          {renderOptions()}
        </select>
      </label>

      <button
        type="button"
        onClick={swapLanguages}
        disabled={disabled}
        className="col-start-2 row-start-1 row-span-2 sm:row-span-1 self-center sm:self-end h-11 w-11 mb-px rounded-lg border border-border-custom bg-bg-black text-text-muted hover:text-accent hover:border-brand-blue/50 transition-premium disabled:opacity-50"
        aria-label="Trocar os idiomas"
        title="Trocar os idiomas"
      >
        ⇄
      </button>

      <label className="min-w-0 col-start-1 row-start-2 sm:col-start-3 sm:row-start-1">
        <span className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
          Explicação em
        </span>
        <select
          value={explanationLanguage}
          onChange={(event) => onExplanationLanguageChange(event.target.value)}
          disabled={disabled}
          className="w-full min-w-0 bg-bg-black border border-border-custom rounded-lg px-3 py-2.5 text-xs text-text-white focus:outline-none focus:border-brand-blue transition-premium disabled:opacity-50"
        >
          {renderOptions()}
        </select>
      </label>
    </div>
  );
}
