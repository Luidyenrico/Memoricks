import type { LanguageOption } from "./languages";
export type { LanguageOption } from "./languages";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

export interface ExampleItem {
  learning: string;
  native: string;
}

export interface GeneratedContent {
  translation: string;
  meaning: string;
  explanation: string;
  examples: ExampleItem[];
  tip: string;
}

export interface Term {
  id: number;
  text: string;
  type: "word" | "expression";
  learning_language: string;
  native_language: string;
  exact_translation: string;
  generated_content: GeneratedContent;
  difficulty_level: string;
  next_review_date: string;
  mastered: boolean;
  created_at: string;
  mastered_at?: string | null;
}

export function termHasGenerationError(term: Term): boolean {
  const content = term.generated_content;
  return (
    content.translation.startsWith("Erro '") ||
    content.meaning.startsWith("Erro na IA") ||
    content.examples.some((example) =>
      example.learning.startsWith("Error loading example:"),
    )
  );
}

export function termIsReviewable(term: Term): boolean {
  return (
    Boolean(term.generated_content.meaning.trim()) &&
    !termHasGenerationError(term)
  );
}

export interface ReviewStats {
  total_active: number;
  pending_review: number;
  mastered_words: number;
  mastered_expressions: number;
}

export interface TranslationQuizQuestion {
  term_id: number;
  text: string;
  type: "word" | "expression";
  correct_translation: string;
  options: string[];
}

export interface AISettings {
  meaning_limit: string;
  explanation_style: string;
  examples_count: number;
  tone_focus: string;
}

export interface ProfileSettings {
  native_language: string;
  learning_language: string;
  learning_language_selected: boolean;
}

function languageQuery(language?: string) {
  return language ? `?learning_language=${encodeURIComponent(language)}` : "";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal:
        options?.signal ??
        (!options?.method || options.method === "GET"
          ? AbortSignal.timeout(15_000)
          : undefined),
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...(options?.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("O servidor demorou para responder. Tente novamente.");
    throw new Error(
      "Não foi possível conectar ao Memoricks. Verifique se o servidor está iniciado e tente novamente.",
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    let parsedMessage = `Não foi possível concluir a operação (erro ${response.status}). Tente novamente.`;
    try {
      const parsedJson = JSON.parse(errorBody);
      if (typeof parsedJson.detail === "string")
        parsedMessage = parsedJson.detail;
      else if (Array.isArray(parsedJson.detail)) {
        parsedMessage = parsedJson.detail
          .map((item: { msg?: string }) => item.msg || "Valor inválido")
          .join(". ");
      }
    } catch {
      // An HTML error page is not a useful message for the user.
    }
    throw new Error(parsedMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Obter um termo específico por ID
  async getTerm(id: number): Promise<Term> {
    return request<Term>(`/terms/${id}`);
  },

  // Obter estatísticas gerais (ativos, pendentes, dominados)
  async getStats(learningLanguage?: string): Promise<ReviewStats> {
    return request<ReviewStats>(
      `/terms/stats${languageQuery(learningLanguage)}`,
    );
  },

  // Obter termos pendentes para revisão
  async getPending(learningLanguage?: string): Promise<Term[]> {
    return request<Term[]>(`/terms/pending${languageQuery(learningLanguage)}`);
  },

  async getTranslationQuiz(
    scope: "pending" | "active" = "pending",
    learningLanguage?: string,
  ): Promise<TranslationQuizQuestion[]> {
    const language = learningLanguage
      ? `&learning_language=${encodeURIComponent(learningLanguage)}`
      : "";
    return request<TranslationQuizQuestion[]>(
      `/terms/quiz?scope=${scope}${language}`,
    );
  },

  // Obter termos sob estudo (ativos, não dominados)
  async getActive(learningLanguage?: string): Promise<Term[]> {
    return request<Term[]>(`/terms/active${languageQuery(learningLanguage)}`);
  },

  // Obter termos dominados (tipo: "word" ou "expression")
  async getMastered(
    type: "word" | "expression",
    learningLanguage?: string,
  ): Promise<Term[]> {
    return request<Term[]>(
      `/terms/mastered/${type}${languageQuery(learningLanguage)}`,
    );
  },

  // Cadastrar um novo termo (palavra ou expressão)
  async createTerm(
    text: string,
    termLanguage: string,
    explanationLanguage: string,
  ): Promise<Term> {
    return request<Term>("/terms/", {
      method: "POST",
      body: JSON.stringify({
        text,
        term_language: termLanguage,
        explanation_language: explanationLanguage,
      }),
    });
  },

  // Enviar resposta de revisão (action: "difficult" | "medium" | "easy" | "again" | "master")
  async reviewTerm(
    termId: number,
    action: "difficult" | "medium" | "easy" | "again" | "master",
  ): Promise<Term> {
    return request<Term>(`/terms/${termId}/review`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },

  // Excluir termo (opção administrativa/limpeza)
  async deleteTerm(termId: number): Promise<Term> {
    return request<Term>(`/terms/${termId}`, {
      method: "DELETE",
    });
  },

  async updateTerm(termId: number, content: GeneratedContent): Promise<Term> {
    return request<Term>(`/terms/${termId}`, {
      method: "PUT",
      body: JSON.stringify(content),
    });
  },

  // Obter configurações de IA atuais
  async getAISettings(): Promise<AISettings> {
    return request<AISettings>("/terms/settings/ai");
  },

  // Atualizar configurações de IA
  async updateAISettings(settings: AISettings): Promise<AISettings> {
    return request<AISettings>("/terms/settings/ai", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  async getLanguages(): Promise<LanguageOption[]> {
    return request<LanguageOption[]>("/profile/languages");
  },

  async getProfile(): Promise<ProfileSettings> {
    return request<ProfileSettings>("/profile");
  },

  async updateProfile(
    settings: Partial<ProfileSettings>,
  ): Promise<ProfileSettings> {
    return request<ProfileSettings>("/profile", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },
};
