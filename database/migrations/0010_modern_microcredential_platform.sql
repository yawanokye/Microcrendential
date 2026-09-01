ALTER TABLE `users` ADD `student_number` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `education_level` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `occupation` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `organisation` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `interests_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_language` text DEFAULT 'English' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `accessibility_needs` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `terms_accepted_at` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `privacy_accepted_at` text;
--> statement-breakpoint
ALTER TABLE `certificates` ADD `credential_type` text DEFAULT 'microcredential' NOT NULL;
--> statement-breakpoint
ALTER TABLE `certificates` ADD `status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE `certificates` ADD `expires_at` text;
--> statement-breakpoint
ALTER TABLE `certificates` ADD `revoked_at` text;
--> statement-breakpoint
ALTER TABLE `certificates` ADD `revocation_reason` text;
--> statement-breakpoint
UPDATE `users`
SET `student_number` = 'UCC-MC-' || strftime('%Y', `created_at`) || '-' || printf('%06d', `id`)
WHERE `role` = 'learner' AND (`student_number` IS NULL OR `student_number` = '');
