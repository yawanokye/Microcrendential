CREATE TABLE `course_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`materials_json` text DEFAULT '[]' NOT NULL,
	`assessment_modes_json` text DEFAULT '[]' NOT NULL,
	`gate_required` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
