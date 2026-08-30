CREATE TABLE `assessment_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`course_code` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT false NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_attempt_user_course_unique` ON `assessment_attempts` (`user_email`,`course_code`);--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`certificate_code` text NOT NULL,
	`user_email` text NOT NULL,
	`learner_name` text NOT NULL,
	`course_code` text NOT NULL,
	`course_title` text NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_code_unique` ON `certificates` (`certificate_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_user_course_unique` ON `certificates` (`user_email`,`course_code`);--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `question_limit` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `certificate_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `created_by_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `activated_by_email` text;--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `activated_at` text;