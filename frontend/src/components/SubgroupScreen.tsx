"use client";
import Link from "next/link";
import { CSSProperties, useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import CardBrowser from "./CardBrowser";
import CardEditor from "./CardEditor";
import BatchCardEditor from "./BatchCardEditor";
import SubgroupSettings from "./SubgroupSettings";
import { Breadcrumbs, Loading } from "./StudyUI";
import AppIcon from "./AppIcon";
import "./content-management.css";

export default function SubgroupScreen({ id, view }: { id: number; view: string }) {
  const loader = useCallback(() => api.subgroup(id), [id]);
  const { data: subgroup, error, reload, setData } = useResource(loader);
  const [creating, setCreating] = useState(false);
  const [batchCreating, setBatchCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [cardRevision, setCardRevision] = useState(0);
  async function refresh() {
    try {
      setData(await api.subgroup(id));
    } catch {
      setNotice("Alteração salva. Recarregue a página para atualizar os totais.");
    }
  }
  if (!subgroup)
    return (
      <main id="main-content" className="page content-page">
        <Link className="library-back-link" href="/themes">← Voltar a Meus temas</Link>
        <Breadcrumbs items={[{ label: "Meus temas", href: "/themes" }, { label: "Subgrupo" }]} />
        <Loading error={error} retry={reload} />
      </main>
    );
  const currentView = view === "overview" ? "active" : view;
  const canReview = (subgroup.stats.reviewable ?? Math.max(0, subgroup.stats.active - subgroup.stats.attention)) > 0;
  const tabs = [
    { key: "active", label: "Em estudo", count: subgroup.stats.active },
    { key: "learned", label: "Aprendidos", count: subgroup.stats.learned },
    { key: "settings", label: "Configurações" },
  ];
  return (
    <main
      id="main-content"
      className="page content-page"
      style={{ "--topic-color": subgroup.group.color } as CSSProperties}
    >
      <Link className="library-back-link" href={`/themes?group=${subgroup.group_id}`}>← Voltar a Meus temas</Link>
      <Breadcrumbs
        items={[
          { label: "Meus temas", href: "/themes" },
          { label: subgroup.group.title, href: `/groups/${subgroup.group_id}` },
          { label: subgroup.title },
        ]}
      />
      <div className="hero compact">
        <div>
          <p className="eyebrow">{subgroup.group.title} / SUBGRUPO</p>
          <h1>{subgroup.title}</h1>
          <p className="lead">{subgroup.description || "Seus cards, conteúdos e modelos neste subgrupo."}</p>
        </div>
        <div className="actions">
        <button className="button secondary" onClick={() => setBatchCreating(true)}>Criar vários cards com IA</button>
        <button className="button primary" onClick={() => setCreating(true)}>
          + Criar card
        </button>
        </div>
      </div>
      <div className="content-summary">
        <span><strong>{subgroup.stats.total}</strong> cards no total</span>
        <span><strong>{subgroup.stats.percent}%</strong> aprendidos</span>
        <span><strong>{subgroup.stats.pending}</strong> aguardando revisão</span>
      </div>
      <nav className="tabs" aria-label="Navegação do subgrupo">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/subgroups/${id}?view=${tab.key}`}
            aria-current={currentView === tab.key ? "page" : undefined}
          >
            {tab.label}
            {tab.count !== undefined && <span>{tab.count}</span>}
          </Link>
        ))}
      </nav>
      {currentView === "active" && (subgroup.stats.pending > 0 || canReview) && (
        <section className="subgroup-review-entry" aria-label="Revisar este subgrupo">
          <div>
            <h2>{subgroup.stats.pending ? `${subgroup.stats.pending} ${subgroup.stats.pending === 1 ? "card" : "cards"} para revisar` : "Revisão em dia"}</h2>
            <p>{subgroup.stats.pending ? "Comece uma sessão de estudo com os cards pendentes." : "Pratique seus cards enquanto aguarda a próxima revisão."}</p>
          </div>
          <Link className="button primary" href={`/review/${id}?from=themes${subgroup.stats.pending ? "" : "&all=1"}`}>
            <AppIcon name="review" />{subgroup.stats.pending ? "Revisar agora" : "Praticar cards"}
          </Link>
        </section>
      )}
      {notice && <p className="notice" role="status">{notice}</p>}
      {currentView !== "settings" && subgroup.stats.attention > 0 && (
        <p className="notice">
          {subgroup.stats.attention} cards precisam de conteúdo completo. Abra um card marcado para completar ou corrigir os campos.
        </p>
      )}
      {(currentView === "active" || currentView === "learned") && (
        <CardBrowser
          key={`${currentView}-${cardRevision}`}
          subgroup={subgroup}
          learned={currentView === "learned"}
          onChanged={refresh}
        />
      )}
      {currentView === "settings" && <SubgroupSettings subgroup={subgroup} onSaved={refresh} />}
      {batchCreating && <BatchCardEditor subgroup={subgroup} onClose={() => setBatchCreating(false)} onSaved={(count) => {
        setBatchCreating(false);
        setNotice(`${count} cards criados. Prontos para estudar.`);
        setCardRevision(revision => revision + 1);
        void refresh();
      }} />}
      {creating && (
        <CardEditor
          subgroup={subgroup}
          onClose={() => setCreating(false)}
          onSaved={(keepOpen) => {
            if (!keepOpen) setCreating(false);
            setNotice(keepOpen ? "Cards atualizados." : "Card criado. Seu próximo aprendizado já está em estudo.");
            setCardRevision((revision) => revision + 1);
            void refresh();
          }}
        />
      )}
    </main>
  );
}
