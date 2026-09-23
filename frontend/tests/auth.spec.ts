import { test, expect } from "@playwright/test";

// A deterministic GIS double: no Google account or credential leaves the tests.
const googleScript = `(() => {
  let options;
  window.google = { accounts: { id: {
    initialize(value) { options = value; },
    renderButton(container) {
      const button = document.createElement('button');
      button.textContent = 'Google de teste';
      button.onclick = () => options.callback({ credential: 'test-token' });
      container.replaceChildren(button);
    }
  } } };
})();`;

test.skip(process.env.MEMORICKS_AUTH_E2E !== "1", "Run with MEMORICKS_AUTH_E2E=1 against the disposable accounts server.");

test("Google is the only sign-in option and supports login and logout", async ({ page }) => {
  let signedIn = false;
  await page.route("https://accounts.google.com/gsi/client", route => route.fulfill({ contentType: "application/javascript", body: googleScript }));
  await page.route("**/auth/me", route => route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { mode: "accounts", email: "test@example.com", name: "Teste" } : { detail: "Entre na sua conta." } }));
  await page.route("**/auth/google", async route => {
    signedIn = true;
    await route.fulfill({ json: { mode: "accounts", email: "test@example.com", name: "Teste" } });
  });
  await page.route("**/auth/logout", async route => {
    signedIn = false;
    await route.continue();
  });
  await page.route("**/groups", route => route.fulfill({ json: [] }));
  await page.route("**/review-shortcuts", route => route.fulfill({ json: [] }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Seu conhecimento começa aqui." })).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Criar conta", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Google de teste" }).click();
  const accountButton = page.getByRole("button", { name: "Abrir menu da conta" });
  await expect(accountButton).toBeVisible();
  await accountButton.click();
  const accountMenu = page.getByLabel("Menu da conta", { exact: true });
  await expect(accountMenu).toContainText("Teste");
  await expect(accountMenu).toContainText("test@example.com");
  await expect(accountMenu.getByRole("link", { name: /Configurações da conta/ })).toHaveAttribute("href", "/settings");
  await expect(accountMenu.getByRole("link", { name: /Meus temas/ })).toHaveAttribute("href", "/themes");
  await expect(accountMenu.getByRole("link", { name: /Estatísticas/ })).toHaveAttribute("href", "/statistics");
  await accountMenu.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page.getByRole("button", { name: "Google de teste" })).toBeVisible();
});

test("Google-only login fits the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://accounts.google.com/gsi/client", route => route.fulfill({ contentType: "application/javascript", body: googleScript }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Google de teste" })).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Google script failure can be retried without reloading the page", async ({ page }) => {
  let attempts = 0;
  await page.route("https://accounts.google.com/gsi/client", async (route) => {
    if (++attempts === 1) await route.abort();
    else await route.fulfill({ contentType: "application/javascript", body: googleScript });
  });
  await page.goto("/");
  await expect(page.locator(".auth-error")).toHaveText("Não foi possível carregar o login Google.");
  await page.getByRole("button", { name: "Tentar Google novamente" }).click();
  await expect(page.getByRole("button", { name: "Google de teste" })).toBeVisible();
  expect(attempts).toBe(2);
  await expect(page.locator(".auth-error")).toHaveCount(0);
});

test("expired Google challenge can be renewed and locks the button while logging in", async ({ page, context }) => {
  let attempts = 0;
  const nonces: string[] = [];
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "application/javascript", body: googleScript }));
  await page.route("**/auth/google", async (route) => {
    const { nonce } = route.request().postDataJSON();
    nonces.push(nonce);
    if (++attempts === 1) {
      await route.continue(); // Real backend rejects the missing cookie.
      return;
    }
    await expect(page.getByRole("status")).toHaveText("Entrando…");
    await expect(page.locator(".auth-google")).toHaveAttribute("inert", "");
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Indisponibilidade de teste" }) });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Google de teste" })).toBeVisible();
  await context.clearCookies({ name: "memoricks_login_nonce" });
  await page.getByRole("button", { name: "Google de teste" }).click();
  await expect(page.locator(".auth-error")).toHaveText("Reinicie o login Google.");
  await page.getByRole("button", { name: "Tentar Google novamente" }).click();
  await expect.poll(async () => (await context.cookies()).some(c => c.name === "memoricks_login_nonce")).toBe(true);
  await page.getByRole("button", { name: "Google de teste" }).click();
  await expect(page.locator(".auth-error")).toHaveText("Indisponibilidade de teste");
  expect(nonces[0]).not.toBe(nonces[1]);
  await expect(page.locator(".auth-google")).not.toHaveAttribute("inert", "");
});
