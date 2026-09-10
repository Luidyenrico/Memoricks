export interface LanguageOption {
  code: string;
  name: string;
}

export const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: "pt", name: "Português" },
  { code: "en", name: "Inglês" },
  { code: "es", name: "Espanhol" },
  { code: "fr", name: "Francês" },
  { code: "de", name: "Alemão" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Holandês" },
  { code: "ja", name: "Japonês" },
  { code: "ko", name: "Coreano" },
  { code: "zh", name: "Chinês" },
  { code: "ru", name: "Russo" },
  { code: "ar", name: "Árabe" },
];

export function languageName(code: string, languages = DEFAULT_LANGUAGES) {
  return languages.find((language) => language.code === code)?.name ?? code;
}
