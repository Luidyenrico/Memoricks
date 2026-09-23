"use client";

import { useCallback, useState } from "react";
import type { PointerEvent } from "react";
import { fetchStatistics, StatisticsData, StatisticsDay, StatisticsGroup, StatisticsPeriod } from "@/lib/statistics";
import { useResource } from "@/lib/useResource";
import { Loading, Metrics } from "./StudyUI";

function dateLabel(date: string, full = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: full ? "long" : "short",
    ...(full ? { year: "numeric" as const } : {}),
  });
}

const WIDTH = 640;
const HEIGHT = 220;
const LEFT = 38;
const RIGHT = 16;
const TOP = 16;
const BOTTOM = 30;

function TimelineCharts({ data }: { data: StatisticsData }) {
  const [selected, setSelected] = useState(data.timeline.length - 1);
  const [hovered, setHovered] = useState<number | null>(null);
  const points = data.timeline;
  const displayed = hovered ?? selected;
  const current = points[displayed];
  const selectedDay = points[selected];
  const learnedMax = points.reduce((max, point) => Math.max(max, point.learned_total), 1);
  const activityMax = points.reduce((max, point) => Math.max(max, point.created, point.learned), 1);
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const x = (index: number) => LEFT + (index / Math.max(1, points.length - 1)) * plotWidth;
  const y = (value: number, max: number) => TOP + plotHeight - (value / max) * plotHeight;
  const line = (key: keyof Pick<StatisticsDay, "learned_total" | "learned" | "created">, max: number) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key], max)}`).join(" ");
  const learnedPath = line("learned_total", learnedMax);

  function inspect(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "touch") return;
    const transform = event.currentTarget.getScreenCTM();
    if (!transform) return;
    const position = new DOMPoint(event.clientX, event.clientY)
      .matrixTransform(transform.inverse()).x;
    setHovered(Math.max(0, Math.min(points.length - 1,
      Math.round(((position - LEFT) / plotWidth) * (points.length - 1)))));
  }
  const hoverHandlers = {
    onPointerMove: inspect,
    onPointerLeave: () => setHovered(null),
    onPointerCancel: () => setHovered(null),
  };

  function grid(max: number) {
    const ticks = [...new Set([0, Math.ceil(max / 2), max])];
    return (
      <>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick, max)} y2={y(tick, max)} className="statistics-grid-line" />
            <text x={LEFT - 10} y={y(tick, max) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        <text x={LEFT} y={HEIGHT - 6}>{dateLabel(points[0].date)}</text>
        <text x={WIDTH - RIGHT} y={HEIGHT - 6} textAnchor="end">{dateLabel(points[points.length - 1].date)}</text>
      </>
    );
  }

  return (
    <section className="statistics-history" aria-label="Evolução no período">
      <div className="statistics-chart-grid">
        <article className="statistics-panel">
          <div className="statistics-panel-heading">
            <div><h2>Evolução do aprendizado</h2><p>{hovered === null ? "Cards aprendidos, acumulados por dia" : dateLabel(current.date, true)}</p></div>
            <strong className="statistics-chart-value">{current.learned_total}</strong>
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="statistics-chart" {...hoverHandlers} role="img" aria-label={`Evolução dos cards aprendidos. ${dateLabel(current.date, true)}: ${current.learned_total} cards.`}>
            <defs><linearGradient id="learned-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand-blue)" stopOpacity=".25" /><stop offset="100%" stopColor="var(--brand-blue)" stopOpacity="0" /></linearGradient></defs>
            {grid(learnedMax)}
            <path d={`${learnedPath} L ${x(points.length - 1)} ${y(0, learnedMax)} L ${LEFT} ${y(0, learnedMax)} Z`} fill="url(#learned-area)" />
            <path d={learnedPath} fill="none" stroke="var(--accent-blue)" strokeWidth="3" strokeLinejoin="round" />
            <line x1={x(displayed)} x2={x(displayed)} y1={TOP} y2={y(0, learnedMax)} className="statistics-cursor" />
            <circle cx={x(displayed)} cy={y(current.learned_total, learnedMax)} r="5" fill="var(--accent-blue)" stroke="var(--bg-dark)" strokeWidth="2" />
          </svg>
        </article>
        <article className="statistics-panel">
          <div className="statistics-panel-heading">
            <div><h2>Atividade dos cards</h2><p>{hovered === null ? "Criação e aprendizado registrados por dia" : `${dateLabel(current.date, true)} · ${current.created} criados · ${current.learned} aprendidos`}</p></div>
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="statistics-chart" {...hoverHandlers} role="img" aria-label={`Atividade dos cards. ${dateLabel(current.date, true)}: ${current.created} criados e ${current.learned} aprendidos.`}>
            {grid(activityMax)}
            <path d={line("created", activityMax)} fill="none" stroke="var(--accent-blue)" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={line("learned", activityMax)} fill="none" stroke="var(--success)" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" />
            <line x1={x(displayed)} x2={x(displayed)} y1={TOP} y2={y(0, activityMax)} className="statistics-cursor" />
            <circle cx={x(displayed)} cy={y(current.created, activityMax)} r="4" fill="var(--accent-blue)" />
            <circle cx={x(displayed)} cy={y(current.learned, activityMax)} r="4" fill="var(--success)" />
          </svg>
          <div className="statistics-legend"><span><i className="created" /> Criados</span><span><i className="learned" /> Aprendidos</span></div>
        </article>
      </div>
      <div className="statistics-inspector">
        <label htmlFor="statistics-day">Consultar dia <strong>{dateLabel(selectedDay.date, true)}</strong></label>
        <input id="statistics-day" type="range" min={0} max={points.length - 1} value={selected} onChange={(event) => { setSelected(Number(event.target.value)); setHovered(null); }} aria-valuetext={`${dateLabel(selectedDay.date, true)}: ${selectedDay.created} criados, ${selectedDay.learned} aprendidos, ${selectedDay.learned_total} aprendidos acumulados`} />
        <span>{selectedDay.created} criados · {selectedDay.learned} aprendidos</span>
      </div>
      <p className="statistics-note">Os gráficos consideram os cards que você mantém na biblioteca e suas datas de criação e aprendizado. O histórico de cada revisão ainda não é registrado.</p>
      {data.learned_without_date > 0 && <p className="statistics-note">{data.learned_without_date} cards aprendidos sem data registrada aparecem nos indicadores, mas não nos gráficos.</p>}
    </section>
  );
}

export default function StatisticsScreen() {
  const [days, setDays] = useState<StatisticsPeriod>(30);
  const [groupId, setGroupId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [resetRevision, setResetRevision] = useState(0);
  const [groups, setGroups] = useState<StatisticsGroup[]>([]);
  const loader = useCallback(async () => {
    const data = await fetchStatistics(days, groupId, subgroupId);
    setGroups(data.groups);
    return data;
  }, [days, groupId, subgroupId]);
  const { data, error, reload } = useResource(loader);
  const selectedGroup = groups.find((group) => String(group.id) === groupId);

  return (
    <main id="main-content" className="page statistics-page">
      <div className="hero compact">
        <div><p className="eyebrow">SEU APRENDIZADO</p><h1>Estatísticas</h1><p className="lead">Acompanhe seu progresso e descubra onde concentrar seus estudos.</p></div>
      </div>
      <div className="statistics-filters" aria-label="Filtros de estatísticas">
        <label>Grupo<select value={groupId} onChange={(event) => { setGroupId(event.target.value); setSubgroupId(""); }}><option value="">Todos os grupos</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}</select></label>
        <label>Subgrupo<select value={subgroupId} disabled={!groupId} onChange={(event) => setSubgroupId(event.target.value)}><option value="">Todos os subgrupos</option>{selectedGroup?.subgroups.map((subgroup) => <option key={subgroup.id} value={subgroup.id}>{subgroup.title}</option>)}</select></label>
        <label>Período dos gráficos<select value={days} onChange={(event) => setDays(event.target.value === "all" ? "all" : Number(event.target.value))}>{[7, 30, 90, 365].map((value) => <option key={value} value={value}>Últimos {value} dias</option>)}<option value="all">Desde o início</option></select></label>
        <button type="button" className="button secondary statistics-clear" onClick={() => {
          setGroupId("");
          setSubgroupId("");
          setDays(30);
          setResetRevision((value) => value + 1);
        }}>Limpar filtros</button>
      </div>
      {!data ? <Loading error={error} retry={reload} /> : <>
        <div className="statistics-current"><h2>Situação atual</h2><span className="muted">{selectedGroup?.title || "Todos os grupos"}{subgroupId ? ` / ${selectedGroup?.subgroups.find((item) => String(item.id) === subgroupId)?.title || ""}` : ""}</span></div>
        <Metrics stats={data.summary} />
        <TimelineCharts key={`${days}-${groupId}-${subgroupId}-${resetRevision}`} data={data} />
        <section className="statistics-panel statistics-distribution">
          <div className="statistics-panel-heading">
            <div><h2>Distribuição por {data.distribution_level === "groups" ? "grupo" : "subgrupo"}</h2><p>{data.distribution_level === "groups" ? "Selecione um grupo para detalhar seus subgrupos." : "Compare o progresso dos seus subgrupos."}</p></div>
            <div className="statistics-legend"><span><i className="learned" /> Aprendidos</span><span><i className="created" /> Em estudo</span></div>
          </div>
          {data.distribution.length === 0 ? <p className="statistics-empty">Seus temas aparecerão aqui quando você começar sua biblioteca.</p> : <div className="statistics-distribution-list">{data.distribution.map((item) => (
            <button key={item.id} className="statistics-distribution-row" onClick={() => { if (data.distribution_level === "groups") { setGroupId(String(item.id)); setSubgroupId(""); } else { setSubgroupId(String(item.id)); } }} aria-label={`Ver estatísticas de ${item.title}: ${item.stats.total} cards, ${item.stats.learned} aprendidos, ${item.stats.pending} para revisar`}>
              <span className="statistics-row-title"><i style={{ backgroundColor: item.color }} /><strong>{item.title}</strong><small>{item.stats.total} cards · {item.stats.pending} para revisar</small></span>
              <span className="statistics-row-progress"><span className="statistics-stacked-bar" aria-hidden="true"><i style={{ width: `${item.stats.percent}%` }} /><i style={{ width: `${item.stats.total ? 100 - item.stats.percent : 0}%` }} /></span><small>{item.stats.learned} aprendidos · {item.stats.active} em estudo</small></span>
              <span className="statistics-row-percent">{item.stats.percent}% <span aria-hidden="true">↗</span></span>
            </button>
          ))}</div>}
        </section>
      </>}
    </main>
  );
}
