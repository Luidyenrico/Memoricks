import { test, expect, APIRequestContext, Page } from "@playwright/test";
import type { Card, CardTemplate, Group, Subgroup } from "../src/lib/api";

const BASE = "http://127.0.0.1:8100";
async function setup(request: APIRequestContext) {
  const group: Group = await (
    await request.post(BASE + "/groups", {
      data: {
        title: "Tecnologia " + crypto.randomUUID().slice(0, 8),
        description: "Aprenda conceitos com exemplos.",
        context: "Ensine tecnologia para iniciantes.",
        color: "#6ee7b7",
      },
    })
  ).json();
  const presets = await (await request.get(BASE + "/templates")).json();
  const template: CardTemplate = presets.find(
    (item: { id: string }) => item.id === "python",
  ).template;
  const subgroup: Subgroup = await (
    await request.post(BASE + `/groups/${group.id}/subgroups`, {
      data: {
        title: "Python",
        description: "Do conceito à prática.",
        context: "Use Python 3.",
        template,
      },
    })
  ).json();
  return { group, subgroup, template };
}
async function createCard(
  request: APIRequestContext,
  subgroup: Subgroup,
  title = "List comprehension",
) {
  const response = await request.post(
    BASE + `/subgroups/${subgroup.id}/cards`,
    {
      data: {
        text: title,
        values: Object.fromEntries(
          subgroup.template.fields.map((field) => [
            field.id,
            field.side === "front"
              ? title
              : field.format === "code"
                ? "numbers = [x * 2 for x in range(3)]"
                : "Uma forma concisa de construir listas.",
          ]),
        ),
        template_version: subgroup.template_version,
        source: "manual",
      },
    },
  );
  expect(response.status()).toBe(201);
  return (await response.json()) as Card;
}
async function openDetails(
  page: Page,
  subgroup: Subgroup,
  title = "List comprehension",
) {
  await page.goto(`/subgroups/${subgroup.id}?view=active`);
  await page.getByRole("button").filter({ hasText: title }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("home, nested themes and learned drill-down use the real scoped data", async ({
  page,
  request,
}) => {
  const { group, subgroup } = await setup(request);
  let card = await createCard(request, subgroup);
  card = await (
    await request.post(BASE + `/cards/${card.id}/review`, {
      data: { action: "easy", version: card.version },
    })
  ).json();
  await request.post(BASE + `/cards/${card.id}/review`, {
    data: { action: "master", version: card.version },
  });
  await page.goto("/themes");
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: group.title, exact: true }),
    })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Caminho de navegação" }),
  ).toContainText(group.title);
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: "Python", exact: true }) })
    .click();
  await page.getByRole("link", { name: /^Aprendidos/ }).click();
  await expect(page).toHaveURL(new RegExp("/subgroups/" + subgroup.id + "\\?view=learned"));
  await expect(
    page.getByRole("button").filter({ hasText: "List comprehension" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Caminho de navegação" }),
  ).toContainText("Python");
  await expect(page.getByText(/quiz/i)).toHaveCount(0);
});

test("manual creation preserves code and never calls generation", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  let generations = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/generate")) generations++;
  });
  await page.goto(`/subgroups/${subgroup.id}`);
  await page.getByRole("button", { name: "+ Criar card", exact: true }).click();
  await page.getByLabel("Conceito *").fill("Uma coleção ordenada.");
  await page
    .getByLabel("Exemplo de código *")
    .fill("values = [1, 2]\nfor value in values:\n    print(value)");
  await page
    .getByLabel("Como funciona *")
    .fill("Cria a lista.\nPercorre os itens.");
  await page.getByRole("button", { name: "Salvar card", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(generations).toBe(0);
  const data = await (
    await request.get(BASE + `/subgroups/${subgroup.id}/cards`)
  ).json();
  expect(data.total).toBe(1);
  expect(data.items[0].values.code).toContain("\n    print(value)");
  await openDetails(page, subgroup, "Uma coleção ordenada.");
  await expect(page.getByRole("dialog").locator("pre")).toContainText(
    "print(value)",
  );
});

test("AI saves with Enter and keeps the editor ready for the next card", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  let generations = 0;
  await page.route(BASE + `/subgroups/${subgroup.id}/generate`, (route) => {
    generations++;
    return (
    route.fulfill({
      json: {
        text: route.request().postDataJSON().text,
        values: Object.fromEntries(
          subgroup.template.fields.map((field) => [
            field.id,
            field.id === "prompt"
              ? "O que é um decorator?"
              : "Resposta gerada.",
          ]),
        ),
        template: subgroup.template,
        template_version: 1,
        source: "ai",
      },
    })
  ); });
  await page.goto(`/subgroups/${subgroup.id}`);
  await page.getByRole("button", { name: "+ Criar card", exact: true }).click();
  await page.getByRole("button", { name: "Criar com IA", exact: true }).click();
  await page
    .getByLabel("Digite o termo, palavra, pergunta ou assunto para a criação do card:")
    .fill("Decorators");
  const input = page.getByLabel("Digite o termo, palavra, pergunta ou assunto para a criação do card:");
  await input.press("Shift+Enter");
  expect(generations).toBe(0);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Gerar prévia", exact: true })).toHaveCount(0);
  await input.fill("Generators");
  let lost = false;
  await page.route("**/cards/batch", async route => {
    if (!lost) { lost = true; await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await input.press("Enter");
  await expect(page.getByRole("button", { name: "Confirmar criação", exact: true })).toBeEnabled();
  await expect(input).toHaveValue("Generators");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  expect(generations).toBe(2);
  const data = await (
    await request.get(BASE + `/subgroups/${subgroup.id}/cards`)
  ).json();
  expect(data.total).toBe(2);
  expect(data.items[0].values.answer).toBe("Resposta gerada.");
  await expect(page.getByRole("article")).toHaveCount(2);
  const mini = page.getByRole("article", { name: "Card criado: Generators", exact: true });
  await expect(mini.getByText("Resposta gerada.").first()).toBeVisible();
  await input.fill("Próximo assunto ainda não enviado");
  await page.locator(".created-cards").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/quick-cards-desktop.png" });
  await page.evaluate(() => document.documentElement.classList.add("light"));
  await page.screenshot({ path: "test-results/quick-cards-light.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mini.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/quick-cards-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await mini.getByRole("button", { name: "Editar card", exact: true }).click();
  await mini.getByLabel("Conceito *").fill("Conceito corrigido na miniatura.");
  await mini.getByRole("button", { name: "Salvar edição" }).click();
  await expect(mini.getByText("Conceito corrigido na miniatura.")).toBeVisible();
  await expect(input).toHaveValue("Próximo assunto ainda não enviado");
  await mini.getByRole("button", { name: "Excluir card", exact: true }).click();
  await mini.getByRole("button", { name: "Manter card" }).click();
  await expect(mini).toBeVisible();
  await mini.getByRole("button", { name: "Excluir card", exact: true }).click();
  await mini.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(input).toHaveValue("Próximo assunto ainda não enviado");
  expect((await (await request.get(BASE + `/subgroups/${subgroup.id}/cards`)).json()).total).toBe(1);
});

test("generation failure keeps the input and allows manual completion", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  await page.route(BASE + `/subgroups/${subgroup.id}/generate`, (route) =>
    route.fulfill({
      status: 502,
      json: { detail: "IA indisponível. Nenhuma alteração foi salva." },
    }),
  );
  await page.goto(`/subgroups/${subgroup.id}`);
  await page.getByRole("button", { name: "+ Criar card", exact: true }).click();
  await page.getByRole("button", { name: "Criar com IA", exact: true }).click();
  await page
    .getByLabel("Digite o termo, palavra, pergunta ou assunto para a criação do card:")
    .fill("Generators");
  await page.getByRole("button", { name: "Criar card com IA", exact: true }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "IA indisponível",
  );
  await expect(
    page.getByLabel("Digite o termo, palavra, pergunta ou assunto para a criação do card:"),
  ).toHaveValue("Generators");
  await page
    .getByRole("button", { name: "Preencher manualmente", exact: true })
    .click();
  await expect(page.getByLabel("Conceito *")).toBeVisible();
});

test("mastery only appears after Easy and a failed review never advances", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  await createCard(request, subgroup);
  await page.goto(`/subgroups/${subgroup.id}?view=review`);
  await page
    .getByRole("button", { name: "Virar card para ver a resposta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Dominei completamente" }),
  ).toHaveCount(0);
  let attempts = 0;
  await page.route(BASE + "/cards/*/review", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({
        status: 503,
        json: { detail: "Falha ao salvar a revisão." },
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Fácil (1d)" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Falha ao salvar",
  );
  await expect(page.getByText("Card 1 de 1")).toBeVisible();
  await page.getByRole("button", { name: "Fácil (1d)" }).click();
  await expect(page.getByText("Você revisou 1 cards")).toBeVisible();
  await page.goto(`/subgroups/${subgroup.id}?view=review&all=1`);
  await page
    .getByRole("button", { name: "Virar card para ver a resposta", exact: true })
    .click();
  await page.getByRole("button", { name: "Dominei completamente" }).click();
  await expect(page.getByText("Você revisou 1 cards")).toBeVisible();
  expect(
    (await (await request.get(BASE + `/subgroups/${subgroup.id}`)).json()).stats
      .learned,
  ).toBe(1);
});

test("template editing preserves old snapshots and explicit upgrade previews removed fields", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  const card = await createCard(request, subgroup);
  await page.goto(`/subgroups/${subgroup.id}?view=settings`);
  await page
    .locator(".field-editor")
    .filter({ hasText: "Conceito" })
    .locator("summary")
    .click();
  const concept = page.locator(".field-editor").nth(1);
  await concept.getByLabel("Nome do campo", { exact: true }).fill("Definição");
  await concept
    .getByRole("combobox", { name: "Fonte", exact: true })
    .selectOption("serif");
  await concept
    .getByLabel("Cor do texto de Definição", { exact: true })
    .fill("#fbbf24");
  await page
    .locator(".field-editor")
    .filter({ hasText: "Atenção" })
    .locator("summary")
    .click();
  await page
    .locator(".field-editor")
    .filter({ hasText: "Atenção" })
    .getByRole("button", { name: "Remover campo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar configurações", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Configurações salvas");
  const unchanged = await (
    await request.get(BASE + `/cards/${card.id}`)
  ).json();
  const expectedTemplate = structuredClone(card.template);
  expectedTemplate.fields[1].font = "serif";
  expectedTemplate.fields[1].color = "#fbbf24";
  expect(unchanged.template).toEqual(expectedTemplate);
  expect(unchanged.values).toEqual(card.values);
  await openDetails(page, subgroup);
  await page
    .getByRole("button", { name: "Atualizar para o modelo atual", exact: true })
    .click();
  await expect(page.getByText("Campos que sairão deste card:")).toContainText(
    "Atenção",
  );
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const updated = await (await request.get(BASE + `/cards/${card.id}`)).json();
  expect(updated.template_version).toBe(2);
  expect(
    updated.template.fields.find(
      (field: { id: string }) => field.id === "answer",
    ).font,
  ).toBe("serif");
  expect(updated.created_at).toBe(card.created_at);
});

test("custom theme and subgroup can be created from the interface", async ({
  page,
}) => {
  await page.goto("/themes");
  await page.getByRole("button", { name: "+ Novo tema", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Astronomia " + crypto.randomUUID().slice(0, 6));
  await page
    .getByLabel("Contexto geral para a IA")
    .fill("Explique o universo para iniciantes.");
  await page.getByRole("button", { name: "Salvar tema", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const link = page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: /Astronomia/ }) });
  await link.click();
  await page
    .getByRole("button", { name: "+ Novo subgrupo", exact: true })
    .click();
  await page.getByLabel("Título", { exact: true }).fill("Sistema Solar");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar subgrupo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sistema Solar", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/view=settings/);
});

test("modal keyboard focus restores after closing and failed save retains draft", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  const card = await createCard(request, subgroup);
  await openDetails(page, subgroup);
  await page.getByRole("button", { name: "Editar card", exact: true }).click();
  await page.getByLabel("Conceito *").fill("Minha edição importante.");
  await page.route(BASE + `/cards/${card.id}`, (route) =>
    route.fulfill({
      status: 409,
      json: { detail: "O card foi alterado em outra janela." },
    }),
  );
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "outra janela",
  );
  await expect(page.getByLabel("Conceito *")).toHaveValue(
    "Minha edição importante.",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile layouts, code overflow, and light theme remain usable", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  await createCard(request, subgroup);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/subgroups/${subgroup.id}`);
  await expect(
    page.getByRole("heading", { name: "Python", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Ativar tema claro", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await openDetails(page, subgroup);
  await expect(page.getByRole("dialog").locator("pre")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-card.png",
    fullPage: true,
  });
});

test("desktop overview has no console errors and handles connection failure", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/subgroups/${subgroup.id}`);
  await expect(
    page.getByRole("heading", { name: "Python", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-overview.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.route(BASE + "/groups", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Não foi possível conectar",
  );
  await expect(
    page.getByRole("button", { name: "Tentar novamente", exact: true }),
  ).toBeVisible();
});

test("changing the language waits for its matching card template", async ({
  page,
  request,
}) => {
  const { group } = await setup(request);
  await page.goto(`/groups/${group.id}`);
  await page
    .getByRole("button", { name: "+ Novo subgrupo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título", { exact: true }).fill("Espanhol");
  await dialog
    .getByRole("combobox", { name: "Modelo inicial dos cards", exact: true })
    .selectOption("languages");
  await page.route(BASE + "/templates?language=es", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await dialog
    .getByRole("combobox", { name: "Idioma de estudo", exact: true })
    .selectOption("es");
  await expect(dialog.getByRole("status")).toContainText("Carregando");
  await expect(
    dialog.getByRole("combobox", { name: "Idioma de estudo", exact: true }),
  ).toHaveValue("es");
  await dialog
    .getByRole("button", { name: "Criar subgrupo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Espanhol", exact: true }),
  ).toBeVisible();
  const detail = await (await request.get(BASE + `/groups/${group.id}`)).json();
  const spanish = detail.subgroups.find(
    (child: Subgroup) => child.title === "Espanhol",
  );
  expect(
    spanish.template.fields.find(
      (field: { id: string }) => field.id === "prompt",
    ).instructions,
  ).toContain("Espanhol");
});

test("home shortcuts open focused review and exiting keeps saved responses", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  const cards = [];
  for (let i = 0; i < 4; i++)
    cards.push(await createCard(request, subgroup, "Revisão rápida " + i));
  await page.goto("/");
  const shortcut = page
    .locator(".shortcut-card")
    .filter({
      has: page.getByRole("link", { name: "Revisar Python", exact: true }),
    })
    .filter({ hasText: "4 cards" });
  await shortcut
    .getByRole("link", { name: "Revisar Python", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp("/review/" + subgroup.id + "\\?from=home"),
  );
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Navegação do subgrupo" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Virar card para ver a resposta", exact: true })
    .click();
  await page.route(BASE + "/cards/*/review", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.getByRole("button", { name: "Fácil (1d)", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sair da revisão", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Card 2 de 4", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Sair da revisão", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  const result = await (
    await request.get(BASE + `/subgroups/${subgroup.id}/cards?status=pending`)
  ).json();
  expect(result.total).toBe(3);
  const original = await (
    await request.get(BASE + `/cards/${cards[0].id}`)
  ).json();
  expect(original.difficulty_level).toBe("Easy");
});

test("long review content scrolls inside the card without moving the ratings", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  const values = Object.fromEntries(
    subgroup.template.fields.map((field) => [
      field.id,
      field.side === "front"
        ? "Uma pergunta curta"
        : field.id === "code"
          ? Array.from({ length: 42 }, (_, i) => `print("linha ${i}")`).join(
              "\n",
            )
          : field.id === "answer"
            ? "Explicação detalhada. ".repeat(65) + "Fim da explicação."
            : "Conteúdo complementar.",
    ]),
  );
  const response = await request.post(
    BASE + `/subgroups/${subgroup.id}/cards`,
    {
      data: {
        text: "Card longo",
        values,
        template_version: 1,
        source: "manual",
      },
    },
  );
  expect(response.status()).toBe(201);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/review/${subgroup.id}`);
  await page
    .getByRole("button", { name: "Virar card para ver a resposta", exact: true })
    .click();
  const rating = page.getByRole("button", { name: "Fácil (1d)", exact: true });
  const initial = await rating.boundingBox();
  const reader = page.locator(".review-pages");
  const collected = (await page.locator(
    ".review-page-content p, .review-page-content code, .review-page-content li",
  ).allTextContents()).join("");
  await reader.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await reader.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator(".review-page-content code")).toBeInViewport();
  expect((await rating.boundingBox())!.y).toBeCloseTo(initial!.y, 0);
  const expected = subgroup.template.fields
    .filter((field) => field.side === "back")
    .map((field) => values[field.id])
    .join("");
  expect(collected.replace(/\s/g, "")).toBe(expected.replace(/\s/g, ""));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/review-mobile.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(rating).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Sair da revisão", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "test-results/review-desktop.png" });
});

test("review flips by card and keyboard and advances only after rating", async ({
  page,
  request,
}) => {
  const { subgroup } = await setup(request);
  await createCard(request, subgroup);
  await page.goto(`/review/${subgroup.id}`);
  const front = page.getByRole("button", {
    name: "Virar card para ver a resposta",
    exact: true,
  });
  await expect(front).toBeVisible();
  const text = page.locator(".review-page-content p").first();
  await expect(text).toBeVisible();
  expect(
    await text.evaluate((element) => getComputedStyle(element).textAlign),
  ).toBe("center");
  expect(
    await text.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThan(26);
  await front.click();
  const back = page.getByRole("button", {
    name: "Virar card para ver a pergunta",
    exact: true,
  });
  await expect(back).toBeVisible();
  await back.press("Enter");
  await expect(front).toBeFocused();
  await front.press("Space");
  await expect(back).toBeFocused();
  await back.click();
  await expect(front).toBeVisible();
  const easy = page.getByRole("button", { name: "Fácil (1d)", exact: true });
  await expect(easy).toBeDisabled();
  await front.click();
  await expect(back).toBeVisible();
  await expect(page.getByRole("button", { name: /Anterior|Próxima|Pular|Voltar à pergunta|Mostrar resposta|Revelar Explicação/ })).toHaveCount(0);
  await expect(page.getByText("Cada resposta é salva na hora")).toHaveCount(0);
  await easy.click();
  await expect(page.getByText("Mais um passo no seu aprendizado.")).toBeVisible();
});
