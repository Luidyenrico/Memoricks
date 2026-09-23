"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { api, SubgroupDetail } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { EmptyState, ErrorMessage, Loading } from "./StudyUI";
import ReviewPages from "./ReviewPages";

export default function ReviewSession({
  subgroup,
  practice,
  onBusyChange,
  exitHref,
}: {
  subgroup: SubgroupDetail;
  practice: boolean;
  onBusyChange: (busy: boolean) => void;
  exitHref: string;
}) {
  const loader = useCallback(
    () => api.cards(subgroup.id, practice ? "active" : "pending", "", 0, 200),
    [subgroup.id, practice],
  );
  const { data, error, reload } = useResource(loader);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [saved, setSaved] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const queue = data?.items.filter((card) => !card.needs_attention) || [];
  const current = queue[index];
  async function answer(action: "difficult" | "medium" | "easy" | "master") {
    if (!current || saving.current) return;
    saving.current = true;
    setBusy(true);
    onBusyChange(true);
    setActionError(null);
    try {
      await api.review(current, action);
      setSaved((value) => value + 1);
      setIndex((value) => value + 1);
      setRevealed(false);
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  function restart() {
    setIndex(0);
    setSaved(0);
    setRevealed(false);
    setActionError(null);
    reload();
  }
  if (!data) return <Loading error={error} retry={reload} />;
  if (!current)
    return (
      <div className="focus-complete">
        <EmptyState
          title={
            saved
              ? "Mais um passo no seu aprendizado."
              : "Tudo em dia por aqui!"
          }
        >
          <p>
            {saved
              ? `Você revisou ${saved} cards de ${subgroup.title} nesta sessão.`
              : `Não há cards disponíveis para esta revisão em ${subgroup.title}.`}
          </p>
          {data.total > 200 && (
            <p>
              Esta sessão mostra até 200 cards. Abra uma nova sessão para
              continuar.
            </p>
          )}
          <div className="actions wrap center">
            <Link className="button primary" href={exitHref}>
              {exitHref === "/" ? "Voltar ao início" : exitHref.startsWith("/themes") ? "Voltar a Meus temas" : exitHref.startsWith("/groups/") ? "Voltar ao tema" : "Voltar ao subgrupo"}
            </Link>
            <button className="button secondary" onClick={restart}>
              Verificar novas revisões
            </button>
            {!practice && (subgroup.stats.reviewable ?? Math.max(0, subgroup.stats.active - subgroup.stats.attention)) > 0 && (
              <Link
                className="button secondary"
                href={`/review/${subgroup.id}?all=1&from=${exitHref === "/" ? "home" : exitHref.startsWith("/themes") ? "library" : exitHref.startsWith("/groups/") ? "group" : "themes"}`}
              >
                Praticar cards em estudo
              </Link>
            )}
          </div>
          <p className="muted">Suas respostas já estão salvas.</p>
        </EmptyState>
      </div>
    );
  return (
    <section className="focus-session" aria-label="Sessão de revisão">
      <div className="focus-progress">
        <span>
          Card {index + 1} de {queue.length}
        </span>
        <progress
          max={queue.length}
          value={index}
          aria-label="Progresso da sessão"
        />
        <span>{saved} revisados</span>
      </div>
      <article
        className="focus-card"
        aria-label={revealed ? "Resposta do card" : "Pergunta do card"}
      >
        <ReviewPages
          key={`${current.id}-${revealed}`}
          template={current.template}
          values={current.values}
          side={revealed ? "back" : "front"}
          onFlip={() => setRevealed((value) => !value)}
          disabled={busy}
        />
      </article>
      <footer className="focus-controls">
        <ErrorMessage message={actionError} />
        {busy && (
          <span role="status" className="saving-status">
            Salvando sua revisão…
          </span>
        )}
        <div className="focus-ratings">
          <button
            className="rating-difficult"
            disabled={busy || !revealed}
            onClick={() => answer("difficult")}
            title="Revisar em 5 minutos"
            aria-label="Difícil (5m)"
          >
            <span>Difícil</span><small>Rever em 5 min</small>
          </button>
          <button
            className="rating-medium"
            disabled={busy || !revealed}
            onClick={() => answer("medium")}
            title="Revisar em 1 hora"
            aria-label="Médio (1h)"
          >
            <span>Médio</span><small>Rever em 1 hora</small>
          </button>
          <button
            className="rating-easy"
            disabled={busy || !revealed}
            onClick={() => answer("easy")}
            title="Revisar em 1 dia"
            aria-label="Fácil (1d)"
          >
            <span>Fácil</span><small>Rever em 1 dia</small>
          </button>
        </div>
        <div className="focus-mastery">
          {revealed && current.difficulty_level === "Easy" && (
            <button disabled={busy} onClick={() => answer("master")}>
              ✓ Dominei completamente
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
