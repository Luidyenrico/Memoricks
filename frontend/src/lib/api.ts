const BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type FieldFormat = "text" | "list" | "code";
export interface CardField {
  id: string;
  label: string;
  instructions: string;
  side: "front" | "back";
  format: FieldFormat;
  required: boolean;
  length: "short" | "medium" | "detailed";
  max_chars: number;
  font: "sans" | "serif" | "mono";
  size: "small" | "medium" | "large";
  color: string | null;
  background: string | null;
}
export interface CardTemplate {
  fields: CardField[];
}
export interface Stats {
  total: number;
  active: number;
  pending: number;
  learned: number;
  percent: number;
  attention: number;
  reviewable?: number;
}
export interface GroupInput {
  title: string;
  description: string;
  context: string;
  color: string;
}
export interface Group extends GroupInput {
  id: number;
  version: number;
  subgroup_count: number;
  stats: Stats;
}
export interface SubgroupInput {
  title: string;
  description: string;
  context: string;
  template: CardTemplate;
}
export interface Subgroup extends SubgroupInput {
  id: number;
  group_id: number;
  version: number;
  template_version: number;
  stats: Stats;
}
export interface GroupDetail extends Group {
  subgroups: Subgroup[];
}
export interface SubgroupDetail extends Subgroup {
  group: GroupInput & { id: number; version: number };
}
export type Source = "manual" | "ai" | "demo";
export interface CardDraft {
  text: string;
  values: Record<string, string>;
  template_version: number;
  source: Source;
}
export interface Preview extends CardDraft {
  template: CardTemplate;
  removed_fields?: string[];
}
export interface Card extends Omit<CardDraft, "source"> {
  id: number;
  subgroup_id: number;
  template: CardTemplate;
  source: Source | "legacy";
  needs_attention: boolean;
  difficulty_level: "Difficult" | "Medium" | "Easy";
  next_review_date: string;
  mastered: boolean;
  created_at: string;
  mastered_at: string | null;
  version: number;
}
export interface CardPage {
  items: Card[];
  total: number;
}
export interface Preset {
  id: string;
  title: string;
  template: CardTemplate;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter = 60) {
    super(message);
  }
}

export interface BatchPlan {
  entries: string[];
  common_context: string;
  subgroup_version: number;
  group_version: number;
}

export async function request<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method,
      credentials: "include",
      headers: method === "GET" ? undefined : {
        "X-Memoricks-Request": "1",
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(
        /\/(generate|batch-plan|batch-generate)$/.test(path) ? 110_000 : 20_000,
      ),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao Memoricks. Verifique se o servidor está iniciado e tente novamente.",
    );
  }
  if (!response.ok) {
    let message = "Não foi possível concluir a operação. Tente novamente.";
    let retryAfter = 60;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (body.detail && typeof body.detail.message === "string") {
        message = body.detail.message;
        if (Number.isFinite(body.detail.retry_after)) retryAfter = Math.max(60, body.detail.retry_after);
      }
      else if (Array.isArray(body.detail))
        message = body.detail
          .map((item: { msg: string }) => item.msg)
          .join(" ");
    } catch {
      /* Keep a readable error if the server responds with HTML. */
    }
    throw new ApiError(message, response.status, retryAfter);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  batchPlan: (id: number, text: string) =>
    request<BatchPlan>(`/subgroups/${id}/batch-plan`, "POST", { text }),
  batchGenerate: (id: number, text: string, plan: BatchPlan) =>
    request<Preview>(`/subgroups/${id}/batch-generate`, "POST", {
      text, subgroup_version: plan.subgroup_version, group_version: plan.group_version,
      common_context: plan.common_context,
    }),
  saveBatch: (id: number, request_id: string, cards: CardDraft[]) =>
    request<{ count: number; cards: Card[] }>(`/subgroups/${id}/cards/batch`, "POST", { request_id, cards }),
  reviewShortcuts: () =>
    request<
      {
        id: number;
        title: string;
        group_title: string;
        color: string;
        stats: Stats;
      }[]
    >("/review-shortcuts"),
  groups: () => request<Group[]>("/groups"),
  group: (id: number) => request<GroupDetail>(`/groups/${id}`),
  createGroup: (data: GroupInput) => request<Group>("/groups", "POST", data),
  updateGroup: (id: number, data: GroupInput & { version: number }) =>
    request<GroupDetail>(`/groups/${id}`, "PUT", data),
  deleteGroup: (group: Group) =>
    request<void>(`/groups/${group.id}?version=${group.version}`, "DELETE"),
  subgroup: (id: number) => request<SubgroupDetail>(`/subgroups/${id}`),
  createSubgroup: (groupId: number, data: SubgroupInput) =>
    request<Subgroup>(`/groups/${groupId}/subgroups`, "POST", data),
  updateSubgroup: (id: number, data: SubgroupInput & { version: number }) =>
    request<SubgroupDetail>(`/subgroups/${id}`, "PUT", data),
  deleteSubgroup: (subgroup: Subgroup) =>
    request<void>(
      `/subgroups/${subgroup.id}?version=${subgroup.version}`,
      "DELETE",
    ),
  templates: (language = "en") =>
    request<Preset[]>(`/templates?language=${encodeURIComponent(language)}`),
  cards: (id: number, status = "active", q = "", offset = 0, limit = 30) =>
    request<CardPage>(
      `/subgroups/${id}/cards?${new URLSearchParams({ status, q, offset: String(offset), limit: String(limit) })}`,
    ),
  generate: (id: number, text: string) =>
    request<Preview>(`/subgroups/${id}/generate`, "POST", { text }),
  createCard: (id: number, data: CardDraft) =>
    request<Card>(`/subgroups/${id}/cards`, "POST", data),
  updateCard: (
    id: number,
    data: CardDraft & { version: number; use_current_template: boolean },
  ) => request<Card>(`/cards/${id}`, "PUT", data),
  upgrade: (id: number) => request<Preview>(`/cards/${id}/upgrade`),
  review: (card: Card, action: "difficult" | "medium" | "easy" | "master") =>
    request<Card>(`/cards/${card.id}/review`, "POST", {
      action,
      version: card.version,
    }),
  deleteCard: (card: Card) =>
    request<void>(`/cards/${card.id}?version=${card.version}`, "DELETE"),
  profile: () => request<{ native_language: string }>("/profile"),
  updateProfile: (native_language: string) =>
    request<{ native_language: string }>("/profile", "PUT", {
      native_language,
    }),
};
