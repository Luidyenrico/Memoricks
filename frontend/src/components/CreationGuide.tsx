"use client";

import { ReactNode, useId, useState } from "react";
import "./creation-guide.css";

export default function CreationGuide({ kind, heading, closeButton }: {
  kind: "theme" | "card";
  heading?: ReactNode;
  closeButton?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const theme = kind === "theme";

  return (
    <div className={`creation-guide${heading ? " creation-guide-header" : ""}`}>
      {heading}
      <button
        type="button"
        className="creation-guide-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="creation-guide-icon" aria-hidden="true">?</span>
        <span className="creation-guide-label">{theme ? "Guia para criar seu tema" : "Guia para criar com IA"}</span>
        {heading && <span className="creation-guide-short-label" aria-hidden="true">Guia</span>}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {closeButton}
      <section id={id} hidden={!open} className="creation-guide-content" aria-label={theme ? "Ajuda para criar um tema" : "Ajuda para criar cards com IA"}>
        <h3>{theme ? "Conte à IA como você quer aprender" : "Dê contexto para receber um card melhor"}</h3>
        <p>{theme
          ? "Escolha um nome livre para o tema. No contexto para a IA, descreva seu objetivo, seu nível e o que deseja nas explicações. Seja específico sobre o que importa; não precisa escrever muito."
          : "Você pode começar com uma palavra, pergunta ou assunto. Para direcionar o resultado, acrescente o sentido desejado, uma situação de uso ou o tipo de exemplo que precisa."}</p>
        <dl>
          <div><dt>Idiomas</dt><dd>{theme
            ? "Estou começando a estudar idiomas. Se houver vários sentidos, apresente até 3 traduções principais e o contexto de cada uma. Inclua 2 exemplos com tradução."
            : "Muzzle: explique os principais sentidos e apresente até 3 traduções, com exemplos traduzidos."}</dd></div>
          <div><dt>Programação</dt><dd>{theme
            ? "Sou iniciante. Explique em português, inclua um exemplo curto de código e destaque um erro comum."
            : "List comprehension em Python: explique para um iniciante e mostre um exemplo filtrando números pares."}</dd></div>
          <div><dt>{theme ? "Conceitos e fórmulas" : "Conteúdo de um livro"}</dt><dd>{theme
            ? "Use definições objetivas e exemplos práticos. Nas fórmulas, explique cada variável, quando usar e uma aplicação resolvida."
            : "Cole a pergunta e o trecho ou a resposta que está estudando. Só o nome do livro e do capítulo não garante que a IA siga aquele conteúdo."}</dd></div>
        </dl>
        <p className="creation-guide-note">{theme
          ? "O contexto do tema orienta todos os subgrupos. Deixe preferências específicas no contexto do subgrupo e configure os campos dos cards no modelo dele."
          : "A IA também usa o contexto do tema, as orientações do subgrupo e os campos do modelo. Salve preferências recorrentes nesses contextos para não precisar repeti-las em cada card."}</p>
      </section>
    </div>
  );
}
