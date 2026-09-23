"use client";
import { FormEvent, useCallback, useRef, useState } from "react";
import { api, Group, GroupInput, Subgroup } from "@/lib/api";
import { DEFAULT_LANGUAGES, languageName } from "@/lib/languages";
import { useResource } from "@/lib/useResource";
import Modal from "./Modal";
import CreationGuide from "./CreationGuide";
import { ErrorMessage, Loading } from "./StudyUI";

export const suggestedGroups: GroupInput[] = [
  {
    title: "Línguas",
    description: "Novas palavras, novas conexões.",
    context: "Ensine idiomas com exemplos naturais, traduções e dicas de uso.",
    color: "#85a5ff",
  },
  {
    title: "Tecnologia",
    description: "Conceitos que viram prática.",
    context:
      "Explique tecnologia com precisão, exemplos práticos e linguagem acessível.",
    color: "#6ee7b7",
  },
  {
    title: "Geografia",
    description: "Conheça os lugares e suas relações.",
    context: "Ensine geografia relacionando território, sociedade e natureza.",
    color: "#fbbf24",
  },
  {
    title: "História",
    description: "Entenda o passado e suas conexões.",
    context:
      "Explique fatos históricos com datas, causas, consequências e contexto. Distinga fatos de interpretações.",
    color: "#c4b5fd",
  },
];

export function GroupForm({
  group,
  initial,
  onClose,
  onSaved,
}: {
  group?: Group;
  initial?: GroupInput;
  onClose: () => void;
  onSaved: (group: Group) => void;
}) {
  const [form, setForm] = useState<GroupInput>(
    group
      ? {
          title: group.title,
          description: group.description,
          context: group.context,
          color: group.color,
        }
      : initial || {
          title: "",
          description: "",
          context: "",
          color: "#85a5ff",
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focus = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(
        group
          ? await api.updateGroup(group.id, { ...form, version: group.version })
          : await api.createGroup(form),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      titleId="group-title"
      onClose={onClose}
      busy={busy}
      initialFocusRef={focus}
    >
      <CreationGuide
        kind="theme"
        heading={<h2 id="group-title">{group ? "Editar tema" : "Novo tema"}</h2>}
        closeButton={<button
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar"
        >
          ×
        </button>}
      />
      <p className="muted">
        O tema reúne subgrupos e compartilha um contexto com todos eles.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="form-stack">
          {!group && (
            <div className="chips">
              {suggestedGroups.map((item) => (
                <button
                  type="button"
                  className="chip"
                  key={item.title}
                  onClick={() => setForm(item)}
                >
                  {item.title}
                </button>
              ))}
              <button
                type="button"
                className="chip"
                onClick={() =>
                  setForm({
                    title: "",
                    description: "",
                    context: "",
                    color: "#85a5ff",
                  })
                }
              >
                Personalizado
              </button>
            </div>
          )}
          <label>
            Título
            <input
              ref={focus}
              required
              maxLength={100}
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="Ex.: Ciências"
            />
          </label>
          <label>
            Descrição
            <textarea
              rows={2}
              maxLength={2000}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Uma breve descrição para se orientar."
            />
          </label>
          <label>
            Contexto geral para a IA
            <textarea
              rows={4}
              maxLength={12000}
              value={form.context}
              onChange={(event) =>
                setForm({ ...form, context: event.target.value })
              }
              placeholder="Ex.: Estou começando a estudar idiomas. Explique em português. Se houver vários sentidos, inclua até 3 traduções principais e indique quando usar cada uma. Traga 2 exemplos com tradução."
            />
          </label>
          <label>
            Cor do tema
            <input
              type="color"
              value={form.color}
              onChange={(event) =>
                setForm({ ...form, color: event.target.value })
              }
            />
          </label>
          <ErrorMessage message={error} />
          <div className="actions end">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="button primary">
              {busy ? "Salvando…" : "Salvar tema"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function SubgroupForm({
  group,
  onClose,
  onSaved,
}: {
  group: Group;
  onClose: () => void;
  onSaved: (subgroup: Subgroup) => void;
}) {
  const [language, setLanguage] = useState("en");
  const loader = useCallback(() => api.templates(language), [language]);
  const { data: presets, error: loadError, reload } = useResource(loader);
  const [preset, setPreset] = useState(
    group.title === "Línguas" ? "languages" : "general",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const template = presets?.find((item) => item.id === preset)?.template;
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await api.createSubgroup(group.id, {
          title,
          description,
          context:
            (preset === "languages"
              ? "Estudo de " + languageName(language) + ". "
              : "") + context,
          template,
        }),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal titleId="subgroup-title" onClose={onClose} busy={busy}>
      <div className="spread">
        <h2 id="subgroup-title">Novo subgrupo</h2>
        <button
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
      <p className="muted">
        Dentro de <strong>{group.title}</strong>. É aqui que seus cards ficam.
      </p>
      {!presets ? (
        <Loading error={loadError} retry={reload} />
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="form-stack">
            <label>
              Título
              <input
                required
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Python, Espanhol, Segunda Guerra"
              />
            </label>
            <label>
              Descrição
              <textarea
                rows={2}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label>
              Contexto específico
              <textarea
                rows={4}
                maxLength={12000}
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Ex.: estou começando, quero exemplos simples e explicações em português."
              />
            </label>
            <label>
              Modelo inicial dos cards
              <select
                value={preset}
                onChange={(event) => setPreset(event.target.value)}
              >
                {presets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            {preset === "languages" && (
              <label>
                Idioma de estudo
                <select
                  value={language}
                  onChange={(event) => {
                    setLanguage(event.target.value);
                    if (!title) setTitle(languageName(event.target.value));
                  }}
                >
                  {DEFAULT_LANGUAGES.map((item) => (
                    <option value={item.code} key={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="muted">
              Depois de criar, personalize os campos, fontes, cores e instruções
              em Configurações.
            </p>
            <ErrorMessage message={error} />
            <div className="actions end">
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button className="button primary">
                {busy ? "Criando…" : "Criar subgrupo"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
