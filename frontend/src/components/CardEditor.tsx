"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  Card,
  CardTemplate,
  Preview,
  Source,
  SubgroupDetail,
} from "@/lib/api";
import Modal from "./Modal";
import { CardContent, CardFields } from "./CardContent";
import { ErrorMessage } from "./StudyUI";
import RecentCreatedCard from "./RecentCreatedCard";
import "./quick-cards.css";

export default function CardEditor({
  subgroup,
  card,
  upgrade = false,
  onClose,
  onSaved,
}: {
  subgroup: SubgroupDetail;
  card?: Card;
  upgrade?: boolean;
  onClose: () => void;
  onSaved: (keepOpen?: boolean) => void;
}) {
  const initialTemplate = card && !upgrade ? card.template : subgroup.template;
  const [template, setTemplate] = useState<CardTemplate>(initialTemplate);
  const [templateVersion, setTemplateVersion] = useState(
    card && !upgrade ? card.template_version : subgroup.template_version,
  );
  const [text, setText] = useState(card?.text || "");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      initialTemplate.fields.map((field) => [
        field.id,
        card?.values[field.id] || "",
      ]),
    ),
  );
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [upgrading, setUpgrading] = useState(upgrade);
  const [source, setSource] = useState<Source>("manual");
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [createdCards, setCreatedCards] = useState<Card[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const recentGrid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = recentGrid.current;
    if (grid) grid.scrollTo({ top: grid.scrollHeight });
  }, [createdCards.length]);
  const [pending, setPending] = useState<{ id: string; preview: Preview } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  const quickCreate = mode === "ai" && !card;
  useEffect(() => {
    if (quickCreate && !busy) inputRef.current?.focus();
  }, [quickCreate, busy]);
  const removed =
    card && upgrading
      ? card.template.fields.filter(
          (field) => !template.fields.some((item) => item.id === field.id),
        )
      : [];
  function input(value: string) {
    setText(value);
    if (mode === "ai") setReady(false);
    const first = template.fields.find((field) => field.side === "front");
    if (first && (!values[first.id] || values[first.id] === text))
      setValues({ ...values, [first.id]: value });
  }
  function applyPreview(preview: Preview) {
    setTemplate(preview.template);
    setTemplateVersion(preview.template_version);
    setValues(preview.values);
    setSource(preview.source);
    setReady(true);
    if (card) setUpgrading(true);
  }
  async function generate() {
    if (!text.trim()) {
      setError("Informe uma pergunta, assunto ou conteúdo para gerar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      applyPreview(await api.generate(subgroup.id, text));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createWithAI() {
    if (!text.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      let confirmation = pending;
      if (!confirmation) {
        const preview = await api.generate(subgroup.id, text.trim());
        if (preview.source !== "ai") throw new Error("Configure a IA para criar automaticamente ou preencha o card manualmente.");
        confirmation = { id: crypto.randomUUID(), preview };
        setPending(confirmation);
      }
      const { preview } = confirmation;
      const result = await api.saveBatch(subgroup.id, confirmation.id, [{
        text: preview.text, values: preview.values,
        template_version: preview.template_version, source: preview.source,
      }]);
      setCreatedCards(previous => [...previous.filter(item => !result.cards.some(saved => saved.id === item.id)), ...result.cards]);
      setPending(null);
      setText("");
      setValues({});
      setReady(false);
      setNotice("Card criado! Digite o próximo e pressione Enter.");
      onSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status < 500) setPending(null);
      setError(cause instanceof ApiError && cause.status === 429
        ? `Limite da IA atingido. Aguarde ${cause.retryAfter} segundos e pressione Enter novamente. Sua entrada foi mantida.`
        : (cause as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (quickCreate) { await createWithAI(); return; }
    if (!ready || busy) return;
    const frontField = template.fields.find((field) => field.side === "front");
    const cardText = text.trim() || (frontField ? values[frontField.id]?.trim() || "" : "");
    if (!cardText) {
      setError("Preencha o primeiro campo da frente do card.");
      return;
    }
    setBusy(true);
    setError(null);
    const data = { text: cardText, values, template_version: templateVersion, source };
    try {
      if (card)
        await api.updateCard(card.id, {
          ...data,
          version: card.version,
          use_current_template: upgrading,
        });
      else await api.createCard(subgroup.id, data);
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal titleId="card-editor-title" busy={busy || actionBusy} onClose={onClose} className={quickCreate ? "quick-card-modal" : ""}>
      <div className="spread">
        <div>
          <p className="eyebrow">
            {subgroup.group.title} / {subgroup.title}
          </p>
          <h2 id="card-editor-title">
            {card
              ? upgrading
                ? "Atualizar card"
                : "Editar card"
              : "Criar card"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Fechar"
          disabled={busy || actionBusy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className={quickCreate ? "quick-card-layout" : undefined}>
      <form onSubmit={save}>
        <fieldset disabled={busy || actionBusy} className="form-stack">
          <div className="segmented" aria-label="Forma de criação">
            <button
              type="button"
              aria-pressed={mode === "manual"}
              disabled={!!pending}
              onClick={() => {
                setMode("manual");
                setReady(true);
                setSource("manual");
                if (!card) setText("");
              }}
            >
              Preencher manualmente
            </button>
            <button
              type="button"
              aria-pressed={mode === "ai"}
              onClick={() => {
                setMode("ai");
                setReady(false);
              }}
            >
              Criar com IA
            </button>
          </div>
          {mode === "ai" && (
            <label>
              Digite o termo, palavra, pergunta ou assunto para a criação do card:
              <textarea
                ref={inputRef}
                readOnly={!!pending}
                required
                maxLength={5000}
                rows={5}
                value={text}
                onChange={(event) => input(event.target.value)}
                onKeyDown={(event) => {
                  if (quickCreate && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (!event.repeat) void createWithAI();
                  }
                }}
                placeholder={'Ex.: "May I have a coffee please?"\nEx.: "Função list comprehension em Python"\nEx.: "Quem foi o presidente do Brasil em 1998?"\nEx.: "a² = b² + c²"'}
              />
            </label>
          )}
          {quickCreate && <p className="notice">Enter gera e salva o card automaticamente. Shift+Enter insere uma nova linha. Você pode editar ou excluir o card depois.</p>}
          {quickCreate && pending && <p className="notice">Confirmando o salvamento. Se ocorreu uma falha de conexão, pressione Enter para tentar novamente sem gerar ou duplicar o card.</p>}
          {notice && <p role="status" className="notice success">{notice}</p>}
          {mode === "ai" && !quickCreate && (
            <div className="generation-panel">
              <p>
                A IA usa o contexto de <strong>{subgroup.group.title}</strong>,
                as instruções de <strong>{subgroup.title}</strong> e o modelo
                atual para gerar um único card.
              </p>
              <button
                type="button"
                className="button primary"
                onClick={generate}
              >
                {busy ? "Gerando…" : ready ? "Gerar novamente" : "Gerar prévia"}
              </button>
            </div>
          )}
          {card && upgrading && (
            <div className="notice">
              Você está aplicando o modelo atual. O progresso de revisão será
              preservado.
              {removed.length > 0 && (
                <p>
                  Campos que sairão deste card:{" "}
                  <strong>
                    {removed.map((field) => field.label).join(", ")}
                  </strong>
                  . Confira o conteúdo antigo abaixo antes de salvar.
                </p>
              )}
            </div>
          )}
          {source === "demo" && (
            <p className="notice">
              Prévia de demonstração: a IA não está configurada. Os exemplos não
              são conteúdo real para estudo. Você pode preencher os campos
              manualmente.
            </p>
          )}
          {ready && !quickCreate && (
            <>
              <div className="editor-grid">
                <CardFields
                  template={template}
                  values={values}
                  onChange={setValues}
                />
                <aside className="editor-preview">
                  <p className="eyebrow">PRÉVIA DO CARD</p>
                  {(["front", "back"] as const).map((side) => (
                    <div className="preview-face" key={side}>
                      <span className="tag">
                        {side === "front" ? "Frente" : "Verso"}
                      </span>
                      <CardContent
                        template={template}
                        values={values}
                        side={side}
                      />
                    </div>
                  ))}
                </aside>
              </div>
              {card && upgrading && (
                <details className="context-panel">
                  <summary>Comparar com o conteúdo antigo</summary>
                  <CardContent template={card.template} values={card.values} />
                </details>
              )}
            </>
          )}
          <ErrorMessage message={error} />
          <div className="actions end sticky-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              {quickCreate ? "Fechar" : "Cancelar"}
            </button>
            <button className="button primary" disabled={busy || (quickCreate ? !text.trim() : !ready)}>
              {busy ? "Aguarde…" : quickCreate ? pending ? "Confirmar criação" : "Criar card com IA" : card ? "Salvar alterações" : "Salvar card"}
            </button>
          </div>
        </fieldset>
      </form>
      {quickCreate && <section className="created-cards" aria-labelledby="created-cards-heading">
        <h3 id="created-cards-heading">Criados agora <span className="created-cards-count">{createdCards.length}</span></h3>
        <p className="muted">Tudo salvo. Edite quando quiser.</p>
        {createdCards.length === 0 ? <p className="notice">Seus cards aparecerão aqui assim que forem criados.</p> : <div className="created-cards-grid" ref={recentGrid}>
          {createdCards.map(created => <RecentCreatedCard key={created.id} card={created} disabled={busy || actionBusy} onBusyChange={setActionBusy}
            onChanged={updated => {
              setCreatedCards(items => items.map(item => item.id === updated.id ? updated : item));
              onSaved(true);
            }}
            onDeleted={() => {
              setCreatedCards(items => items.filter(item => item.id !== created.id));
              onSaved(true);
            }} />)}
        </div>}
      </section>}
      </div>
    </Modal>
  );
}
