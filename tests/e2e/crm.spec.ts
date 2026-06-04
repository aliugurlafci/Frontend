/**
 * Phase 12 / U6 — Playwright E2E scaffold (critical flows).
 *
 * Not wired into `npm test` (which runs the node:test unit/integration suite).
 * To run: `npm i -D @playwright/test && npx playwright install && npx playwright
 * test -c tests/e2e`. Assumes `npm run dev` is serving on :3000.
 */
import { test, expect } from "@playwright/test";

test("dashboard renders charts and stats", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Pipeline value by stage")).toBeVisible();
  await expect(page.getByText("Open Pipeline")).toBeVisible();
});

test("command palette opens with Cmd/Ctrl+K and navigates", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.getByPlaceholder("Search records or jump to…").fill("Deals");
  await page.getByRole("button", { name: /Go to Deals/ }).first().click();
  await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();
});

test("theme toggle switches to dark", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /Theme:/ });
  await toggle.click();
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("deals table sorts by amount", async ({ page }) => {
  await page.goto("/deal");
  await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();
  await page.getByRole("button", { name: /Amount/ }).click();
  await expect(page.getByText("Stark — Defense Platform")).toBeVisible();
});

test("open a deal, run a lifecycle transition, see a toast", async ({ page }) => {
  await page.goto("/deal");
  await page.getByText("Umbrella — Lab Systems").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /win/ }).click();
  await expect(page.getByText(/succeeded/i)).toBeVisible();
});

test("rep persona cannot create accounts", async ({ page, context }) => {
  await context.addCookies([{ name: "aula_actor", value: "rep", url: "http://localhost:3000" }]);
  await page.goto("/account");
  await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);
});

// ---- Finance (Billing & AR) flows ----

test("convert a lead into account + contact + deal", async ({ page }) => {
  await page.goto("/lead");
  await page.getByText("Dana Scully").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByText(/converted/i)).toBeVisible();
});

test("create a quote with line items and live totals", async ({ page }) => {
  await page.goto("/quote");
  await page.getByRole("link", { name: "New Quote" }).click();
  await page.getByLabel("Account").selectOption({ index: 1 });
  await page.getByRole("button", { name: /Add line/ }).click();
  await page.getByLabel("Description").first().fill("Consulting");
  await page.getByLabel("Unit price").first().fill("1000");
  await page.getByLabel("Tax rate").first().fill("20");
  await expect(page.getByText("$1,200.00")).toBeVisible(); // line total = 1000 + 20%
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/created/i)).toBeVisible();
});

test("record a payment moves an invoice toward paid", async ({ page }) => {
  await page.goto("/invoice");
  // Open the partially-paid seeded invoice.
  await page.getByRole("link", { name: "INV-1001" }).click();
  await page.getByLabel("Amount").fill("100");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Payment recorded/i)).toBeVisible();
});

test("finance dashboard shows AR aging and can run billing", async ({ page }) => {
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
  await expect(page.getByText("Outstanding")).toBeVisible();
  await expect(page.getByText("AR aging")).toBeVisible();
  await page.getByRole("button", { name: /Run billing/ }).click();
  await expect(page.getByText(/invoice|due/i)).toBeVisible();
});

test("settings exposes governed metadata re-publish", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Re-publish metadata" }).click();
  await expect(page.getByText(/re-published/i)).toBeVisible();
});
