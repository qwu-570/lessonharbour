import assert from "node:assert/strict";
import test from "node:test";
import { buildAvailabilityWindows, buildWeeklyWindows, canRespondToBooking, validateLessonWindow, zonedDateTimeToUtc } from "../lib/rules.ts";

test("accepts a valid future lesson window", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");
  assert.equal(validateLessonWindow(new Date("2026-11-06T12:00:00.000Z"), new Date("2026-11-06T13:00:00.000Z"), now), null);
});

test("rejects past and near-immediate lesson windows", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");
  assert.equal(validateLessonWindow(new Date("2026-11-05T12:00:00.000Z"), new Date("2026-11-05T13:00:00.000Z"), now), "Start time must be in the future");
});

test("rejects lesson durations outside the MVP limits", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");
  assert.match(validateLessonWindow(new Date("2026-11-06T12:00:00.000Z"), new Date("2026-11-06T12:20:00.000Z"), now) ?? "", /30 minutes/);
  assert.match(validateLessonWindow(new Date("2026-11-06T12:00:00.000Z"), new Date("2026-11-06T16:00:00.000Z"), now) ?? "", /3 hours/);
});

test("requires availability to start on a 15-minute boundary", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");
  assert.equal(validateLessonWindow(new Date("2026-11-06T12:10:00.000Z"), new Date("2026-11-06T13:10:00.000Z"), now), "Start time must use a 15-minute interval");
});

test("builds weekly repeated availability", () => {
  const windows = buildWeeklyWindows(new Date("2026-11-06T12:15:00.000Z"), 45, 3);
  assert.equal(windows.length, 3);
  assert.equal(windows[0].endsAt.toISOString(), "2026-11-06T13:00:00.000Z");
  assert.equal(windows[2].startsAt.toISOString(), "2026-11-20T12:15:00.000Z");
});

test("converts a selected local time in an IANA time zone", () => {
  assert.equal(zonedDateTimeToUtc({ year: 2026, month: 7, day: 1, hour: 17, minute: 15 }, "Europe/London").toISOString(), "2026-07-01T16:15:00.000Z");
});

test("keeps repeated lessons at the same local time across daylight-saving changes", () => {
  const start = zonedDateTimeToUtc({ year: 2026, month: 10, day: 18, hour: 17, minute: 0 }, "Europe/London");
  const windows = buildWeeklyWindows(start, 60, 3, "Europe/London");
  assert.deepEqual(windows.map(window => window.startsAt.toISOString()), ["2026-10-18T16:00:00.000Z", "2026-10-25T17:00:00.000Z", "2026-11-01T17:00:00.000Z"]);
});

test("builds weekday-only daily slots for one calendar month", () => {
  const start = zonedDateTimeToUtc({ year: 2026, month: 11, day: 5, hour: 17, minute: 15 }, "Europe/London");
  const windows = buildAvailabilityWindows(start, 60, "weekdays_month", "Europe/London");
  assert.equal(windows.length, 22);
  assert.equal(windows.every(window => { const day = window.startsAt.getUTCDay(); return day >= 1 && day <= 5; }), true);
});

test("builds weekend-only daily slots for one calendar month", () => {
  const start = zonedDateTimeToUtc({ year: 2026, month: 11, day: 5, hour: 17, minute: 15 }, "Europe/London");
  const windows = buildAvailabilityWindows(start, 60, "weekends_month", "Europe/London");
  assert.equal(windows.length, 8);
  assert.equal(windows.every(window => { const day = window.startsAt.getUTCDay(); return day === 0 || day === 6; }), true);
});

test("only pending bookings can be accepted or rejected", () => {
  assert.equal(canRespondToBooking("pending", "accepted"), true);
  assert.equal(canRespondToBooking("pending", "rejected"), true);
  assert.equal(canRespondToBooking("accepted", "rejected"), false);
  assert.equal(canRespondToBooking("pending", "cancelled"), false);
});
