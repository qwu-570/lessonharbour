import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyWindows, canRespondToBooking, validateLessonWindow } from "../lib/rules.ts";

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

test("only pending bookings can be accepted or rejected", () => {
  assert.equal(canRespondToBooking("pending", "accepted"), true);
  assert.equal(canRespondToBooking("pending", "rejected"), true);
  assert.equal(canRespondToBooking("accepted", "rejected"), false);
  assert.equal(canRespondToBooking("pending", "cancelled"), false);
});
