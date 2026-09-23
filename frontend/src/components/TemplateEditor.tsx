"use client";
import { CardField, CardTemplate } from "@/lib/api";
import { CardContent } from "./CardContent";

const sample = (field: CardField) =>
  field.format === "code"
    ? 'for item in ["aprender", "praticar"]:\n    print(item)'
    : field.format === "list"
      ? "Primeiro exemplo\nSegundo exemplo"
      : field.side === "front"
        ? "O que você quer aprender?"
        : "O conteúdo deste campo aparecerá aqui, seguindo suas instruções.";

export default function TemplateEditor({
  value,
  onChange,
}: {
  value: CardTemplate;
  onChange: (template: CardTemplate) => void;
}) {
  function update(id: string, changes: Partial<CardField>) {
    onChange({
      fields: value.fields.map((field) =>
        field.id === id ? { ...field, ...changes } : field,
      ),
    });
  }
  function move(index: number, step: number) {
    const fields = [...value.fields];
    [fields[index], fields[index + step]] = [
      fields[index + step],
      fields[index],
    ];
    onChange({ fields });
  }
  function add() {
    onChange({
      fields: [
        ...value.fields,
        {
          id: "field_" + crypto.randomUUID().replaceAll("-", ""),
          label: "Novo campo",
          instructions: "",
          side: "back",
          format: "text",
          required: false,
          length: "medium",
          max_chars: 3000,
          font: "sans",
          size: "medium",
          color: null,
          background: null,
        },
      ],
    });
  }
  return (
    <div className="template-grid">
      <div className="form-stack">
        {value.fields.map((field, index) => (
          <details className="field-editor" key={field.id}>
            <summary>
              <span className="field-number">{index + 1}</span>
              <strong>{field.label || "Sem nome"}</strong>
              <span className="tag">
                {field.side === "front" ? "Frente" : "Verso"}
              </span>
            </summary>
            <div className="form-stack">
              <label>
                Nome do campo
                <input
                  value={field.label}
                  maxLength={80}
                  required
                  onChange={(event) =>
                    update(field.id, { label: event.target.value })
                  }
                />
              </label>
              <label>
                O que a IA deve colocar aqui?
                <textarea
                  value={field.instructions}
                  rows={3}
                  maxLength={4000}
                  placeholder="Ex.: explique em duas frases e dê um exemplo prático."
                  onChange={(event) =>
                    update(field.id, { instructions: event.target.value })
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Lado
                  <select
                    value={field.side}
                    onChange={(event) =>
                      update(field.id, {
                        side: event.target.value as CardField["side"],
                      })
                    }
                  >
                    <option value="front">Frente</option>
                    <option value="back">Verso</option>
                  </select>
                </label>
                <label>
                  Formato
                  <select
                    value={field.format}
                    onChange={(event) =>
                      update(field.id, {
                        format: event.target.value as CardField["format"],
                        ...(event.target.value === "code"
                          ? { font: "mono" }
                          : {}),
                      })
                    }
                  >
                    <option value="text">Texto</option>
                    <option value="list">Lista</option>
                    <option value="code">Código</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Detalhamento
                  <select
                    value={field.length}
                    onChange={(event) =>
                      update(field.id, {
                        length: event.target.value as CardField["length"],
                      })
                    }
                  >
                    <option value="short">Curto · até 2 frases</option>
                    <option value="medium">Médio · 1 parágrafo</option>
                    <option value="detailed">
                      Detalhado · até 4 parágrafos
                    </option>
                  </select>
                </label>
                <label>
                  Limite de caracteres
                  <input
                    type="number"
                    min={20}
                    max={20000}
                    required
                    value={field.max_chars}
                    onChange={(event) =>
                      update(field.id, {
                        max_chars: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Fonte
                  <select
                    value={field.font}
                    onChange={(event) =>
                      update(field.id, {
                        font: event.target.value as CardField["font"],
                      })
                    }
                  >
                    <option value="sans">Padrão</option>
                    <option value="serif">Serifada</option>
                    <option value="mono">Código · monoespaçada</option>
                  </select>
                </label>
                <label>
                  Tamanho
                  <select
                    value={field.size}
                    onChange={(event) =>
                      update(field.id, {
                        size: event.target.value as CardField["size"],
                      })
                    }
                  >
                    <option value="small">Pequeno</option>
                    <option value="medium">Médio</option>
                    <option value="large">Grande</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Cor do texto
                  <div className="color-control">
                    <input
                      aria-label={"Cor do texto de " + field.label}
                      type="color"
                      value={field.color || "#85a5ff"}
                      onChange={(event) =>
                        update(field.id, { color: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => update(field.id, { color: null })}
                    >
                      Automática
                    </button>
                  </div>
                </label>
                <label>
                  Cor de fundo
                  <div className="color-control">
                    <input
                      aria-label={"Cor de fundo de " + field.label}
                      type="color"
                      value={field.background || "#18243b"}
                      onChange={(event) =>
                        update(field.id, { background: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => update(field.id, { background: null })}
                    >
                      Automática
                    </button>
                  </div>
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    update(field.id, { required: event.target.checked })
                  }
                />
                Campo obrigatório
              </label>
              <div className="spread">
                <div className="actions">
                  <button
                    className="button small secondary"
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑ Subir
                  </button>
                  <button
                    className="button small secondary"
                    type="button"
                    disabled={index === value.fields.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓ Descer
                  </button>
                </div>
                <button
                  className="text-button danger"
                  type="button"
                  disabled={value.fields.length <= 2}
                  onClick={() =>
                    onChange({
                      fields: value.fields.filter(
                        (item) => item.id !== field.id,
                      ),
                    })
                  }
                >
                  Remover campo
                </button>
              </div>
            </div>
          </details>
        ))}
        <button
          type="button"
          className="button secondary"
          disabled={value.fields.length >= 20}
          onClick={add}
        >
          + Adicionar campo
        </button>
        <p className="muted">
          Mantenha um campo obrigatório na frente e outro no verso. A frente
          apresenta a pergunta; o verso revela a resposta.
        </p>
      </div>
      <aside className="template-preview">
        <p className="eyebrow">PRÉVIA DO MODELO</p>
        <p className="muted">
          Conteúdo ilustrativo. Confira a leitura das cores no tema claro e
          escuro.
        </p>
        {(["front", "back"] as const).map((side) => (
          <div key={side} className="preview-face">
            <span className="tag">{side === "front" ? "Frente" : "Verso"}</span>
            <CardContent
              template={value}
              values={Object.fromEntries(
                value.fields.map((field) => [field.id, sample(field)]),
              )}
              side={side}
            />
          </div>
        ))}
      </aside>
    </div>
  );
}
