import { expect, test } from "@playwright/test";
import type { Card, CardTemplate, Group, Subgroup } from "../src/lib/api";

const BASE = "http://127.0.0.1:8100";

test("Meus temas preserves create, personalize, edit and delete across the content hierarchy", async ({ page, request }) => {
  test.setTimeout(90_000);
  const title = "Ciências " + crypto.randomUUID().slice(0, 8);
  await page.goto("/themes");
  await page.getByRole("button", { name: "+ Novo tema", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Contexto geral para a IA").fill("Use exemplos de astronomia.");
  await page.getByRole("button", { name: "Salvar tema", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).click();
  await expect(page).toHaveURL(/\/groups\/\d+$/);
  const groupId = Number(new URL(page.url()).pathname.split("/").at(-1));
  await expect(page.getByRole("navigation", { name: "Caminho de navegação" })).toContainText("Meus temas");
  await page.getByRole("button", { name: "Editar tema", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Nossa biblioteca de ciências.");
  await page.getByLabel("Cor do tema").fill("#c4b5fd");
  await page.getByRole("button", { name: "Salvar tema", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Nossa biblioteca de ciências.", { exact: true })).toBeVisible();
  expect((await (await request.get(BASE + `/groups/${groupId}`)).json()).color).toBe("#c4b5fd");

  await page.getByRole("button", { name: "+ Novo subgrupo", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Sistema Solar");
  await page.getByRole("dialog").getByRole("button", { name: "Criar subgrupo", exact: true }).click();
  await expect(page).toHaveURL(/\/subgroups\/\d+\?view=settings$/);
  const subgroupId = Number(new URL(page.url()).pathname.split("/").at(-1));
  await page.getByLabel("Título do subgrupo", { exact: true }).fill("Planetas");
  const answerField = page.locator(".field-editor").filter({ has: page.locator("summary", { hasText: "Resposta" }) });
  await answerField.locator("summary").click();
  await answerField.getByRole("combobox", { name: "Fonte", exact: true }).selectOption("serif");
  await answerField.getByLabel("Cor do texto de Resposta", { exact: true }).fill("#c4b5fd");
  await page.getByRole("button", { name: "Salvar configurações", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Configurações salvas");
  await expect(page.getByRole("heading", { name: "Planetas", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Navegação do subgrupo" }).getByRole("link", { name: /Em estudo/ }).click();
  await expect(page).toHaveURL(`/subgroups/${subgroupId}?view=active`);
  await expect(page.getByRole("heading", { name: "Seus cards em estudo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Criar card", exact: true }).click();
  await page.getByLabel("Pergunta ou assunto *").fill("Qual é o maior planeta?");
  await page.getByLabel("Resposta *").fill("Júpiter.");
  await page.getByRole("button", { name: "Salvar card", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const cardRow = page.locator(".study-row").filter({ hasText: "Qual é o maior planeta?" });
  await expect(cardRow).toBeVisible();
  let cards = await (await request.get(BASE + `/subgroups/${subgroupId}/cards`)).json();
  expect(cards.total).toBe(1);
  expect(cards.items[0].template.fields.find((field: { id: string }) => field.id === "answer").font).toBe("serif");
  await cardRow.click();
  await page.getByRole("button", { name: "Editar card", exact: true }).click();
  await page.getByLabel("Resposta *").fill("Júpiter é o maior planeta do Sistema Solar.");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  cards = await (await request.get(BASE + `/subgroups/${subgroupId}/cards`)).json();
  expect(cards.items[0].values.answer).toBe("Júpiter é o maior planeta do Sistema Solar.");
  await cardRow.click();
  await page.getByRole("button", { name: "Excluir card", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir card", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(cardRow).toHaveCount(0);
  await page.getByRole("navigation", { name: "Navegação do subgrupo" }).getByRole("link", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Excluir subgrupo vazio", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir subgrupo", exact: true }).click();
  await expect(page).toHaveURL(`/groups/${groupId}`);
  await page.getByRole("button", { name: "Excluir tema vazio", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir tema", exact: true }).click();
  await expect(page).toHaveURL("/themes");
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  expect((await request.get(BASE + `/groups/${groupId}`)).status()).toBe(404);
});

test("theme expansion exposes scoped subgroups and learned cards on mobile", async ({ page, request }) => {
  const title = "Biblioteca " + crypto.randomUUID().slice(0, 8);
  const group: Group = await (await request.post(BASE + "/groups", {
    data: { title, description: "", context: "", color: "#85a5ff" },
  })).json();
  const templates: { id: string; template: CardTemplate }[] = await (await request.get(BASE + "/templates")).json();
  const template = templates.find((preset) => preset.id === "general")!.template;
  const subgroup: Subgroup = await (await request.post(BASE + `/groups/${group.id}/subgroups`, {
    data: { title: "Conhecimentos essenciais", description: "", context: "", template },
  })).json();
  let card: Card = await (await request.post(BASE + `/subgroups/${subgroup.id}/cards`, {
    data: {
      text: "Card aprendido",
      values: Object.fromEntries(template.fields.map((field) => [field.id, field.side === "front" ? "Card aprendido" : "Conteúdo preservado."])),
      template_version: subgroup.template_version,
      source: "manual",
    },
  })).json();
  card = await (await request.post(BASE + `/cards/${card.id}/review`, { data: { action: "easy", version: card.version } })).json();
  await request.post(BASE + `/cards/${card.id}/review`, { data: { action: "master", version: card.version } });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/themes");
  const theme = page.locator(".theme-library-item").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await theme.getByRole("button", { name: `Ver subgrupos de ${title}`, exact: true }).click();
  await expect(theme.getByText("1 aprendidos", { exact: true })).toBeVisible();
  await expect(theme.getByRole("button", { name: `Ocultar subgrupos de ${title}`, exact: true })).toHaveAttribute("aria-expanded", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await theme.getByRole("link", { name: "Conhecimentos essenciais", exact: true }).click();
  await expect(page).toHaveURL(`/subgroups/${subgroup.id}`);
  const breadcrumbs = page.getByRole("navigation", { name: "Caminho de navegação" });
  await expect(breadcrumbs).toContainText("Meus temas");
  await page.getByRole("navigation", { name: "Navegação do subgrupo" }).getByRole("link", { name: /Aprendidos/ }).click();
  await expect(page.locator(".study-row")).toContainText("Card aprendido");
  await page.locator(".study-row").click();
  await expect(page.getByRole("dialog")).toContainText("Conteúdo preservado.");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await breadcrumbs.getByRole("link", { name: "Meus temas", exact: true }).click();
  await expect(page).toHaveURL("/themes");
  await page.goto("/mastered");
  await expect(page).toHaveURL("/themes");
});
