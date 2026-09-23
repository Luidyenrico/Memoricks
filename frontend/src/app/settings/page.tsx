"use client";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_LANGUAGES } from "@/lib/languages";
import { useResource } from "@/lib/useResource";
import { ErrorMessage, Loading } from "@/components/StudyUI";

export default function SettingsPage() {
  const { data, error, reload } = useResource(api.profile);
  const [language, setLanguage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setSaveError(null);
    setMessage("");
    try {
      await api.updateProfile(language || data.native_language);
      setMessage("Preferência salva.");
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="page settings-page">
      <div className="hero">
        <div>
          <p className="eyebrow">SUAS PREFERÊNCIAS</p>
          <h1>Configurações</h1>
          <p className="lead">
            Um padrão para os próximos conteúdos. Cada subgrupo pode ter suas
            próprias instruções.
          </p>
        </div>
      </div>
      {!data ? (
        <Loading error={error} retry={reload} />
      ) : (
        <form className="settings-basics panel" onSubmit={save}>
          <fieldset disabled={busy} className="form-stack">
            <label>
              Idioma padrão das explicações
              <select
                value={language || data.native_language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                  setMessage("");
                }}
              >
                {DEFAULT_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Contextos e campos com um idioma específico têm prioridade. Seus
              cards existentes não serão alterados.
            </p>
            <ErrorMessage message={saveError} />
            {message && (
              <p role="status" className="notice success">
                {message}
              </p>
            )}
            <button className="button primary">
              {busy ? "Salvando…" : "Salvar preferência"}
            </button>
          </fieldset>
        </form>
      )}
    </main>
  );
}
