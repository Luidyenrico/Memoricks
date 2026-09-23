export function parseApiDate(value: string): Date {
  // Compatibility with older API responses that stored UTC without an offset.
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseApiDate(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function reviewDueLabel(value: string, now = new Date()): string {
  const date = parseApiDate(value);
  const milliseconds = date.getTime() - now.getTime();
  if (Number.isNaN(milliseconds)) return "Data indisponível";
  if (milliseconds <= 0) return "Revisão pendente";
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `Revisão em ${minutes} min`;
  if (minutes < 24 * 60) return `Revisão em ${Math.ceil(minutes / 60)} h`;
  return `Revisão em ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}
