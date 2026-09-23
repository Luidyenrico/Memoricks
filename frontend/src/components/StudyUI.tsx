import Link from "next/link";
import { Stats } from "@/lib/api";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Caminho de navegação">
      <ol>
        <li>
          <Link href="/">Início</Link>
        </li>
        {items.map((item, index) => (
          <li key={index}>
            <span aria-hidden="true">/</span>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function ErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <p className="notice error" role="alert">
      {message}
    </p>
  ) : null;
}
export function Loading({
  error,
  retry,
}: {
  error: string | null;
  retry: () => void;
}) {
  return (
    <div className="empty-state">
      {error ? (
        <>
          <ErrorMessage message={error} />
          <button className="button secondary" onClick={retry}>
            Tentar novamente
          </button>
        </>
      ) : (
        <p role="status">Carregando seu espaço de estudo…</p>
      )}
    </div>
  );
}
export function Progress({ stats }: { stats: Stats }) {
  return (
    <div className="progress-block">
      <div className="spread">
        <span>
          {stats.learned} de {stats.total} cards aprendidos
        </span>
        <strong>{stats.percent}%</strong>
      </div>
      <progress
        max={100}
        value={stats.percent}
        aria-label="Proporção de cards aprendidos"
      />
    </div>
  );
}
export function Metrics({ stats }: { stats: Stats }) {
  return (
    <div className="metrics">
      {[
        [stats.total, "Cards no total"],
        [stats.active, "Em estudo"],
        [stats.pending, "Para revisar"],
        [stats.learned, "Aprendidos"],
      ].map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol" aria-hidden="true">
        ✦
      </div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
