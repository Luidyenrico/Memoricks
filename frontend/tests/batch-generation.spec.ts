import { expect, test, type APIRequestContext } from "@playwright/test";
import type { CardTemplate, SubgroupDetail } from "../src/lib/api";

const BASE = "http://127.0.0.1:8100";
async function setup(request: APIRequestContext) {
  const group = await (await request.post(BASE + "/groups", { data: {
    title: "Lote " + crypto.randomUUID(), description: "", context: "", color: "#85a5ff",
  } })).json();
  const presets: { id: string; template: CardTemplate }[] = await (await request.get(BASE + "/templates")).json();
  const template = presets.find(preset => preset.id === "general")!.template;
  const subgroup = await (await request.post(BASE + `/groups/${group.id}/subgroups`, { data: {
    title: "Capítulo 1", description: "", context: "", template,
  } })).json();
  return await (await request.get(BASE + `/subgroups/${subgroup.id}`)).json() as SubgroupDetail;
}
function preview(subgroup: SubgroupDetail, text: string) {
  return { text, template: subgroup.template, template_version: subgroup.template_version, source: "ai",
    values: Object.fromEntries(subgroup.template.fields.map(field => [field.id, field.side === "front" ? text : "Resposta e exemplo gerados."])),
  };
}

test("batch waits for quota, resumes only pending cards and retries uncertain save without duplicates", async ({ page, request }) => {
  const subgroup = await setup(request);
  await page.clock.install();
  await page.route("**/batch-plan", route => route.fulfill({ json: {
    entries: ["Pergunta A", "Pergunta B", "Pergunta C"], common_context: "Capítulo 1",
    subgroup_version: subgroup.version, group_version: subgroup.group.version,
  } }));
  const calls: string[] = [];
  let limited = false;
  await page.route("**/batch-generate", async route => {
    const { text } = route.request().postDataJSON();
    calls.push(text);
    if (text === "Pergunta B" && !limited) {
      limited = true;
      await route.fulfill({ status: 429, json: { detail: { message: "Limite", retry_after: 60 } } });
    } else await route.fulfill({ json: preview(subgroup, text) });
  });
  await page.goto(`/subgroups/${subgroup.id}`);
  await page.getByRole("button", { name: "Criar vários cards com IA", exact: true }).click();
  await page.getByLabel("Material de estudo").fill("Pergunta A\nPergunta B\nPergunta C");
  await page.getByRole("button", { name: "Organizar perguntas" }).click();
  await expect(page.getByText("0 de 3 cards gerados")).toBeVisible();
  await page.getByRole("button", { name: "Gerar cards", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Limite da IA atingido");
  expect(calls).toEqual(["Pergunta A", "Pergunta B"]);
  await page.clock.fastForward(59_000);
  expect(calls).toHaveLength(2);
  await page.clock.fastForward(2_000);
  await expect(page.getByText("3 de 3 cards gerados")).toBeVisible();
  expect(calls).toEqual(["Pergunta A", "Pergunta B", "Pergunta B", "Pergunta C"]);
  await page.locator("summary").filter({ hasText: "Card 3" }).click();
  await page.getByRole("button", { name: "Remover card 3" }).click();
  await page.locator("summary").filter({ hasText: "Card 1" }).click();
  await page.locator("details[open]").getByLabel("Resposta *").fill("Resposta revisada pelo usuário.");
  await page.getByRole("button", { name: "Fechar e manter rascunho" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Criar vários cards com IA", exact: true }).click();
  await expect(page.getByText("2 de 2 cards gerados")).toBeVisible();
  await page.screenshot({ path: "test-results/batch-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Salvar 2 cards" })).toBeVisible();
  await page.screenshot({ path: "test-results/batch-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  let loseResponse = true;
  await page.route("**/cards/batch", async route => {
    if (loseResponse) {
      loseResponse = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Salvar 2 cards" }).click();
  await expect(page.getByText("A confirmação do salvamento não chegou.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await (await request.get(BASE + `/subgroups/${subgroup.id}/cards`)).json();
  expect(saved.total).toBe(2);
  expect(saved.items.find((card: { text: string }) => card.text === "Pergunta A").values.answer).toBe("Resposta revisada pelo usuário.");
});

test("batch can pause quota wait, reload and resume without regenerating completed previews", async ({ page, request }) => {
  const subgroup = await setup(request);
  await page.clock.install();
  await page.route("**/batch-plan", route => route.fulfill({ json: {
    entries: ["Primeira", "Segunda"], common_context: "", subgroup_version: subgroup.version, group_version: subgroup.group.version,
  } }));
  let secondAttempts = 0;
  const calls: string[] = [];
  await page.route("**/batch-generate", route => {
    const { text } = route.request().postDataJSON();
    calls.push(text);
    if (text === "Segunda" && secondAttempts++ === 0)
      return route.fulfill({ status: 429, json: { detail: { message: "Limite", retry_after: 120 } } });
    return route.fulfill({ json: preview(subgroup, text) });
  });
  await page.goto(`/subgroups/${subgroup.id}`);
  await page.getByRole("button", { name: "Criar vários cards com IA", exact: true }).click();
  await page.getByLabel("Material de estudo").fill("Primeira\nSegunda");
  await page.getByRole("button", { name: "Organizar perguntas" }).click();
  await page.getByRole("button", { name: "Gerar cards", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Limite da IA atingido");
  await page.getByRole("button", { name: "Pausar geração" }).click();
  await page.clock.fastForward(500);
  await page.getByRole("button", { name: "Fechar e manter rascunho" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Criar vários cards com IA", exact: true }).click();
  await expect(page.getByText("1 de 2 cards gerados")).toBeVisible();
  await page.getByRole("button", { name: "Gerar cards restantes" }).click();
  await page.clock.fastForward(60_000);
  expect(calls).toHaveLength(2);
  await page.clock.fastForward(61_000);
  await expect(page.getByText("2 de 2 cards gerados")).toBeVisible();
  expect(calls).toEqual(["Primeira", "Segunda", "Segunda"]);
});

test("batch retries only failed cards and validates required preview fields", async ({ page, request }) => {
  const subgroup = await setup(request);
  await page.route("**/batch-plan", route => route.fulfill({ json: {
    entries: ["Primeira", "Segunda"], common_context: "", subgroup_version: subgroup.version, group_version: subgroup.group.version,
  } }));
  let attempts = 0;
  const calls: string[] = [];
  await page.route("**/batch-generate", route => {
    const { text } = route.request().postDataJSON();
    calls.push(text);
    if (text === "Primeira" && attempts++ === 0) return route.fulfill({ status: 502, json: { detail: "Falha da IA" } });
    return route.fulfill({ json: preview(subgroup, text) });
  });
  await page.goto(`/subgroups/${subgroup.id}`);
  await page.getByRole("button", { name: "Criar vários cards com IA", exact: true }).click();
  await page.getByLabel("Material de estudo").fill("Primeira\nSegunda");
  await page.getByRole("button", { name: "Organizar perguntas" }).click();
  await page.getByRole("button", { name: "Gerar cards", exact: true }).click();
  await expect(page.getByText("1 de 2 cards gerados")).toBeVisible();
  await page.getByRole("button", { name: "Gerar cards restantes" }).click();
  await expect(page.getByText("2 de 2 cards gerados")).toBeVisible();
  expect(calls).toEqual(["Primeira", "Segunda", "Primeira"]);
  await page.locator("summary").filter({ hasText: "Card 1" }).click();
  await page.locator("details[open]").getByLabel("Resposta *").fill("");
  await page.locator("summary").filter({ hasText: "Card 1" }).click();
  await page.getByRole("button", { name: "Salvar 2 cards" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Card 1: preencha o campo Resposta");
  expect((await (await request.get(BASE + `/subgroups/${subgroup.id}/cards`)).json()).total).toBe(0);
});
