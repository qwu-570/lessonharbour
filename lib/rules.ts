export const accountRoles = ["student", "tutor"] as const;
export const lessonFormats = ["online", "in_person", "both"] as const;
export const bookingResponses = ["accepted", "rejected"] as const;

export function validateLessonWindow(start: Date, end: Date, now = new Date()) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Lesson times must be valid dates";
  if (start.getTime() < now.getTime() + 5 * 60_000) return "Start time must be in the future";
  const duration = end.getTime() - start.getTime();
  if (duration < 30 * 60_000 || duration > 3 * 60 * 60_000) return "Lesson duration must be between 30 minutes and 3 hours";
  return null;
}

export function canRespondToBooking(current: string, next: string) {
  return current === "pending" && bookingResponses.includes(next as (typeof bookingResponses)[number]);
}
