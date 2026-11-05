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

export function buildWeeklyWindows(start: Date, durationMinutes: number, repeatWeeks: number) {
  return Array.from({ length: repeatWeeks }, (_, index) => {
    const startsAt = new Date(start.getTime() + index * 7 * 24 * 60 * 60_000);
    return { startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) };
  });
}

export function canRespondToBooking(current: string, next: string) {
  return current === "pending" && bookingResponses.includes(next as (typeof bookingResponses)[number]);
}
