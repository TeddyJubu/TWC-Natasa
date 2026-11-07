// Test-only: switch the process timezone, and fail loudly if the runtime ignores the switch.
const original = process.env.TZ;

export function setTz(tz: string) {
  process.env.TZ = tz;
  const probe = new Date("2026-11-09T00:30:00Z");
  const expected = Number(probe.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }));
  if (probe.getHours() !== expected) throw new Error(`TZ=${tz} did not take effect in this test runner`);
}

export function restoreTz() {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
}
