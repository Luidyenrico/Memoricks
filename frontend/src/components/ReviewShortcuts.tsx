"use client";
import Link from "next/link";
import { CSSProperties } from "react";
import { api } from "@/lib/api";

function buttonTextColor(color: string) {
  const channels = color.match(/[a-f\d]{2}/gi);
  if (!channels || channels.length !== 3) return "#111827";
  const [r, g, b] = channels.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 0.179 ? "#000000" : "#ffffff";
}

export default function ReviewShortcuts({ data }: { data: Awaited<ReturnType<typeof api.reviewShortcuts>> }) {
  return (
    <section className="review-shortcuts" aria-labelledby="shortcuts-title">
      <div className="section-heading">
        <div>
          <h2 id="shortcuts-title">Continue seus estudos</h2>
        </div>
        <Link className="text-button" href="/themes">Todos os temas →</Link>
      </div>
      {data.length === 0 ? (
        <p className="shortcut-empty">
          Seus subgrupos aparecerão aqui quando tiverem cards em estudo prontos
          para revisar.
        </p>
      ) : (
        <div className="shortcut-grid">
          {data.map((subgroup) => (
            <article
              className="shortcut-card"
              key={subgroup.id}
              style={
                {
                  "--topic-color": subgroup.color,
                  "--topic-ink": buttonTextColor(subgroup.color),
                } as CSSProperties
              }
            >
              <div className="shortcut-identity">
                <span className="topic-symbol" aria-hidden="true">
                  {subgroup.title.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="eyebrow">{subgroup.group_title}</p>
                  <h3>{subgroup.title}</h3>
                </div>
              </div>
              <p className="muted">
                {subgroup.stats.total} cards · {subgroup.stats.learned}{" "}
                aprendidos
              </p>
              <div className="spread">
                <span className={subgroup.stats.pending ? "tag accent" : "tag"}>
                  {subgroup.stats.pending
                    ? `${subgroup.stats.pending} para revisar`
                    : "Em dia · prática livre"}
                </span>
                <div className="actions wrap">
                <Link
                  className="button secondary"
                  aria-label={`Ver tema ${subgroup.title}`}
                  href={`/subgroups/${subgroup.id}?view=active`}
                >
                  Ver tema
                </Link>
                <Link
                  className="button primary"
                  aria-label={`Revisar ${subgroup.title}`}
                  href={`/review/${subgroup.id}?from=home${subgroup.stats.pending ? "" : "&all=1"}`}
                >
                  Revisar →
                </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
