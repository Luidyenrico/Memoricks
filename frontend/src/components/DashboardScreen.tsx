"use client";
import Link from "next/link";
import { CSSProperties } from "react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { EmptyState, Loading } from "./StudyUI";
import ReviewShortcuts from "./ReviewShortcuts";
import AppIcon from "./AppIcon";

async function loadDashboard() {
  const [groups, shortcuts] = await Promise.all([api.groups(), api.reviewShortcuts()]);
  return { groups, shortcuts };
}

export default function DashboardScreen() {
  const { data, error, reload } = useResource(loadDashboard);
  const totals = data?.groups.reduce((sum, group) => ({
    total: sum.total + group.stats.total,
    learned: sum.learned + group.stats.learned,
    active: sum.active + group.stats.active,
    pending: sum.pending + group.stats.pending,
  }), { total: 0, learned: 0, active: 0, pending: 0 });
  const next = data?.shortcuts.find((item) => item.stats.pending > 0);
  const percent = totals?.total ? Math.round(totals.learned / totals.total * 100) : 0;
  return <main id="main-content" className="page dashboard-page">
    <div className="hero"><div><h1>Seu aprendizado, em dia.</h1><p className="lead">Um próximo passo para fortalecer o que você sabe.</p></div></div>
    {!data || !totals ? <Loading error={error} retry={reload} /> : <>
      <div className="dashboard-summary">
        <section className="dashboard-review" aria-labelledby="today-review">
          <p className="eyebrow">SUA REVISÃO</p>
          <h2 id="today-review">{totals.pending ? `${totals.pending} cards para revisar` : "Tudo em dia por aqui."}</h2>
          <p className="muted">{next ? `Comece por ${next.title}, em ${next.group_title}, e retome seus estudos.` : "Escolha um assunto para praticar no seu ritmo."}</p>
          <Link className="button primary" href={next ? `/review/${next.id}?from=home` : "/themes"}>
            <AppIcon name="review" />{next ? "Iniciar revisão" : "Escolher uma revisão"}
          </Link>
        </section>
        <section className="dashboard-progress" aria-label="Progresso geral">
          <h2>Seu progresso geral</h2>
          <div className="progress-ring" style={{ "--progress": `${percent}%` } as CSSProperties}>
            <div><strong>{percent}%</strong><span>aprendidos</span></div>
          </div>
          <Link href="/statistics">Ver estatísticas →</Link>
        </section>
      </div>
      <div className="dashboard-totals">
        {([
          [totals.total, "Cards no total", "themes"],
          [totals.learned, "Aprendidos", "statistics"],
          [totals.active, "Em estudo", "review"],
        ] as const).map(([value, label, icon]) => <div key={label}><AppIcon name={icon} /><div><strong>{value}</strong><span>{label}</span></div></div>)}
      </div>
      {data.groups.length ? <ReviewShortcuts data={data.shortcuts} /> : <EmptyState title="Seu próximo aprendizado começa aqui">
        <p>Organize seus temas e subgrupos para começar a estudar.</p>
        <Link href="/themes" className="button secondary">Ir para Meus temas →</Link>
      </EmptyState>}
    </>}
  </main>;
}
