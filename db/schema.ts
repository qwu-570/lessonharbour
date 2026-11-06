import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["student", "tutor"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tutorProfiles = sqliteTable("tutor_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  subjects: text("subjects").notNull().default("[]"),
  bio: text("bio").notNull(),
  bioEn: text("bio_en"),
  bioZh: text("bio_zh"),
  hourlyPrice: integer("hourly_price").notNull(),
  lessonFormat: text("lesson_format", { enum: ["online", "in_person", "both"] }).notNull(),
  generalLocation: text("general_location"),
  postcode: text("postcode"),
  profilePhotoUrl: text("profile_photo_url"),
  languages: text("languages").notNull().default("[]"),
  calendarFeedToken: text("calendar_feed_token"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const studentProfiles = sqliteTable("student_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  postcode: text("postcode").notNull(),
  subjects: text("subjects").notNull().default("[]"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tutorId: text("tutor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("messages_student_tutor_created_idx").on(table.studentId, table.tutorId, table.createdAt)],
);

export const availabilitySlots = sqliteTable(
  "availability_slots",
  {
    id: text("id").primaryKey(),
    tutorId: text("tutor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("slots_tutor_start_unique").on(table.tutorId, table.startsAt)],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    slotId: text("slot_id").notNull().references(() => availabilitySlots.id, { onDelete: "restrict" }),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tutorId: text("tutor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "rejected", "cancelled"] }).notNull().default("pending"),
    cancelledBy: text("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: text("cancelled_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("bookings_slot_unique").on(table.slotId)],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [uniqueIndex("rate_limit_key_window_unique").on(table.key, table.windowStart)],
);
