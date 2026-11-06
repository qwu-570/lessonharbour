ALTER TABLE `bookings` ADD `cancelled_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancellation_reason` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancelled_at` text;