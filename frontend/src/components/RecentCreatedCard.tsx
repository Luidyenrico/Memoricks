"use client";

import { FormEvent, useRef, useState } from "react";
import { api, Card } from "@/lib/api";
import { CardFields } from "./CardContent";
import { ErrorMessage } from "./StudyUI";
import AppIcon from "./AppIcon";

export default function RecentCreatedCard({ card, disabled, onBusyChange, onChanged, onDeleted }: {
  card: Card;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onChanged: (card: Card) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [values, setValues] = useState(card.values);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const front = card.template.fields.find(field => field.side === "front" && card.values[field.id]?.trim());
  const back = card.template.fields.find(field => field.side === "back" && card.values[field.id]?.trim());

  async function save(event: FormEvent) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    onBusyChange(true);
    setError(null);
    try {
      const updated = await api.updateCard(card.id, {
        text: card.text, values, template_version: card.template_version,
        source: card.source === "legacy" ? "manual" : card.source,
        version: card.version, use_current_template: false,
      });
      onChanged(updated);
      setEditing(false);
    } catch (cause) { setError((cause as Error).message); }
    finally { running.current = false; onBusyChange(false); }
  }
  async function remove() {
    if (running.current) return;
    running.current = true;
    onBusyChange(true);
    setError(null);
    try { await api.deleteCard(card); onDeleted(); }
    catch (cause) { setError((cause as Error).message); }
    finally { running.current = false; onBusyChange(false); }
  }

  return <article className={`created-mini-card${editing ? " is-editing" : ""}`} aria-label={`Card criado: ${card.text}`}>
    <div className="created-mini-header">
      <h4 className="created-mini-title">{front ? card.values[front.id] : card.text}</h4>
      <span className="created-mini-saved"><AppIcon name="check" />Salvo</span>
    </div>
    {editing ? <form onSubmit={save}>
      <fieldset disabled={disabled} className="form-stack">
        <CardFields template={card.template} values={values} onChange={setValues} />
        <div className="actions wrap">
          <button className="button primary small">Salvar edição</button>
          <button type="button" className="button secondary small" onClick={() => { setEditing(false); setError(null); }}>Cancelar edição</button>
        </div>
      </fieldset>
    </form> : <>
      <div className="created-mini-content" role="region" aria-label={`Resumo de ${card.text}`}>
        {back && <div className="created-mini-summary">
          <span>{back.label}</span>
          <p>{card.values[back.id]}</p>
        </div>}
      </div>
      {deleting ? <div className="created-mini-confirm">
        <p>Excluir este card da biblioteca?</p>
        <div className="actions wrap">
          <button type="button" className="button danger-button small" disabled={disabled} onClick={remove}>Confirmar exclusão</button>
          <button type="button" className="button secondary small" disabled={disabled} onClick={() => { setDeleting(false); setError(null); }}>Manter card</button>
        </div>
      </div> : <div className="created-mini-actions">
        <button type="button" className="button primary small created-mini-edit" disabled={disabled} onClick={() => { setValues(card.values); setError(null); setEditing(true); }}><AppIcon name="edit" />Editar card</button>
        <button type="button" className="created-mini-delete" aria-label="Excluir card" disabled={disabled} onClick={() => { setError(null); setDeleting(true); }}><AppIcon name="trash" />Excluir</button>
      </div>}
    </>}
    <ErrorMessage message={error} />
  </article>;
}
