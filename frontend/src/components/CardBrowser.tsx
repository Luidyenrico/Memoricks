"use client";
import { FormEvent, useCallback, useState } from "react";
import { api, Card, SubgroupDetail } from "@/lib/api";
import { formatDate, reviewDueLabel } from "@/lib/dates";
import { useResource } from "@/lib/useResource";
import CardEditor from "./CardEditor";
import { CardContent } from "./CardContent";
import Modal from "./Modal";
import { EmptyState, ErrorMessage, Loading } from "./StudyUI";

export default function CardBrowser({
  subgroup,
  learned,
  onChanged,
}: {
  subgroup: SubgroupDetail;
  learned: boolean;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const loader = useCallback(
    () =>
      api.cards(subgroup.id, learned ? "mastered" : "active", query, offset),
    [subgroup.id, learned, query, offset],
  );
  const { data, error, reload } = useResource(loader);
  const [selected, setSelected] = useState<Card | null>(null);
  const [editing, setEditing] = useState<{
    card: Card;
    upgrade: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  function changed() {
    setSelected(null);
    setEditing(null);
    setDeleting(null);
    reload();
    onChanged();
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.deleteCard(deleting);
      changed();
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(search);
    setOffset(0);
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{learned ? "Cards aprendidos" : "Seus cards em estudo"}</h2>
          <p className="card-browser-help">Abra um card para consultar, editar ou excluir.</p>
        </div>
        <form className="search-form" onSubmit={submit}>
          <input
            aria-label="Buscar cards neste subgrupo"
            placeholder="Buscar neste subgrupo…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="button secondary" type="submit">
            Buscar
          </button>
        </form>
      </div>
      {!data ? (
        <Loading error={error} retry={reload} />
      ) : data.total === 0 ? (
        <EmptyState
          title={
            query
              ? "Nenhum card encontrado"
              : learned
                ? "Seu aprendizado vai aparecer aqui"
                : "Ainda não há cards em estudo"
          }
        >
          <p>
            {query
              ? "Experimente outra busca."
              : learned
                ? "Revise seus cards e marque os que você dominou."
                : "Use Criar card para começar com ou sem IA."}
          </p>
        </EmptyState>
      ) : (
        <>
          <div className="study-list">
            {data.items.map((card) => (
              <button
                key={card.id}
                className="study-row"
                aria-label={`Ver e editar card: ${card.text}`}
                onClick={() => setSelected(card)}
              >
                <span className="study-row-main">
                  <strong>
                    {card.values[
                      card.template.fields.find(
                        (field) => field.side === "front",
                      )?.id || ""
                    ] || card.text}
                  </strong>
                  <span>{card.text}</span>
                </span>
                <span className="study-row-meta">
                  {card.needs_attention ? (
                    <span className="tag warning">Completar conteúdo</span>
                  ) : (
                    <span className={learned ? "tag success" : "tag"}>
                      {learned
                        ? "Aprendido"
                        : reviewDueLabel(card.next_review_date)}
                    </span>
                  )}
                  {card.source === "legacy" && (
                    <span className="tag">Card preservado</span>
                  )}
                  <span className="study-row-open-label">Ver / editar <span aria-hidden="true">→</span></span>
                </span>
              </button>
            ))}
          </div>
          <div className="pagination">
            <span className="muted">
              {offset + 1}–{Math.min(offset + 30, data.total)} de {data.total}{" "}
              cards
            </span>
            <div className="actions">
              <button
                className="button secondary small"
                disabled={!offset}
                onClick={() => setOffset((value) => Math.max(0, value - 30))}
              >
                Anterior
              </button>
              <button
                className="button secondary small"
                disabled={offset + 30 >= data.total}
                onClick={() => setOffset((value) => value + 30)}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
      {selected && (
        <Modal titleId="card-detail" onClose={() => setSelected(null)}>
          <div className="spread">
            <div>
              <p className="eyebrow">{subgroup.title}</p>
              <h2 id="card-detail">Detalhes do card</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Fechar"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>
          <p className="muted">
            Criado em {formatDate(selected.created_at)} ·{" "}
            {selected.mastered
              ? "Aprendido em " + formatDate(selected.mastered_at)
              : "Próxima revisão: " + formatDate(selected.next_review_date)}
          </p>
          {selected.needs_attention && (
            <p className="notice">
              Este card antigo precisa de correção. Edite o conteúdo para
              incluí-lo nas revisões.
            </p>
          )}
          <CardContent template={selected.template} values={selected.values} />
          <div className="actions wrap">
            <button
              className="button primary"
              onClick={() => {
                setEditing({ card: selected, upgrade: false });
                setSelected(null);
              }}
            >
              Editar card
            </button>
            {(selected.template_version !== subgroup.template_version ||
              JSON.stringify(selected.template) !==
                JSON.stringify(subgroup.template)) && (
              <button
                className="button secondary"
                onClick={() => {
                  setEditing({ card: selected, upgrade: true });
                  setSelected(null);
                }}
              >
                Atualizar para o modelo atual
              </button>
            )}
            <button
              className="text-button danger"
              onClick={() => {
                setDeleting(selected);
                setSelected(null);
                setActionError(null);
              }}
            >
              Excluir card
            </button>
          </div>
        </Modal>
      )}
      {editing && (
        <CardEditor
          subgroup={subgroup}
          card={editing.card}
          upgrade={editing.upgrade}
          onClose={() => setEditing(null)}
          onSaved={changed}
        />
      )}
      {deleting && (
        <Modal
          titleId="delete-card"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <h2 id="delete-card">Excluir este card?</h2>
          <p className="break-text">{deleting.text}</p>
          <p className="muted">
            O card e seu progresso serão removidos da biblioteca.
          </p>
          <ErrorMessage message={actionError} />
          <div className="actions end">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={remove}
            >
              {busy ? "Excluindo…" : "Excluir card"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
