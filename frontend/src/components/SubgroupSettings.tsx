"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, SubgroupDetail, SubgroupInput } from "@/lib/api";
import TemplateEditor from "./TemplateEditor";
import { ErrorMessage } from "./StudyUI";
import Modal from "./Modal";

export default function SubgroupSettings({
  subgroup,
  onSaved,
}: {
  subgroup: SubgroupDetail;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SubgroupInput>({
    title: subgroup.title,
    description: subgroup.description,
    context: subgroup.context,
    template: subgroup.template,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [version, setVersion] = useState(subgroup.version);
  const router = useRouter();
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateSubgroup(subgroup.id, {
        ...form,
        version,
      });
      setVersion(updated.version);
      setSaved(true);
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteSubgroup({ ...subgroup, version });
      router.push(`/groups/${subgroup.group_id}`);
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="settings-section">
      <form onSubmit={save} onChange={() => setSaved(false)}>
        <fieldset disabled={busy} className="form-stack">
          <div className="section-heading">
            <div>
              <h2>Contexto e modelo dos cards</h2>
              <p className="muted">
                Fonte, tamanho e cores são aplicados a todos os cards deste
                subgrupo que tenham o mesmo campo. Mudanças na estrutura do
                modelo são opcionais para os cards antigos.
              </p>
            </div>
          </div>
          <div className="settings-basics">
            <label>
              Título do subgrupo
              <input
                required
                maxLength={100}
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>
            <label>
              Descrição
              <textarea
                maxLength={2000}
                rows={2}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            <label>
              Contexto específico para a IA
              <textarea
                rows={5}
                maxLength={12000}
                value={form.context}
                onChange={(event) =>
                  setForm({ ...form, context: event.target.value })
                }
              />
            </label>
            <details className="context-panel">
              <summary>Contexto herdado de {subgroup.group.title}</summary>
              <p>
                {subgroup.group.context ||
                  "O tema ainda não tem um contexto geral."}
              </p>
            </details>
          </div>
          <h3>Campos do card</h3>
          <TemplateEditor
            value={form.template}
            onChange={(template) => {
              setForm({ ...form, template });
              setSaved(false);
            }}
          />
          <ErrorMessage message={error} />
          {saved && (
            <p className="notice success" role="status">
              Configurações salvas. Estilos atualizados nos cards do subgrupo,
              mantendo seus conteúdos e progresso.
            </p>
          )}
          <div className="actions end sticky-actions">
            <button className="button primary">
              {busy ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </fieldset>
      </form>
      {subgroup.stats.total === 0 && (
        <button
          className="text-button danger"
          onClick={() => setDeleting(true)}
        >
          Excluir subgrupo vazio
        </button>
      )}
      {deleting && (
        <Modal
          titleId="delete-subgroup"
          onClose={() => setDeleting(false)}
          busy={busy}
        >
          <h2 id="delete-subgroup">Excluir {subgroup.title}?</h2>
          <p>Este subgrupo está vazio.</p>
          <ErrorMessage message={error} />
          <div className="actions end">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              Cancelar
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={remove}
            >
              Excluir subgrupo
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
