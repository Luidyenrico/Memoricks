import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:8100";

test("dashboard, navigation, statistics filters and settings use real data", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const group = await (await request.post(BASE + "/groups", { data: {
    title: "Estudos " + crypto.randomUUID().slice(0, 6), description: "Conceitos para o dia a dia.", context: "", color: "#85a5ff",
  } })).json();
  const presets = await (await request.get(BASE + "/templates")).json();
  const template = presets[0].template;
  const subgroup = await (await request.post(BASE + `/groups/${group.id}/subgroups`, { data: {
    title: "Fundamentos", description: "", context: "", template,
  } })).json();
  for (let i = 0; i < 2; i++) {
    let card = await (await request.post(BASE + `/subgroups/${subgroup.id}/cards`, { data: {
      text: "Conceito " + i, values: Object.fromEntries(template.fields.map((field: { id: string }) => [field.id, "Um conceito para aprender."])),
      template_version: subgroup.template_version, source: "manual",
    } })).json();
    if (i === 0) {
      card = await (await request.post(BASE + `/cards/${card.id}/review`, { data: { action: "easy", version: card.version } })).json();
      await request.post(BASE + `/cards/${card.id}/review`, { data: { action: "master", version: card.version } });
    }
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /cards para revisar/ })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegação principal", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Início", "Meus temas", "Estatísticas", "Configurações"]);
  await expect(page.getByRole("button", { name: /Novo tema|Criar|Editar/ })).toHaveCount(0);
  await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true });
  await nav.getByRole("link", { name: "Estatísticas" }).click();
  await page.getByRole("combobox", { name: "Grupo", exact: true }).selectOption(String(group.id));
  await expect(page.locator(".metrics")).toContainText("Cards no total");
  await expect(page.locator(".metrics strong")).toHaveText(["2", "1", "1", "1"]);
  await page.getByRole("combobox", { name: "Subgrupo", exact: true }).selectOption(String(subgroup.id));
  await page.getByRole("combobox", { name: "Período dos gráficos", exact: true }).selectOption("7");
  await expect(page.getByRole("slider", { name: /Consultar dia/ })).toHaveAttribute("max", "6");
  await page.getByRole("slider").focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("slider")).toHaveValue("0");
  await expect(page.locator(".metrics strong")).toHaveText(["2", "1", "1", "1"]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/statistics-desktop.png", fullPage: true });
  const allTimeResponse = page.waitForResponse((response) => response.url().includes("/statistics?") && response.url().includes("days=all"));
  await page.getByRole("combobox", { name: "Período dos gráficos", exact: true }).selectOption("all");
  const allTime = await (await allTimeResponse).json();
  await expect(page.getByRole("slider")).toHaveAttribute("max", String(allTime.period.days - 1));
  await expect(page.getByRole("slider")).toHaveValue(String(allTime.period.days - 1));
  await expect(page.locator(".metrics strong")).toHaveText(["2", "1", "1", "1"]);
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Grupo", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Subgrupo", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Subgrupo", exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Período dos gráficos", exact: true })).toHaveValue("30");
  await expect(page.getByRole("slider")).toHaveValue("29");
  await page.getByRole("slider").press("Home");
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveValue("29");
  await nav.getByRole("link", { name: "Configurações" }).click();
  await page.getByLabel("Idioma padrão das explicações").selectOption("pt");
  await page.getByRole("button", { name: "Salvar preferência" }).click();
  await expect(page.getByText("Preferência salva.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu de navegação" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Início", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole("heading", { name: /cards para revisar/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/dashboard-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.goto("/statistics");
  await expect(page.locator(".statistics-inspector")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/statistics-mobile-light.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("chart hover previews a day and restores the slider selection on leave", async ({ page }) => {
  await page.goto("/statistics");
  const slider = page.getByRole("slider");
  await expect(slider).toHaveAttribute("max", "29");
  await slider.press("Home");
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("1");
  const cursor = page.locator(".statistics-cursor").first();
  const initialX = Number(await cursor.getAttribute("x1"));
  const selectedDescription = await slider.getAttribute("aria-valuetext");
  const selectedDate = await page.locator(".statistics-inspector label strong").innerText();
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 960 });
    for (const chart of await page.locator(".statistics-chart").all()) {
      await chart.scrollIntoViewIfNeeded();
      const gridLine = await chart.locator(".statistics-grid-line").last().boundingBox();
      expect(gridLine).not.toBeNull();
      const y = gridLine!.y + 16;
      await page.mouse.move(gridLine!.x + gridLine!.width / 4, y);
      await expect(slider).toHaveValue("1");
      await expect(slider).toHaveAttribute("aria-valuetext", selectedDescription!);
      await expect(page.locator(".statistics-inspector label strong")).toHaveText(selectedDate);
      await expect.poll(async () => Number(await cursor.getAttribute("x1"))).toBeGreaterThan(initialX);
      const previewX = Number(await cursor.getAttribute("x1"));
      await expect(chart).not.toHaveAttribute("aria-label", new RegExp(selectedDate));
      await page.mouse.move(gridLine!.x + gridLine!.width * 3 / 4, y);
      await expect.poll(async () => Number(await cursor.getAttribute("x1"))).toBeGreaterThan(previewX);
      await page.mouse.move(0, 0);
      await expect.poll(async () => Number(await cursor.getAttribute("x1"))).toBe(initialX);
      await expect(chart).toHaveAttribute("aria-label", new RegExp(selectedDate));
      await expect(slider).toHaveValue("1");
    }
  }
  await slider.press("End");
  await expect(slider).toHaveValue("29");
  expect(Number(await cursor.getAttribute("x1"))).toBeGreaterThan(initialX);
});
