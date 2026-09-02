ALTER TABLE `course_drafts` ADD `design_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `version_number` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `submitted_at` text;
--> statement-breakpoint
ALTER TABLE `course_drafts` ADD `updated_at` text;
--> statement-breakpoint
UPDATE `course_drafts` SET `updated_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP) WHERE `updated_at` IS NULL;
--> statement-breakpoint
ALTER TABLE `certificates` ADD `issuer_name` text DEFAULT 'University of Cape Coast' NOT NULL;
--> statement-breakpoint
ALTER TABLE `certificates` ADD `requirements_json` text DEFAULT '{}' NOT NULL;
