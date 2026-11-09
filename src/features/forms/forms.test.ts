// Custom forms (migration 0005): the question and answer checks, the table's guards, the public reads, and POST
// /api/forms/<slug> (slug, size, per-visitor-per-form limit, honeypot, closed, one per email, storage).
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type DB } from "@/server/db";
import { DEMO_FORMS } from "./fixtures";
import { toCsv } from "@/features/admin/format";
import { adminFormResponses, CLOSED, CLOSED_MESSAGE_MAX, DUPLICATE, formRequest, formResponsesCsv, openForm, responseEntries, saveAdminForm, setFormOpen } from "./forms.server";
import { checkAnswers, checkQuestions, type Question } from "./schema";
import { saveForm } from "./store";

let db: DB;
const ctx = () => ({ db, actor: null });
const ADMIN = { id: "a1", email: "admin@x.test" };
const rows = () => db.prepare("select f.slug, r.form_version, r.answers, r.email from custom_form_responses r join custom_forms f on f.id = r.form_id order by r.rowid").all();
const questions = DEMO_FORMS[0]!.questions as Question[];
const good = { name: "Rosa Diaz", email: "Rosa@X.test", coming: "yes" };

beforeEach(() => {
  db = openDb(":memory:");
  for (const form of DEMO_FORMS) saveForm(db, form);
  const at = new Date().toISOString();
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values ('a1', 'A', 'admin@x.test', 1, ?, ?)`).run(at, at);
  db.prepare("insert into user_roles (user_id, role) values ('a1', 'admin')").run();
});

/** A JSON POST whose body records whether anything read it. */
function post(body: string, headers: Record<string, string> = {}) {
  const state = { read: false };
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.read = true;
      controller.enqueue(bytes);
      controller.close();
    },
  }, { highWaterMark: 0 });
  const request = new Request("http://club.test/api/forms/x", {
    method: "POST", body: stream, duplex: "half",
    headers: { "Content-Type": "application/json", "Content-Length": String(bytes.byteLength), ...headers },
  } as RequestInit);
  return { request, state };
}
let ipCounter = 0;
const send = async (slug: string, body: object, ip = `10.0.0.${++ipCounter}`) => {
  const res = await formRequest(ctx(), post(JSON.stringify(body), { "cf-connecting-ip": ip }).request, slug);
  return { status: res.status, body: res.status === 204 ? undefined : await res.json() as { error: string } };
};

describe("checkQuestions", () => {
  it("keeps a good definition and normalises it", () => {
    expect(checkQuestions([{ key: "name", type: "short", label: " Name " }])).toEqual([{ key: "name", type: "short", label: "Name", required: false }]);
  });

  it.each([
    [[], /1 to 80/],
    [[{ key: "Name", type: "short", label: "x" }], /own key/],
    [[{ key: "a", type: "short", label: "x" }, { key: "a", type: "short", label: "y" }], /own key/],
    [[{ key: "a", type: "file", label: "x" }], /unknown type/],
    [[{ key: "a", type: "short", label: " " }], /label/],
    [[{ key: "a", type: "radio", label: "x" }], /choices/],
    [[{ key: "a", type: "radio", label: "x", choices: [{ value: "A B", label: "x" }] }], /choices/],
    [[{ key: "a", type: "radio", label: "x", choices: [{ value: "a", label: "x" }, { value: "a", label: "y" }] }], /choices/],
  ])("refuses %j", (input, problem) => expect(() => checkQuestions(input)).toThrow(problem));
});

describe("checkAnswers", () => {
  it("trims, keeps only the form's questions, de-duplicates picks and lower-cases the email", () => {
    expect(checkAnswers(questions, { ...good, name: " Rosa Diaz ", diet: ["vegan", "vegan"], note: "", "form-id": "x", honeypot: "", status: "approved" }))
      .toEqual({ value: { name: "Rosa Diaz", email: "Rosa@X.test", coming: "yes", diet: ["vegan"] }, email: "rosa@x.test" });
  });

  it("names every problem, one per question", () => {
    expect(checkAnswers(questions, { email: "nope", coming: "perhaps", diet: ["meat"], plus_one: "sure", note: 5 })).toEqual({ errors: {
      name: "Please answer “Your name”.",
      email: "Please check “Email”: it should look like name@example.com.",
      coming: "Please choose one of the options for “Are you coming?”.",
      diet: "Please choose from the options for “Anything we should know?”.",
      plus_one: "Please choose one of the options for “Bringing a guest?”.",
      note: "Please check “Anything else?”.",
    } });
  });

  it.each([
    ["url", "https://x.test/a", "ftp://x.test"], ["phone", "+1 (718) 555-0100", "call me"], ["number", "-12.5", "1e9"],
    ["date", "2026-02-28", "2026-02-30"], ["short", "one line", "two\nlines"],
  ] as const)("checks a %s answer", (type, ok, notOk) => {
    const q: Question[] = [{ key: "a", type, label: "A" }];
    expect(checkAnswers(q, { a: ok })).toEqual({ value: { a: ok }, email: null });
    expect(checkAnswers(q, { a: notOk })).toHaveProperty("errors.a");
  });

  it("refuses an answer over 4,000 characters", () => {
    expect(checkAnswers([{ key: "a", type: "paragraph", label: "A" }], { a: "x".repeat(4001) })).toHaveProperty("errors.a");
  });
});

describe("custom_forms table", () => {
  it.each(["media", "beacon", "admin", "Bad", "-a", "a-", "a--b", "a_b", "x".repeat(41)])("refuses the slug %s", (slug) => {
    expect(() => saveForm(db, { ...DEMO_FORMS[1]!, id: "demo0009", slug })).toThrow(/CHECK/);
  });

  it("refuses a bad id, a two-line name, and an old name another form owns", () => {
    expect(() => saveForm(db, { ...DEMO_FORMS[1]!, id: "Demo0009", slug: "x9" })).toThrow(/CHECK/);
    expect(() => saveForm(db, { ...DEMO_FORMS[1]!, id: "demo0009", slug: "x9", name: "a\nb" })).toThrow(/CHECK/);
    expect(() => saveForm(db, { ...DEMO_FORMS[1]!, id: "demo0009", slug: "x9", old_slugs: ["salon-rsvp-old"] })).toThrow(/UNIQUE/);
    expect(db.prepare("select count(*) as n from custom_forms").get()).toEqual({ n: 2 });
  });

  it("keeps a form's answers: a form that has any can't be deleted", async () => {
    expect((await send("salon-rsvp", { answers: good })).status).toBe(204);
    expect(() => db.prepare("delete from custom_forms where id = 'demo0001'").run()).toThrow(/FOREIGN KEY/);
  });
});

describe("openForm", () => {
  it("returns an open form with its questions", () => {
    expect(openForm(ctx(), { slug: "salon-rsvp" })).toMatchObject({ slug: "salon-rsvp", name: "Salon RSVP (demo)", closed: null, moved: false, questions });
  });

  it("marks an old name as moved, to the current slug", () => {
    expect(openForm(ctx(), { slug: "salon-rsvp-old" })).toMatchObject({ slug: "salon-rsvp", moved: true });
  });

  it("gives a closed form its words and no questions, and a default thank-you", () => {
    expect(openForm(ctx(), { slug: "old-survey" })).toMatchObject({
      closed: "This survey has closed. Thank you to everyone who answered.", questions: [], thanks: expect.stringMatching(/Thank you/),
    });
    saveForm(db, { ...DEMO_FORMS[1]!, closed_message: "" });
    expect(openForm(ctx(), { slug: "old-survey" })!.closed).toBe(CLOSED);
  });

  it.each([undefined, {}, { slug: "nope" }, { slug: "../etc" }, { slug: 42 }])("is null for %j", (input) => expect(openForm(ctx(), input)).toBeNull());
});

describe("POST /api/forms/<slug>", () => {
  it("stores only the form's answers, with the form's version and the lower-cased email", async () => {
    expect(await send("salon-rsvp", { answers: { ...good, "form-id": "zzz", extra: "x" }, honeypot: "" })).toEqual({ status: 204, body: undefined });
    expect(rows()).toEqual([{ slug: "salon-rsvp", form_version: 1, answers: JSON.stringify({ name: "Rosa Diaz", email: "Rosa@X.test", coming: "yes" }), email: "rosa@x.test" }]);
  });

  it("gives a filled honeypot the same success, with nothing stored", async () => {
    expect((await send("salon-rsvp", { answers: good, honeypot: "http://spam.test" })).status).toBe(204);
    expect(rows()).toEqual([]);
  });

  it("refuses a second answer from the same email when the form asks for one per email", async () => {
    await send("salon-rsvp", { answers: good });
    expect(await send("salon-rsvp", { answers: { ...good, email: " ROSA@x.test " } })).toEqual({ status: 409, body: { error: DUPLICATE } });
    expect(rows()).toHaveLength(1);
  });

  it("stores answers sent to an old name on the current form", async () => {
    expect((await send("salon-rsvp-old", { answers: good })).status).toBe(204);
    expect(rows()).toMatchObject([{ slug: "salon-rsvp" }]);
  });

  it("refuses a closed form (410), an unknown one (404) and bad answers (400)", async () => {
    expect(await send("old-survey", { answers: { feedback: "Hi" } })).toEqual({ status: 410, body: { error: "This survey has closed. Thank you to everyone who answered." } });
    expect((await send("nope", { answers: good })).status).toBe(404);
    expect(await send("salon-rsvp", { answers: { ...good, coming: "perhaps" } })).toEqual({ status: 400, body: { error: "Please choose one of the options for “Are you coming?”." } });
    expect((await send("salon-rsvp", [])).status).toBe(400);
    expect(rows()).toEqual([]);
  });

  it("refuses a bad slug, a body over 64 KB and one without a length before reading it", async () => {
    const bad = post("{}");
    expect((await formRequest(ctx(), bad.request, "../x")).status).toBe(404);
    const big = post(JSON.stringify({ answers: { note: "x".repeat(64 * 1024) } }));
    expect((await formRequest(ctx(), big.request, "salon-rsvp")).status).toBe(413);
    const unsized = post("{}", { "Content-Length": "" });
    expect((await formRequest(ctx(), unsized.request, "salon-rsvp")).status).toBe(411);
    expect([bad.state.read, big.state.read, unsized.state.read]).toEqual([false, false, false]);
  });

  it("allows 10 per visitor per form in 10 minutes, then 429 without reading the body; other forms and visitors go on", async () => {
    saveForm(db, { ...DEMO_FORMS[0]!, one_per_email: false });
    for (let i = 0; i < 10; i++) expect((await send("salon-rsvp", { answers: good }, "192.0.2.1")).status).toBe(204);
    const over = post(JSON.stringify({ answers: good }), { "cf-connecting-ip": "192.0.2.1" });
    expect((await formRequest(ctx(), over.request, "salon-rsvp")).status).toBe(429);
    expect(over.state.read).toBe(false);
    expect((await send("salon-rsvp-old", { answers: good }, "192.0.2.1")).status).toBe(204);
    expect((await send("salon-rsvp", { answers: good }, "192.0.2.2")).status).toBe(204);
  });
});

describe("adminFormResponses", () => {
  it("is admin-only", () => {
    expect(() => adminFormResponses(ctx())).toThrow(/sign in/i);
  });

  it("lists every form by name with its definition, count, newest date and answers under their labels (choices by label)", async () => {
    await send("salon-rsvp", { answers: { ...good, diet: ["vegan", "no-nuts"], plus_one: "no" } });
    const forms = adminFormResponses({ db, actor: ADMIN });
    expect(forms.map((f) => [f.name, f.open, f.total, f.newest_at !== null, f.closed_message, f.one_per_email, f.version, f.questions.length])).toEqual([
      ["Old survey (demo, closed)", false, 0, false, "This survey has closed. Thank you to everyone who answered.", false, 1, 1],
      ["Salon RSVP (demo)", true, 1, true, "", true, 1, 6],
    ]);
    expect(forms[1]!.intro).toMatch(/Made-up form/);
    expect(forms[1]!.responses[0]!.entries).toEqual([
      { key: "name", label: "Your name", value: "Rosa Diaz" },
      { key: "email", label: "Email", value: "Rosa@X.test" },
      { key: "coming", label: "Are you coming?", value: "Yes" },
      { key: "diet", label: "Anything we should know?", value: ["Vegan", "No nuts"] },
      { key: "plus_one", label: "Bringing a guest?", value: "No" },
    ]);
  });

  it("keeps answers to questions a later version removed, under their key", () => {
    expect(responseEntries([{ key: "a", type: "short", label: "A" }], { a: "x", gone: "y" })).toEqual([
      { key: "a", label: "A", value: "x" }, { key: "gone", label: "gone", value: "y" },
    ]);
  });
});

describe("saveAdminForm", () => {
  const admin = () => ({ db, actor: ADMIN });
  const base = {
    name: "Coffee chat", slug: "coffee-chat", intro: "Say hello.", thanks: "Thanks!",
    closed_message: "Full for now.", open: true, one_per_email: true,
    questions: [
      { key: "name", type: "short" as const, label: "Your name", required: true },
      { key: "email", type: "email" as const, label: "Email", required: true },
    ],
  };

  it("is admin-only", () => {
    expect(() => saveAdminForm(ctx(), base)).toThrow(/sign in/i);
  });

  it("creates a form with a minted id and serves it at /f/<slug>", () => {
    const { id } = saveAdminForm(admin(), base);
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(openForm(ctx(), { slug: "coffee-chat" })).toMatchObject({
      name: "Coffee chat", intro: "Say hello.", thanks: "Thanks!", closed: null, questions: base.questions,
    });
    expect(db.prepare("select version, open, one_per_email from custom_forms where id = ?").get(id))
      .toEqual({ version: 1, open: 1, one_per_email: 1 });
  });

  it("edits a form, bumps version, and keeps the old slug redirecting", async () => {
    const { id } = saveAdminForm(admin(), base);
    await send("coffee-chat", { answers: { name: "Ada", email: "ada@x.test" } });
    saveAdminForm(admin(), {
      ...base, id, slug: "coffee-rsvp", name: "Coffee RSVP",
      questions: [...base.questions, { key: "note", type: "paragraph", label: "Note" }],
    });
    expect(openForm(ctx(), { slug: "coffee-rsvp" })).toMatchObject({ name: "Coffee RSVP", moved: false, questions: expect.arrayContaining([{ key: "note", type: "paragraph", label: "Note", required: false }]) });
    expect(openForm(ctx(), { slug: "coffee-chat" })).toMatchObject({ slug: "coffee-rsvp", moved: true });
    expect(db.prepare("select version from custom_forms where id = ?").get(id)).toEqual({ version: 2 });
    expect(adminFormResponses(admin()).find((f) => f.id === id)?.total).toBe(1);
  });

  it("refuses a bad slug, a taken slug and questions checkQuestions would refuse", () => {
    expect(() => saveAdminForm(admin(), { ...base, slug: "Bad" })).toThrow(/Slug/);
    expect(() => saveAdminForm(admin(), { ...base, slug: "salon-rsvp" })).toThrow(/already taken/i);
    expect(() => saveAdminForm(admin(), { ...base, slug: "ok-form", questions: [{ key: "a", type: "file", label: "x" }] as never })).toThrow(/unknown type/);
    expect(() => saveAdminForm(admin(), { ...base, id: "nope0001", slug: "ok-form" })).toThrow(/Invalid form/);
  });
});

describe("setFormOpen", () => {
  const admin = () => ({ db, actor: ADMIN });

  it("is admin-only", () => {
    expect(() => setFormOpen(ctx(), { id: "demo0001", open: false })).toThrow(/sign in/i);
  });

  it("closes a form so the public page shows the closed message and POST is refused", async () => {
    setFormOpen(admin(), { id: "demo0001", open: false, message: "Salon is full — try next month." });
    expect(openForm(ctx(), { slug: "salon-rsvp" })).toMatchObject({ closed: "Salon is full — try next month.", questions: [] });
    expect((await send("salon-rsvp", { answers: good })).status).toBe(410);
    expect(adminFormResponses(admin()).find((f) => f.id === "demo0001")).toMatchObject({ open: false, closed_message: "Salon is full — try next month." });
  });

  it("re-opens a form and keeps the last closed message when none is sent", () => {
    setFormOpen(admin(), { id: "demo0002", open: true });
    expect(openForm(ctx(), { slug: "old-survey" })).toMatchObject({ closed: null, questions: expect.any(Array) });
    expect(db.prepare("select open, closed_message from custom_forms where id = 'demo0002'").get())
      .toEqual({ open: 1, closed_message: "This survey has closed. Thank you to everyone who answered." });
  });

  it("refuses an unknown form, a bad open flag and a message over 1,000 characters", () => {
    expect(() => setFormOpen(admin(), { id: "nope0001", open: false })).toThrow(/Invalid form/);
    expect(() => setFormOpen(admin(), { id: "demo0001", open: "yes" })).toThrow(/Invalid open/);
    expect(() => setFormOpen(admin(), { id: "demo0001", open: false, message: "x".repeat(CLOSED_MESSAGE_MAX + 1) })).toThrow(/Invalid message/);
  });
});

describe("formResponsesCsv", () => {
  const admin = () => ({ db, actor: ADMIN });

  it("is admin-only", () => {
    expect(() => formResponsesCsv(ctx(), { id: "demo0001" })).toThrow(/sign in/i);
  });

  it("exports every answer with BOM, CRLF, labelled choices and a formula guard", async () => {
    await send("salon-rsvp", { answers: { ...good, diet: ["vegan"], note: "=1+1" } });
    const at = (db.prepare("select created_at from custom_form_responses where form_id = 'demo0001'").get() as { created_at: string }).created_at;
    const { filename, csv } = formResponsesCsv(admin(), { id: "demo0001" });
    expect(filename).toMatch(/^salon-rsvp-responses-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toBe(toCsv(
      ["Received (UTC)", "Your name", "Email", "Are you coming?", "Anything we should know?", "Bringing a guest?", "Anything else?"],
      [[at, "Rosa Diaz", "Rosa@X.test", "Yes", "Vegan", "", "=1+1"]],
    ));
  });

  it("disambiguates duplicate question labels with (key)", () => {
    saveForm(db, {
      id: "demo0003", slug: "dup-labels", name: "Dup labels",
      questions: [
        { key: "a", type: "short", label: "Same" },
        { key: "b", type: "short", label: "Same" },
      ],
    });
    db.prepare("insert into custom_form_responses (form_id, form_version, answers, email) values ('demo0003', 1, ?, null)")
      .run(JSON.stringify({ a: "one", b: "two" }));
    const { csv } = formResponsesCsv(admin(), { id: "demo0003" });
    expect(csv.replace(/^\uFEFF/, "").split("\r\n")[0]).toBe('"Received (UTC)","Same (a)","Same (b)"');
  });
});
