"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { Loading } from "./StudyUI";
import ReviewSession from "./ReviewSession";

export default function ReviewScreen({
  id,
  practice,
  from,
}: {
  id: number;
  practice: boolean;
  from?: string;
}) {
  const loader = useCallback(() => api.subgroup(id), [id]);
  const { data, error, reload } = useResource(loader);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const exitHref = from === "home" ? "/"
    : from === "themes" ? `/subgroups/${id}`
    : from === "group" && data ? `/groups/${data.group_id}`
    : data ? `/themes?group=${data.group_id}` : "/themes";
  useEffect(() => {
    document.documentElement.dataset.reviewBusy = String(busy);
    window.dispatchEvent(new CustomEvent("memoricks-review-busy", { detail: busy }));
    return () => {
      delete document.documentElement.dataset.reviewBusy;
      window.dispatchEvent(new CustomEvent("memoricks-review-busy", { detail: false }));
    };
  }, [busy]);
  return (
    <main id="main-content" className="review-screen">
      <header className="focus-header">
        <div>
          <p className="eyebrow">
            {data?.group.title || "MEMORICKS"} /{" "}
            {practice ? "PRÁTICA LIVRE" : "REVISÃO"}
          </p>
          <h1>{data?.title || "Preparando sua revisão"}</h1>
        </div>
        <button
          className="icon-button review-exit"
          aria-label="Sair da revisão"
          title={
            busy
              ? "Aguarde o salvamento da resposta"
              : "Sair — suas respostas já estão salvas"
          }
          disabled={busy}
          onClick={() => router.push(exitHref)}
        >
          ×
        </button>
      </header>
      {data ? (
        <ReviewSession
          subgroup={data}
          practice={practice}
          onBusyChange={setBusy}
          exitHref={exitHref}
        />
      ) : (
        <Loading error={error} retry={reload} />
      )}
    </main>
  );
}
