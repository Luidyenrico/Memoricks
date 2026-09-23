"use client";
import Link from "next/link";
import { CSSProperties, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { GroupForm, SubgroupForm } from "./CollectionForms";
import {
  Breadcrumbs,
  EmptyState,
  ErrorMessage,
  Loading,
  Metrics,
  Progress,
} from "./StudyUI";
import Modal from "./Modal";
import "./content-management.css";
import SubgroupStudyAction from "./SubgroupStudyAction";

export default function GroupScreen({
  id,
  learned = false,
}: {
  id: number;
  learned?: boolean;
}) {
  const loader = useCallback(() => api.group(id), [id]);
  const { data: group, error, reload } = useResource(loader);
  const [form, setForm] = useState<"group" | "subgroup" | "delete" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (!group)
    return (
      <main id="main-content" className="page">
        <Link className="library-back-link" href="/themes">← Voltar a Meus temas</Link>
        <Breadcrumbs items={[{ label: "Meus temas", href: "/themes" }, { label: "Tema" }]} />
        <Loading error={error} retry={reload} />
      </main>
    );
  async function remove() {
    if (!group) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.deleteGroup(group);
      router.push("/themes");
    } catch (error) {
      setActionError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      className="page topic-page content-page"
      style={{ "--topic-color": group.color } as CSSProperties}
    >
      <Link className="library-back-link" href={`/themes?group=${id}`}>← Voltar a Meus temas</Link>
      <Breadcrumbs items={[{ label: "Meus temas", href: "/themes" }, { label: group.title }]} />
      <div className="hero">
        <div>
          <p className="eyebrow">TEMA</p>
          <h1>{group.title}</h1>
          <p className="lead">
            {group.description ||
              "Organize seus subgrupos e personalize os cards deste tema."}
          </p>
        </div>
        <div className="actions">
          <button className="button secondary" onClick={() => setForm("group")}>
            Editar tema
          </button>
          <button
            className="button primary"
            onClick={() => setForm("subgroup")}
          >
            + Novo subgrupo
          </button>
        </div>
      </div>
      <Metrics stats={group.stats} />
      <nav className="tabs" aria-label="Visões do tema">
        <Link
          href={`/groups/${id}`}
          aria-current={!learned ? "page" : undefined}
        >
          Subgrupos
        </Link>
        <Link
          href={`/groups/${id}?view=learned`}
          aria-current={learned ? "page" : undefined}
        >
          Aprendidos <span>{group.stats.learned}</span>
        </Link>
      </nav>
      <div className="section-heading">
        <h2>
          {learned ? "Cards aprendidos por subgrupo" : "Subgrupos deste tema"}
        </h2>
        <span className="muted">{group.subgroup_count} subgrupos</span>
      </div>
      {!group.subgroups.length ? (
        <EmptyState title="Um tema, muitas possibilidades">
          <p>
            Crie o primeiro subgrupo de {group.title}. Os cards serão
            adicionados dentro dele.
          </p>
          <button
            className="button primary"
            onClick={() => setForm("subgroup")}
          >
            Criar subgrupo
          </button>
        </EmptyState>
      ) : (
        <div className="collection-grid">
          {group.subgroups.map((subgroup) => (
            <article
              className="collection-card"
              key={subgroup.id}
            >
              <Link className="spread" href={`/subgroups/${subgroup.id}${learned ? "?view=learned" : ""}`}>
                <h2>{subgroup.title}</h2>
                <span aria-hidden="true">↗</span>
              </Link>
              <p className="muted clamp-two">
                {subgroup.description ||
                  "Visualize, crie e personalize seus cards."}
              </p>
              <div className="chips">
                <span className="tag">{subgroup.stats.total} cards</span>
                {subgroup.stats.pending > 0 && (
                  <span className="tag accent">
                    {subgroup.stats.pending} para revisar
                  </span>
                )}
              </div>
              <Progress stats={subgroup.stats} />
              <div className="collection-study-footer">
              <Link className="text-button" href={`/subgroups/${subgroup.id}${learned ? "?view=learned" : ""}`}>
                {learned ? "Ver cards aprendidos" : "Abrir subgrupo"} →
              </Link>
              {!learned && <SubgroupStudyAction subgroup={subgroup} from="group" />}
              </div>
            </article>
          ))}
        </div>
      )}
      {group.context && (
        <details className="context-panel">
          <summary>Contexto compartilhado com os subgrupos</summary>
          <p>{group.context}</p>
        </details>
      )}
      {group.subgroup_count === 0 && (
        <button
          className="text-button danger"
          onClick={() => setForm("delete")}
        >
          Excluir tema vazio
        </button>
      )}
      {form === "group" && (
        <GroupForm
          group={group}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            reload();
          }}
        />
      )}
      {form === "subgroup" && (
        <SubgroupForm
          group={group}
          onClose={() => setForm(null)}
          onSaved={(subgroup) =>
            router.push(`/subgroups/${subgroup.id}?view=settings`)
          }
        />
      )}
      {form === "delete" && (
        <Modal titleId="delete-group" onClose={() => setForm(null)} busy={busy}>
          <h2 id="delete-group">Excluir {group.title}?</h2>
          <p>Este tema está vazio.</p>
          <ErrorMessage message={actionError} />
          <div className="actions end">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setForm(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={remove}
            >
              Excluir tema
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
