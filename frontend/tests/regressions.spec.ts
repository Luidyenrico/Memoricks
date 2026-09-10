import { test, expect, Page } from "@playwright/test";

const profile = {
  native_language: "pt",
  learning_language: "en",
  learning_language_selected: true,
};
const languages = [
  { code: "en", name: "Inglês" },
  { code: "pt", name: "Português" },
  { code: "es", name: "Espanhol" },
];
const settings = {
  meaning_limit: "Curto (até 10 palavras)",
  explanation_style: "Padrão (até 2 frases)",
  examples_count: 3,
  tone_focus: "Geral",
};
const content = {
  translation: "olá",
  meaning: "Saudação informal",
  explanation: "Use para cumprimentar alguém.",
  examples: [{ learning: "Hello, friend!", native: "Olá, amigo!" }],
  tip: "Cumprimente alguém ao chegar.",
};
const term = {
  id: 1,
  text: "hello",
  type: "word",
  learning_language: "en",
  native_language: "pt",
  exact_translation: "olá",
  generated_content: content,
  difficulty_level: "Easy",
  mastered: false,
  created_at: "2026-09-08T12:00:00Z",
  next_review_date: "2026-09-08T12:05:00",
  mastered_at: null,
};

async function mockAPI(page: Page) {
  await page.route("http://localhost:8000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/profile"
        ? profile
        : path === "/profile/languages"
          ? languages
          : path === "/terms/settings/ai"
            ? settings
            : path === "/terms/stats"
              ? {
                  total_active: 2,
                  pending_review: 2,
                  mastered_words: 0,
                  mastered_expressions: 0,
                }
              : path === "/terms/quiz"
                ? [
                    {
                      term_id: 1,
                      text: "hello",
                      type: "word",
                      correct_translation: "olá",
                      options: ["olá", "adeus", "sim", "não"],
                    },
                  ]
                : path === "/terms/active" || path === "/terms/pending"
                  ? [term, { ...term, id: 2, text: "goodbye" }]
                  : path.startsWith("/terms/mastered/")
                    ? [
                        {
                          ...term,
                          mastered: true,
                          mastered_at: "2026-09-08T12:00:00Z",
                        },
                      ]
                    : term;
    await route.fulfill({ json: body });
  });
}

test.beforeEach(async ({ page }) => {
  await mockAPI(page);
});

test("flashcards save once, retain failed cards, and advance only after success", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/terms/1/review", async (route) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill(
      calls === 1
        ? { status: 503, json: { detail: "Não foi possível salvar." } }
        : { json: term },
    );
  });
  await page.goto("/review");
  await page
    .getByRole("button", { name: "Revelar Explicação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fácil (1d)", exact: true })
    .dblclick();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível" }),
  ).toContainText("Não foi possível salvar");
  expect(calls).toBe(1);
  await expect(page.getByText("Termo 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Fácil (1d)", exact: true }).click();
  await expect(page.getByText("Termo 2 de 2")).toBeVisible();
  expect(calls).toBe(2);
});

test("quiz retries a failed save without double scoring", async ({ page }) => {
  let calls = 0;
  await page.route("**/terms/1/review", async (route) => {
    calls++;
    await route.fulfill(
      calls === 1
        ? { status: 503, json: { detail: "Falha temporária" } }
        : { json: term },
    );
  });
  await page.goto("/review");
  await page
    .getByRole("button", { name: "Quiz de tradução", exact: true })
    .click();
  await page.getByRole("button", { name: "olá", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ver resultado", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("0 acertos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect(page.getByText("1 acertos", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Ver resultado", exact: true })
    .click();
  await expect(page.getByText("Você acertou 1 de 1. Erros: 0.")).toBeVisible();
  expect(calls).toBe(2);
});

test("review-all link actually loads active terms", async ({ page }) => {
  await page.route("**/terms/pending", (route) => route.fulfill({ json: [] }));
  await page.goto("/review?all=true");
  await expect(page.getByText("Modo Prática")).toBeVisible();
  await expect(page.getByText("Termo 1 de 2")).toBeVisible();
});

test("returning from quiz refreshes the flashcard queue", async ({ page }) => {
  let requests = 0;
  let reviewed = false;
  await page.route("**/terms/1/review", (route) => {
    reviewed = true;
    return route.fulfill({ json: term });
  });
  await page.route("**/terms/pending", (route) => {
    requests++;
    return route.fulfill({ json: reviewed ? [] : [term] });
  });
  await page.goto("/review");
  await expect(page.getByText("Termo 1 de 1")).toBeVisible();
  const initialRequests = requests;
  await page
    .getByRole("button", { name: "Quiz de tradução", exact: true })
    .click();
  await page.getByRole("button", { name: "olá", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver resultado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revisar flashcards", exact: true })
    .click();
  await expect(
    page.getByText("Nenhuma revisão pendente", { exact: true }),
  ).toBeVisible();
  expect(requests).toBeGreaterThan(initialRequests);
});

test("modal supports keyboard focus, Escape, and visible connection errors", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Novo termo", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const input = page.getByRole("textbox", {
    name: "Palavra ou Expressão",
    exact: true,
  });
  await expect(input).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("modal-mobile.png") });
  await input.fill("test");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(input).toHaveValue("test");
  await page.route("**/terms/", (route) => route.abort());
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível" }),
  ).toContainText("Não foi possível conectar");
  await expect(input).toHaveValue("test");
});

test("edit form keeps its draft after save failure and uses accessible labels", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/terms/1", (route) => {
    calls++;
    return route.fulfill(
      calls === 1
        ? { status: 500, json: { detail: "Não foi possível salvar." } }
        : {
            json: {
              ...term,
              generated_content: { ...content, translation: "oi" },
            },
          },
    );
  });
  await page.goto("/active");
  await page.getByRole("button", { name: /hello.*Ver detalhes/ }).click();
  await page
    .getByRole("button", { name: "Editar explicações", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Tradução direta", exact: true })
    .fill("oi");
  await page.getByRole("button", { name: /hello.*Ocultar detalhes/ }).click();
  await page.getByRole("button", { name: /hello.*Ver detalhes/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Tradução direta", exact: true }),
  ).toHaveValue("oi");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível" }),
  ).toContainText("Não foi possível salvar");
  await expect(
    page.getByRole("textbox", { name: "Tradução direta", exact: true }),
  ).toHaveValue("oi");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Alterações salvas");
  await expect(
    page.getByRole("button", { name: "Editar explicações", exact: true }),
  ).toBeFocused();
});

test("dashboard exposes initial connection failure without showing false zero stats", async ({
  page,
}) => {
  await page.route("**/profile", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível" }),
  ).toContainText("Não foi possível carregar o painel");
  await expect(
    page.getByRole("button", { name: "Tentar novamente", exact: true }),
  ).toBeVisible();
});

test("failed settings load cannot overwrite saved preferences with defaults", async ({
  page,
}) => {
  await page.route("**/terms/settings/ai", (route) => route.abort());
  await page.goto("/ai");
  await expect(
    page.getByRole("button", { name: "Salvar Configurações", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Tentar carregar novamente" }),
  ).toBeVisible();
});

test("active term shows minutes instead of tomorrow", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-08T12:00:00Z"));
  await page.goto("/active");
  await expect(
    page.getByText("Revisão em 5 min", { exact: true }).first(),
  ).toBeVisible();
});

test("all screens fit a mobile viewport in both themes without runtime errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  for (const theme of ["dark", "light"]) {
    await page.addInitScript(
      (value) => localStorage.setItem("memoricks-theme", value),
      theme,
    );
    for (const path of [
      "/",
      "/active",
      "/mastered",
      "/review",
      "/ai",
      "/profile",
      "/language",
    ]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      if (path === "/active")
        await page.screenshot({
          path: testInfo.outputPath(`active-${theme}.png`),
          fullPage: true,
        });
    }
  }
  expect(errors).toEqual([]);
});

test("desktop navigation fits at tablet and desktop widths", async ({
  page,
}, testInfo) => {
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/active");
    await expect(
      page.getByRole("button", { name: /hello.*Ver detalhes/ }),
    ).toBeVisible();
    const header = page.locator("header");
    expect(
      await header.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`desktop-${width}.png`),
      fullPage: true,
    });
  }
});
