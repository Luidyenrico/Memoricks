"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError, BatchPlan, CardDraft, Preview, SubgroupDetail } from "@/lib/api";
import Modal from "./Modal";
import { CardContent, CardFields } from "./CardContent";
import { ErrorMessage } from "./StudyUI";
import "./batch-cards.css";

type Row = { id: string; text: string; preview?: Preview; error?: string };
type Draft = {
  text: string;
  plan?: BatchPlan;
  rows: Row[];
  retryAt?: number;
  saving?: { id: string; cards: CardDraft[] };
};

export default function BatchCardEditor({ subgroup, onClose, onSaved }: {
  subgroup: SubgroupDetail; onClose: () => void; onSaved: (count: number) => void;
}) {
  const storageKey = `memoricks-batch-v1-${subgroup.id}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved && typeof saved.text === "string" && Array.isArray(saved.rows)) return saved;
    } catch { /* A fresh editor remains available if browser storage is unavailable. */ }
    return { text: "", rows: [] };
  });
  const current = useRef(draft);
  const stop = useRef(false);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const locked = busy || !!draft.saving;
  const ready = draft.rows.filter(row => row.preview).length;

  useEffect(() => () => { stop.current = true; }, []);

  function update(next: Draft) {
    current.current = next;
    setDraft(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setStorageError(true); }
  }
  function rowUpdate(id: string, changes: Partial<Row>) {
    update({ ...current.current, rows: current.current.rows.map(row => row.id === id ? { ...row, ...changes } : row) });
  }
  async function waitForQuota() {
    while ((current.current.retryAt || 0) > Date.now()) {
      if (stop.current) return false;
      setStatus(`Limite da IA atingido. Retomando em ${Math.ceil((current.current.retryAt! - Date.now()) / 1000)} s…`);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return !stop.current;
  }
  async function withQuota<T>(operation: () => Promise<T>, label: string): Promise<T | undefined> {
    for (let attempt = 0; attempt <= 5; attempt++) {
      if (!await waitForQuota()) return;
      setStatus(label);
      try { return await operation(); }
      catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 429) throw cause;
        update({ ...current.current, retryAt: Date.now() + cause.retryAfter * 1000 });
        if (attempt === 5 || cause.retryAfter > 600) {
          throw new Error("O limite continua ativo. A fila foi pausada e as prévias foram preservadas. Retome mais tarde.");
        }
      }
    }
  }
  function begin() {
    if (running.current) return false;
    running.current = true; stop.current = false;
    setBusy(true); setError(null);
    return true;
  }
  function finish() {
    running.current = false; setBusy(false); setStatus("");
  }
  async function organize() {
    if (!current.current.text.trim() || !begin()) return;
    try {
      const plan = await withQuota(() => api.batchPlan(subgroup.id, current.current.text), "Identificando perguntas e assuntos…");
      if (plan) update({ ...current.current, plan, rows: plan.entries.map(text => ({ id: crypto.randomUUID(), text })) });
    } catch (cause) { setError((cause as Error).message); }
    finally { finish(); }
  }
  async function generate() {
    if (!current.current.plan || !begin()) return;
    try {
      for (const row of current.current.rows) {
        if (stop.current) break;
        if (row.preview) continue;
        rowUpdate(row.id, { error: undefined });
        try {
          const preview = await withQuota(
            () => api.batchGenerate(subgroup.id, row.text, current.current.plan!),
            `Gerando card ${current.current.rows.findIndex(item => item.id === row.id) + 1} de ${current.current.rows.length}…`,
          );
          if (preview) rowUpdate(row.id, { preview });
        } catch (cause) {
          rowUpdate(row.id, { error: (cause as Error).message });
          // Rate limit exhaustion, network uncertainty and context changes pause the queue.
          if (!(cause instanceof ApiError) || cause.status !== 502) throw cause;
        }
      }
    } catch (cause) { setError((cause as Error).message); }
    finally { finish(); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    for (const [index, row] of current.current.rows.entries()) {
      if (!row.preview) continue;
      const missing = row.preview.template.fields.find(field => field.required && !row.preview!.values[field.id]?.trim());
      if (missing) { setError(`Card ${index + 1}: preencha o campo ${missing.label} antes de salvar.`); return; }
    }
    if (!ready || !begin()) return;
    const pending = current.current.saving || {
      id: crypto.randomUUID(),
      cards: current.current.rows.filter(row => row.preview).map(row => ({
        text: row.text, values: row.preview!.values,
        template_version: row.preview!.template_version, source: row.preview!.source,
      })),
    };
    update({ ...current.current, saving: pending });
    try {
      const result = await api.saveBatch(subgroup.id, pending.id, pending.cards);
      try { sessionStorage.removeItem(storageKey); } catch { /* Save has succeeded. */ }
      onSaved(result.count);
    } catch (cause) {
      // A network failure may happen after commit: retry the identical confirmation.
      if (cause instanceof ApiError && cause.status < 500) update({ ...current.current, saving: undefined });
      setError((cause as Error).message);
    } finally { finish(); }
  }

  return <Modal titleId="batch-title" busy={busy} onClose={onClose}>
    <div className="spread">
      <div><p className="eyebrow">{subgroup.group.title} / {subgroup.title}</p><h2 id="batch-title">Criar vários cards com IA</h2></div>
      <button className="icon-button" aria-label="Fechar" disabled={busy} onClick={onClose}>×</button>
    </div>
    <p>A IA organiza seu material e completa os campos do modelo com respostas, exemplos e dicas. Revise antes de salvar.</p>
    <p className="muted">Até 50 cards por fila. O rascunho fica nesta aba ao fechar ou recarregar; mantenha a página aberta durante a geração.</p>
    {storageError && <p className="notice">O navegador não conseguiu guardar o rascunho. Mantenha esta janela aberta para preservar as prévias.</p>}
    {!draft.plan ? <div className="form-stack">
      <label>Material de estudo<textarea rows={10} maxLength={40000} disabled={busy} value={draft.text}
        onChange={event => update({ ...draft, text: event.target.value })}
        placeholder={"Capítulo 1 — Aprendizado de máquina\nPergunta: O que é aprendizado supervisionado?\nResposta: ...\nPergunta: O que é um conjunto de teste?\nResposta: ..."} /></label>
      <small>{draft.text.length}/40.000 caracteres. Coloque cada pergunta em uma nova linha, seguida de sua resposta, se houver.</small>
      <button className="button primary" disabled={busy || !draft.text.trim()} onClick={organize}>Organizar perguntas</button>
    </div> : <form onSubmit={save} noValidate className="form-stack batch-list">
      <div className="generation-panel batch-panel">
        <strong>{ready} de {draft.rows.length} cards gerados</strong>
        <p>Confira a separação abaixo. Você pode editar ou remover entradas antes de gerar e revisar cada prévia depois.</p>
        {draft.plan.common_context && <p><strong>Contexto comum:</strong> {draft.plan.common_context}</p>}
        <progress max={Math.max(1, draft.rows.length)} value={ready} aria-label="Cards gerados" />
        <div className="actions">
          <button type="button" className="button primary" disabled={locked || ready === draft.rows.length || draft.rows.some(row => !row.text.trim())} onClick={generate}>
            {ready ? "Gerar cards restantes" : "Gerar cards"}
          </button>
          <button type="button" className="button secondary" disabled={locked} onClick={() => {
            if (!draft.rows.length || window.confirm("Descartar esta fila e suas prévias para organizar outro material?"))
              update({ text: draft.text, rows: [], retryAt: draft.retryAt });
          }}>Recomeçar</button>
        </div>
      </div>
      {draft.rows.map((row, index) => <details className="context-panel" key={row.id}>
        <summary>Card {index + 1} · {row.preview ? "Pronto para revisar" : row.error ? "Falhou — tente novamente" : "Aguardando geração"} · {row.text.slice(0, 75)}</summary>
        <fieldset disabled={locked} className="form-stack">
          <label>Entrada do card {index + 1}<textarea rows={3} maxLength={5000} required value={row.text} onChange={event => rowUpdate(row.id, { text: event.target.value, preview: undefined, error: undefined })} /></label>
          {row.error && <p role="alert" className="notice">{row.error}</p>}
          {row.preview && <>
            {row.preview.source === "demo" && <p className="notice">Demonstração: preencha os campos antes de estudar.</p>}
            <CardFields template={row.preview.template} values={row.preview.values} onChange={values => rowUpdate(row.id, { preview: { ...row.preview!, values } })} />
            <div className="preview-face"><CardContent template={row.preview.template} values={row.preview.values} /></div>
          </>}
          <button type="button" className="button secondary" onClick={() => update({ ...draft, rows: draft.rows.filter(item => item.id !== row.id) })}>Remover card {index + 1}</button>
        </fieldset>
      </details>)}
      {ready > 0 && ready < draft.rows.length && <p className="notice">Salvar confirma somente os {ready} cards gerados e encerra esta fila. Para incluir os demais, gere os restantes primeiro.</p>}
      {draft.saving && !busy && <p className="notice">A confirmação do salvamento não chegou. Tente novamente para verificar o mesmo lote sem duplicar cards.</p>}
      <div className="actions end sticky-actions"><button className="button primary" disabled={busy || !ready}>{draft.saving ? "Tentar salvar novamente" : `Salvar ${ready} cards`}</button></div>
    </form>}
    <div role="status" aria-live="polite">{status}</div>
    {busy && !draft.saving && <button type="button" className="button secondary" onClick={() => { stop.current = true; setStatus("Pausando após a requisição atual…"); }}>Pausar geração</button>}
    <ErrorMessage message={error} />
    {!busy && <button className="button secondary" onClick={onClose}>Fechar e manter rascunho</button>}
  </Modal>;
}
