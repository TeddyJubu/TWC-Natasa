// View events, open one, RSVP, change the RSVP, book an appointment, against a real deployment and real Cal.
// It needs a listed test event and event type (README, "Cal scheduling"), and creates an RSVP and a booking on them.
import { expect, test } from "@playwright/test";

const { E2E_BASE_URL, E2E_PIN_COOKIE, E2E_EVENT_SLUG, E2E_EVENT_TITLE, E2E_TYPE_SLUG, E2E_TYPE_TITLE } = process.env;
const ATTENDEE = "info+caltest@thewomenscollective.club";

test.skip(!E2E_BASE_URL || !E2E_EVENT_SLUG || !E2E_TYPE_SLUG, "needs a deployment and its test data");

test("view events, RSVP, change it, book an appointment", async ({ page, context }) => {
  if (E2E_PIN_COOKIE) await context.addCookies([{ name: "twc_pin", value: E2E_PIN_COOKIE, url: E2E_BASE_URL! }]);
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) problems.push(m.text()); });

  await page.goto("/gatherings");
  const link = page.getByRole("link", { name: E2E_EVENT_TITLE! });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/gatherings/${E2E_EVENT_SLUG}`));
  await expect(page.getByRole("heading", { level: 1, name: E2E_EVENT_TITLE! })).toBeVisible();

  const rsvp = page.getByRole("form", { name: /RSVP to/ });
  await rsvp.getByLabel(/Your name/).fill("Cal Test");
  await rsvp.getByLabel(/Email/).fill(ATTENDEE);
  await rsvp.getByRole("button", { name: "Send my RSVP" }).click();
  await expect(page.getByText("You’re going. See you there!", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Change my RSVP" }).click();
  await page.getByText("Maybe", { exact: true }).click();
  await page.getByRole("button", { name: "Update my RSVP" }).click();
  await expect(page.getByText("You’re down as a maybe.", { exact: true }).first()).toBeVisible();

  await page.goto("/book");
  await page.getByRole("link", { name: E2E_TYPE_TITLE! }).click();
  await expect(page).toHaveURL(new RegExp(`/book/${E2E_TYPE_SLUG}`));
  const day = page.locator('button[aria-pressed]:not([disabled])[aria-label*=","]').first();
  for (let i = 0; i < 3 && !(await day.isVisible().catch(() => false)); i++) {
    await page.waitForTimeout(1500);
    if (await day.isVisible().catch(() => false)) break;
    await page.getByRole("button", { name: "Next month" }).click();
  }
  await day.click();
  await page.getByRole("list", { name: "Available times" }).getByRole("button").first().click();
  const form = page.getByRole("form", { name: "Your details" });
  await form.getByLabel(/Your name/).fill("Cal Test");
  await form.getByLabel(/Email/).fill(ATTENDEE);
  await form.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page).toHaveURL(/\/booking\/[^?]+.*confirmed=1/);
  await expect(page.getByText("You’re booked.")).toBeVisible();
  expect(problems).toEqual([]);
});
