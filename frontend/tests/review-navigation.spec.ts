import { test, expect, type APIRequestContext } from "@playwright/test";
import type { Card, CardTemplate, Group, Subgroup } from "../src/lib/api";

const BASE = "http://127.0.0.1:8100";

async function setupReview(request: APIRequestContext) {
  const response = await request.post(BASE + "/groups", {
    data: { title: "Revisão " + crypto.randomUUID().slice(0, 8), description: "", context: "", color: "#85a5ff" },
  });
  expect(response.status()).toBe(201);
  const group = await response.json() as Group;
  const presets = await (await request.get(BASE + "/templates")).json();
  const template: CardTemplate = presets.find((item: { id: string }) => item.id === "python").template;
  const subgroupResponse = await request.post(BASE + `/groups/${group.id}/subgroups`, {
    data: { title: "Conceitos " + crypto.randomUUID().slice(0, 8), description: "", context: "", template },
  });
  expect(subgroupResponse.status()).toBe(201);
  const subgroup = await subgroupResponse.json() as Subgroup;
  const cardResponse = await request.post(BASE + `/subgroups/${subgroup.id}/cards`, {
    data: {
      text: "Conceito para revisar",
      values: Object.fromEntries(template.fields.map((field) => [field.id, field.side === "front" ? "Qual é o conceito?" : "Uma explicação clara do conceito."])),
      template_version: subgroup.template_version,
      source: "manual",
    },
  });
  expect(cardResponse.status()).toBe(201);
  const card = await cardResponse.json() as Card;
  return { group, subgroup, card };
}

test("unified themes shows progress and starts review while preserving content management", async ({ page, request }) => {
  const { group, subgroup } = await setupReview(request);
  await page.goto(`/review?group=${group.id}`);
  await expect(page).toHaveURL(`/themes?group=${group.id}`);
  const disclosure = page.getByRole("button", { name: `Ocultar subgrupos de ${group.title}`, exact: true });
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  const region = page.locator(`#theme-subgroups-${group.id}`);
  await expect(region.getByRole("heading", { name: subgroup.title, exact: true })).toBeVisible();
  await expect(region.getByText("1 para revisar", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Novo tema", exact: true })).toBeVisible();
  await expect(region.getByRole("link", { name: `Ver cards de ${subgroup.title}`, exact: true })).toBeVisible();
  await expect(region.getByText("0 aprendidos", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/themes-unified-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.screenshot({ path: "test-results/themes-unified-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await region.getByRole("link", { name: `Revisar ${subgroup.title}`, exact: true }).click();
  await expect(page).toHaveURL(`/review/${subgroup.id}?from=library`);
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir menu", exact: true })).toHaveCount(0);
  expect((await page.locator(".review-screen").boundingBox())!.x).toBe(0);
  await page.screenshot({ path: "test-results/review-without-sidebar.png" });
  await page.getByRole("button", { name: "Virar card para ver a resposta", exact: true }).click();
  await page.getByRole("button", { name: "Médio (1h)", exact: true }).click();
  await expect(page.getByText("Mais um passo no seu aprendizado.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Voltar a Meus temas", exact: true }).click();
  await expect(page).toHaveURL(`/themes?group=${group.id}`);
  await expect(region.getByRole("link", { name: `Praticar ${subgroup.title}`, exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  const updated = await (await request.get(BASE + `/subgroups/${subgroup.id}`)).json();
  expect(updated.stats.pending).toBe(0);
});

test("review loads unopened groups on demand and offers practice only for available cards", async ({ page, request }) => {
  const first = await setupReview(request);
  const second = await setupReview(request);
  await request.post(BASE + `/cards/${second.card.id}/review`, { data: { action: "medium", version: second.card.version } });
  const loaded: string[] = [];
  page.on("request", (request) => loaded.push(request.url()));
  await page.goto(`/review?group=${first.group.id}`);
  await expect(page.getByRole("heading", { name: first.subgroup.title, exact: true })).toBeVisible();
  expect(loaded).not.toContain(BASE + `/groups/${second.group.id}`);
  const disclosure = page.getByRole("button", { name: `Ver subgrupos de ${second.group.title}`, exact: true });
  await disclosure.click();
  const region = page.locator(`#theme-subgroups-${second.group.id}`);
  await expect(region.getByText("Revisão em dia", { exact: true })).toBeVisible();
  await region.getByRole("link", { name: `Praticar ${second.subgroup.title}`, exact: true }).click();
  await expect(page).toHaveURL(`/review/${second.subgroup.id}?from=library&all=1`);
  await expect(page.getByRole("button", { name: "Virar card para ver a resposta", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sair da revisão", exact: true }).click();
  await expect(page).toHaveURL(`/themes?group=${second.group.id}`);
});

test("a direct review exits to themes and keeps mobile controls above the bottom edge", async ({ page, request }) => {
  const { group, subgroup } = await setupReview(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/review/${subgroup.id}`);
  await expect(page.getByRole("button", { name: "Abrir menu", exact: true })).toHaveCount(0);
  const easy = page.getByRole("button", { name: "Fácil (1d)", exact: true });
  await expect(easy).toBeInViewport();
  const ratingBox = await easy.boundingBox();
  expect(ratingBox).not.toBeNull();
  expect(844 - ratingBox!.y - ratingBox!.height).toBeGreaterThanOrEqual(24);
  await page.getByRole("button", { name: "Sair da revisão", exact: true }).click();
  await expect(page).toHaveURL(`/themes?group=${group.id}`);
  await expect(page.getByRole("button", { name: "Abrir menu", exact: true })).toBeVisible();
});

test("group detail offers review and returns to its own context", async ({ page, request }) => {
  const { group, subgroup } = await setupReview(request);
  await page.goto(`/groups/${group.id}`);
  await page.getByRole("link", { name: `Revisar ${subgroup.title}`, exact: true }).click();
  await expect(page).toHaveURL(`/review/${subgroup.id}?from=group`);
  await page.getByRole("button", { name: "Sair da revisão", exact: true }).click();
  await expect(page).toHaveURL(`/groups/${group.id}`);
});

test("card browser separates viewing from review and provides a visible route back to themes", async ({ page, request }) => {
  const { group, subgroup, card } = await setupReview(request);
  await page.goto(`/themes?group=${group.id}`);
  await page.getByRole("link", { name: `Ver cards de ${subgroup.title}`, exact: true }).click();
  await expect(page.getByRole("link", { name: "← Voltar a Meus temas", exact: true })).toHaveAttribute("href", `/themes?group=${group.id}`);
  const row = page.getByRole("button", { name: `Ver e editar card: ${card.text}`, exact: true });
  await expect(row).toContainText("Revisão pendente");
  await expect(row).toContainText("Ver / editar");
  await expect(row).not.toContainText("Revisar agora");
  await row.click();
  await expect(page.getByRole("heading", { name: "Detalhes do card", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar card", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.screenshot({ path: "test-results/subgroup-navigation-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/subgroup-navigation-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Revisar agora", exact: true }).click();
  await expect(page).toHaveURL(`/review/${subgroup.id}?from=themes`);
  await page.getByRole("button", { name: "Virar card para ver a resposta", exact: true }).click();
  await page.getByRole("button", { name: "Médio (1h)", exact: true }).click();
  await page.getByRole("link", { name: "Voltar ao subgrupo", exact: true }).click();
  await expect(page.getByRole("link", { name: "Praticar cards", exact: true })).toHaveAttribute("href", `/review/${subgroup.id}?from=themes&all=1`);
  await page.getByRole("link", { name: "← Voltar a Meus temas", exact: true }).click();
  await expect(page).toHaveURL(`/themes?group=${group.id}`);
  await expect(page.getByRole("button", { name: `Ocultar subgrupos de ${group.title}`, exact: true })).toHaveAttribute("aria-expanded", "true");
});

test("empty and learned-only subgroups stay accessible without offering an empty review", async ({ page, request }) => {
  const { group, subgroup, card } = await setupReview(request);
  const easy = await (await request.post(BASE + `/cards/${card.id}/review`, { data: { action: "easy", version: card.version } })).json();
  await request.post(BASE + `/cards/${card.id}/review`, { data: { action: "master", version: easy.version } });
  await request.post(BASE + `/groups/${group.id}/subgroups`, { data: { title: "Novo assunto", description: "", context: "", template: subgroup.template } });
  await page.goto(`/themes?group=${group.id}`);
  const region = page.locator(`#theme-subgroups-${group.id}`);
  await expect(region.getByText("Tudo aprendido", { exact: true })).toBeVisible();
  await expect(region.getByText("Sem cards", { exact: true })).toBeVisible();
  await expect(region.getByRole("link", { name: /^(Revisar|Praticar) / })).toHaveCount(0);
  await region.getByRole("link", { name: `Ver cards de ${subgroup.title}`, exact: true }).click();
  await expect(page).toHaveURL(`/subgroups/${subgroup.id}`);
});
