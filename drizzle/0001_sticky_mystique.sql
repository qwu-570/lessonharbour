ALTER TABLE `tutor_profiles` ADD `profile_photo_url` text;--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `languages` text DEFAULT '[]' NOT NULL;