"use client";
import { useId } from "react";
import { CardTemplate } from "@/lib/api";
import { CardContent } from "./CardContent";

export default function ReviewPages({
  template,
  values,
  side,
  onFlip,
  disabled,
}: {
  template: CardTemplate;
  values: Record<string, string>;
  side: "front" | "back";
  onFlip: () => void;
  disabled: boolean;
}) {
  const contentId = useId();
  return (
    <div className={`review-reader review-${side}`}>
      <div
        className="review-pages"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={contentId}
        aria-label={
          side === "front"
            ? "Virar card para ver a resposta"
            : "Virar card para ver a pergunta"
        }
        onClick={() => {
          if (!disabled && !window.getSelection()?.toString()) onFlip();
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const card = event.currentTarget.closest("article");
            onFlip();
            requestAnimationFrame(() =>
              card?.querySelector<HTMLElement>(".review-pages")?.focus(),
            );
          }
        }}
      >
        <div className="review-page-content" id={contentId} aria-live="polite">
          <CardContent
            template={template}
            values={values}
            side={side}
          />
        </div>
        <span className="card-flip-hint" aria-hidden="true">
          <span>↻</span> Clique no card para virar
        </span>
      </div>
    </div>
  );
}
