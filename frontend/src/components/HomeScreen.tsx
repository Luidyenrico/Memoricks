"use client";
import Link from "next/link";
import { CSSProperties, useCallback, useState } from "react";
import { api, Group } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { GroupForm } from "./CollectionForms";
import { EmptyState, Loading } from "./StudyUI";
import "./content-management.css";
import SubgroupStudyAction from "./SubgroupStudyAction";
import AppIcon from "./AppIcon";

function ThemeSubgroups({ group }: { group: Group }) {
  const loader = useCallback(() => api.group(group.id), [group.id]);
  const { data, error, reload } = useResource(loader);
  if (!data) return <Loading error={error} retry={reload} />;
  return data.subgroups.length ? (
    <div className="theme-subgroups">
      {data.subgroups.map((subgroup) => (
        <article
          className="theme-subgroup-row"
          key={subgroup.id}
        >
          <div className="theme-subgroup-info">
          <Link className="theme-subgroup-name" href={`/subgroups/${subgroup.id}`}>
            <h3>{subgroup.title}</h3>
          </Link>
          <div className="theme-subgroup-meta">
            <span>{subgroup.stats.total} cards</span>
            <span>{subgroup.stats.learned} aprendidos</span>
            <span>{subgroup.stats.percent}% concluído</span>
          </div>
          </div>
          <div className="theme-subgroup-actions">
            <Link className="button secondary small" href={`/subgroups/${subgroup.id}`} aria-label={`Ver cards de ${subgroup.title}`}>Ver cards</Link>
            <SubgroupStudyAction subgroup={subgroup} from="library" />
          </div>
        </article>
      ))}
    </div>
  ) : (
    <div className="theme-empty-subgroups">
      <span className="muted">Nenhum subgrupo neste tema.</span>
      <Link className="text-button" href={`/groups/${group.id}`}>
        Adicionar um subgrupo →
      </Link>
    </div>
  );
}

function ThemeRow({ group, initiallyOpen }: { group: Group; initiallyOpen: boolean }) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  return (
    <article
      className="theme-library-item"
      style={{ "--topic-color": group.color } as CSSProperties}
    >
      <div className="theme-library-header">
        <Link className="theme-library-link" href={`/groups/${group.id}`}>
          <span className="topic-symbol" aria-hidden="true">
            {group.title.slice(0, 2).toUpperCase()}
          </span>
          <div className="theme-library-title">
            <h2>{group.title}</h2>
            <span className="muted">{group.description || "Organize os assuntos deste tema."}</span>
          </div>
        </Link>
        <div className="theme-library-actions">
          <span className={`theme-library-due${group.stats.pending ? " has-due" : ""}`}>{group.stats.pending ? `${group.stats.pending} para revisar` : "Em dia"}</span>
          <button
            className="button secondary small"
            aria-label={`${expanded ? "Ocultar" : "Ver"} subgrupos de ${group.title}`}
            aria-expanded={expanded}
            aria-controls={`theme-subgroups-${group.id}`}
            onClick={() => setExpanded(!expanded)}
          >
            {group.subgroup_count} {group.subgroup_count === 1 ? "subgrupo" : "subgrupos"}
            <span className={expanded ? "theme-chevron expanded" : "theme-chevron"} aria-hidden="true">⌄</span>
          </button>
        </div>
      </div>
      <div id={`theme-subgroups-${group.id}`} hidden={!expanded}>
        {expanded && <ThemeSubgroups group={group} />}
      </div>
    </article>
  );
}

export default function ThemesScreen({ initialGroup }: { initialGroup?: number }) {
  const { data: groups, error, reload } = useResource(api.groups);
  const [creating, setCreating] = useState(false);
  const totals = groups?.reduce((sum, group) => ({
    total: sum.total + group.stats.total,
    pending: sum.pending + group.stats.pending,
    learned: sum.learned + group.stats.learned,
  }), { total: 0, pending: 0, learned: 0 });
  const openGroup = initialGroup ?? groups?.find(group => group.stats.pending > 0)?.id;
  return (
    <main id="main-content" className="page themes-page content-page">
      <div className="hero compact">
        <div>
          <p className="eyebrow">SUA BIBLIOTECA</p>
          <h1>Meus temas</h1>
          <p className="lead">Organize seus assuntos, acompanhe o progresso e revise em um só lugar.</p>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          + Novo tema
        </button>
      </div>
      {!groups ? (
        <Loading error={error} retry={reload} />
      ) : !groups.length ? (
        <EmptyState title="Seu próximo aprendizado começa aqui">
          <p>Crie um tema e adicione subgrupos para organizar seus cards.</p>
          <button className="button primary" onClick={() => setCreating(true)}>
            Criar meu primeiro tema
          </button>
        </EmptyState>
      ) : (
        <>
          <div className="library-summary" aria-label="Resumo dos estudos">
            <div className="library-summary-due"><AppIcon name="review" /><div><strong>{totals!.pending}</strong><span>para revisar</span></div></div>
            <div><AppIcon name="themes" /><div><strong>{totals!.total}</strong><span>cards no total</span></div></div>
            <div><AppIcon name="check" /><div><strong>{totals!.learned}</strong><span>aprendidos</span></div></div>
          </div>
          <div className="section-heading themes-section-heading">
            <h2>Todos os temas <span className="muted">({groups.length})</span></h2>
            <span className="muted">Escolha um subgrupo para estudar ou criar cards</span>
          </div>
          <div className="theme-library">
            {groups.map((group) => <ThemeRow key={group.id} group={group} initiallyOpen={group.id === openGroup} />)}
          </div>
        </>
      )}
      {creating && (
        <GroupForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </main>
  );
}
