export const accountRoles = ["student", "tutor"] as const;
export const lessonFormats = ["online", "in_person", "both"] as const;
export const bookingResponses = ["accepted", "rejected"] as const;

export function validateLessonWindow(start: Date, end: Date, now = new Date()) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Lesson times must be valid dates";
  if (start.getUTCMinutes() % 15 !== 0 || start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) return "Start time must use a 15-minute interval";
  if (start.getTime() < now.getTime() + 5 * 60_000) return "Start time must be in the future";
  const duration = end.getTime() - start.getTime();
  if (duration < 30 * 60_000 || duration > 3 * 60 * 60_000) return "Lesson duration must be between 30 minutes and 3 hours";
  return null;
}

export type LocalDateTime = { year: number; month: number; day: number; hour: number; minute: number };

function zonedParts(date: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

export function zonedDateTimeToUtc(local: LocalDateTime, timeZone: string) {
  let timestamp = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const desired = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(timestamp), timeZone);
    const observed = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    const difference = desired - observed;
    timestamp += difference;
    if (difference === 0) break;
  }
  const result = new Date(timestamp);
  const roundTrip = zonedParts(result, timeZone);
  if (Object.keys(local).some((key) => roundTrip[key as keyof LocalDateTime] !== local[key as keyof LocalDateTime])) {
    throw new Error("This local time does not exist in the selected time zone");
  }
  return result;
}

export function buildWeeklyWindows(start: Date, durationMinutes: number, repeatWeeks: number, timeZone?: string) {
  const localStart = timeZone ? zonedParts(start, timeZone) : null;
  const localDateAnchor = localStart ? Date.UTC(localStart.year, localStart.month - 1, localStart.day) : 0;
  return Array.from({ length: repeatWeeks }, (_, index) => {
    let startsAt: Date;
    if (timeZone && localStart) {
      const repeatedDate = new Date(localDateAnchor + index * 7 * 24 * 60 * 60_000);
      startsAt = zonedDateTimeToUtc({ year: repeatedDate.getUTCFullYear(), month: repeatedDate.getUTCMonth() + 1, day: repeatedDate.getUTCDate(), hour: localStart.hour, minute: localStart.minute }, timeZone);
    } else {
      startsAt = new Date(start.getTime() + index * 7 * 24 * 60 * 60_000);
    }
    return { startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) };
  });
}

export const recurrencePatterns = ["once", "weekly_4", "weekly_8", "weekly_12", "weekdays_month", "weekends_month"] as const;
export type RecurrencePattern = (typeof recurrencePatterns)[number];

export function buildAvailabilityWindows(start: Date, durationMinutes: number, recurrence: RecurrencePattern, timeZone: string) {
  if (recurrence === "once") return buildWeeklyWindows(start, durationMinutes, 1, timeZone);
  if (recurrence.startsWith("weekly_")) return buildWeeklyWindows(start, durationMinutes, Number(recurrence.split("_")[1]), timeZone);

  const localStart = zonedParts(start, timeZone);
  const firstDay = Date.UTC(localStart.year, localStart.month - 1, localStart.day);
  const end = new Date(firstDay);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const windows: Array<{ startsAt: Date; endsAt: Date }> = [];
  for (let cursor = firstDay; cursor < end.getTime(); cursor += 24 * 60 * 60_000) {
    const date = new Date(cursor);
    const day = date.getUTCDay();
    const matches = recurrence === "weekdays_month" ? day >= 1 && day <= 5 : day === 0 || day === 6;
    if (!matches) continue;
    const startsAt = zonedDateTimeToUtc({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: localStart.hour, minute: localStart.minute }, timeZone);
    windows.push({ startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) });
  }
  return windows;
}

export function canRespondToBooking(current: string, next: string) {
  return current === "pending" && bookingResponses.includes(next as (typeof bookingResponses)[number]);
}
