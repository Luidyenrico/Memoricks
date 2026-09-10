"use client";

import { useRef, useState } from "react";
import { api, GeneratedContent, Term, termIsReviewable } from "@/lib/api";
import { languageName } from "@/lib/languages";

export function TermContentView({ term }: { term: Term }) {
  const content = term.generated_content;
  return (
    <div className="space-y-4 text-sm leading-relaxed break-words">
      {(
        [
          ["Tradução direta", content.translation],
          ["Significado", content.meaning],
          ["Explicação", content.explanation],
        ] as const
      ).map(
        ([label, value]) =>
          value && (
            <div key={label}>
              <h4 className="text-xs font-bold text-accent mb-1">{label}</h4>
              <p
                className="text-text-white"
                lang={term.native_language}
                dir="auto"
              >
                {value}
              </p>
            </div>
          ),
      )}
      {content.examples.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-accent mb-2">
            Exemplos práticos
          </h4>
          <ul className="space-y-3">
            {content.examples.map((example, index) => (
              <li key={index} className="border-l-2 border-border-custom pl-3">
                <p lang={term.learning_language} dir="auto">
                  {example.learning}
                </p>
                <p
                  className="text-text-muted"
                  lang={term.native_language}
                  dir="auto"
                >
                  {example.native}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {content.tip && (
        <p
          className="rounded-lg border border-border-custom p-3 text-text-muted"
          lang={term.native_language}
          dir="auto"
        >
          <strong>Dica:</strong> {content.tip}
        </p>
      )}
    </div>
  );
}

export default function TermContent({
  term,
  onUpdated,
  expanded = true,
}: {
  term: Term;
  onUpdated: (term: Term) => void;
  expanded?: boolean;
}) {
  const [draft, setDraft] = useState<GeneratedContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState(false);

  const finishEditing = () => {
    setDraft(null);
    setError(null);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await api.updateTerm(term.id, draft);
      onUpdated(updated);
      setSaved(true);
      finishEditing();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  // Keep the draft when the user temporarily collapses the row.
  if (!expanded) return null;

  if (!draft)
    return (
      <div className="space-y-4">
        {!termIsReviewable(term) && (
          <p className="text-sm text-danger">
            Este conteúdo está incompleto ou contém um erro antigo. Edite as
            explicações para voltar a revisar.
          </p>
        )}
        <TermContentView term={term} />
        {saved && (
          <p role="status" className="text-sm text-accent">
            Alterações salvas.
          </p>
        )}
        <div className="border-t border-border-custom pt-3 flex justify-end">
          <button
            ref={editButton}
            type="button"
            className="text-sm text-accent font-bold py-2"
            onClick={() => {
              setDraft(structuredClone(term.generated_content));
              setSaved(false);
            }}
          >
            Editar explicações
          </button>
        </div>
      </div>
    );

  const inputClass =
    "w-full bg-bg-black border border-border-custom rounded-lg px-3 py-2.5 text-sm text-text-white";
  return (
    <form onSubmit={save} className="space-y-4" aria-busy={isSaving}>
      <fieldset disabled={isSaving} className="space-y-4">
        <legend className="sr-only">Editar conteúdo de {term.text}</legend>
        {(
          [
            ["translation", "Tradução direta"],
            ["meaning", "Significado"],
            ["explanation", "Explicação"],
            ["tip", "Dica"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="block text-xs font-bold text-text-muted space-y-1"
          >
            <span>{label}</span>
            <textarea
              autoFocus={key === "translation"}
              className={inputClass}
              rows={key === "explanation" ? 3 : 2}
              value={draft[key]}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })
              }
            />
          </label>
        ))}
        {draft.examples.map((example, index) => (
          <fieldset
            key={index}
            className="border-l-2 border-border-custom pl-3 space-y-2"
          >
            <legend className="text-xs text-text-muted mb-2">
              Exemplo {index + 1}
            </legend>
            {(["learning", "native"] as const).map((key) => (
              <label
                key={key}
                className="block text-xs text-text-muted space-y-1"
              >
                <span>
                  {key === "learning"
                    ? `Frase em ${languageName(term.learning_language)}`
                    : `Tradução em ${languageName(term.native_language)}`}
                </span>
                <input
                  className={inputClass}
                  value={example[key]}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      examples: draft.examples.map((item, i) =>
                        i === index
                          ? { ...item, [key]: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
        ))}
        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-3 bg-brand-blue text-white rounded-lg text-sm font-bold"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={finishEditing}
            className="px-4 py-3 border border-border-custom rounded-lg text-sm"
          >
            Cancelar
          </button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
