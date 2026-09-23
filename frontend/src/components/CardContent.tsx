import type { CSSProperties } from "react";
import type { CardTemplate } from "@/lib/api";

export function CardContent({
  template,
  values,
  side,
}: {
  template: CardTemplate;
  values: Record<string, string>;
  side?: "front" | "back";
}) {
  return (
    <div className="card-content">
      {template.fields
        .filter((field) => !side || field.side === side)
        .map((field) => {
          const value = values[field.id];
          if (!value?.trim()) return null;
          const style: CSSProperties = {
            fontFamily:
              field.font === "mono"
                ? "var(--font-geist-mono), monospace"
                : field.font === "serif"
                  ? "Georgia, serif"
                  : "inherit",
            fontSize: { small: "0.9rem", medium: "1rem", large: "1.35rem" }[
              field.size
            ],
            color: field.color || undefined,
            backgroundColor: field.background || undefined,
          };
          return (
            <section
              key={field.id}
              className={field.background ? "card-field tinted" : "card-field"}
              style={style}
            >
              <h3>{field.label}</h3>
              {field.format === "code" ? (
                <pre tabIndex={0} aria-label={field.label}>
                  <code>{value}</code>
                </pre>
              ) : field.format === "list" ? (
                <ul>
                  {value
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line, index) => (
                      <li key={index}>{line.replace(/^[-•]\s*/, "")}</li>
                    ))}
                </ul>
              ) : (
                <p>{value}</p>
              )}
            </section>
          );
        })}
    </div>
  );
}

export function CardFields({
  template,
  values,
  onChange,
}: {
  template: CardTemplate;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  return (
    <div className="form-stack">
      {template.fields.map((field) => (
        <label key={field.id}>
          <span>
            {field.label}{" "}
            {field.required ? (
              <span aria-hidden="true">*</span>
            ) : (
              <small>· opcional</small>
            )}{" "}
            <small>· {field.side === "front" ? "frente" : "verso"}</small>
          </span>
          {field.instructions && (
            <small className="field-help">{field.instructions}</small>
          )}
          <textarea
            value={values[field.id] || ""}
            onChange={(event) =>
              onChange({ ...values, [field.id]: event.target.value })
            }
            required={field.required}
            maxLength={field.max_chars}
            rows={field.format === "code" ? 6 : 3}
            className={field.format === "code" ? "code-input" : ""}
            spellCheck={field.format !== "code"}
          />
          <small>
            {(values[field.id] || "").length}/{field.max_chars} caracteres
          </small>
        </label>
      ))}
    </div>
  );
}
