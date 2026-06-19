const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ExampleItem {
  en: string;
  pt: string;
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
  generated_content: GeneratedContent;
  difficulty_level: string;
  next_review_date: string;
  mastered: boolean;
  created_at: string;
  mastered_at?: string | null;
}

export interface ReviewStats {
  total_active: number;
  pending_review: number;
  mastered_words: number;
  mastered_expressions: number;
}

export interface AISettings {
  meaning_limit: string;
  explanation_style: string;
  examples_count: number;
  tone_focus: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    let parsedMessage = errorBody;
    try {
      const parsedJson = JSON.parse(errorBody);
      parsedMessage = parsedJson.detail || errorBody;
    } catch {
      // Ignora e usa o corpo bruto
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
  async getStats(): Promise<ReviewStats> {
    return request<ReviewStats>("/terms/stats");
  },

  // Obter termos pendentes para revisão
  async getPending(): Promise<Term[]> {
    return request<Term[]>("/terms/pending");
  },

  // Obter termos sob estudo (ativos, não dominados)
  async getActive(): Promise<Term[]> {
    return request<Term[]>("/terms/active");
  },

  // Obter termos dominados (tipo: "word" ou "expression")
  async getMastered(type: "word" | "expression"): Promise<Term[]> {
    return request<Term[]>(`/terms/mastered/${type}`);
  },

  // Cadastrar um novo termo (palavra ou expressão)
  async createTerm(text: string): Promise<Term> {
    return request<Term>("/terms/", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  // Enviar resposta de revisão (action: "difficult" | "medium" | "easy" | "master")
  async reviewTerm(termId: number, action: "difficult" | "medium" | "easy" | "master"): Promise<Term> {
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

  // Atualizar conteúdo de um termo manualmente
  async cancelTermGeneration(termId: number): Promise<Term> {
    return request<Term>(`/terms/${termId}/cancel`, {
      method: "POST",
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
};
