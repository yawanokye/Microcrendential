CREATE TABLE `virtual_lab_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`practical_id` text NOT NULL,
	`discipline` text NOT NULL,
	`practical_title` text NOT NULL,
	`learner_email` text NOT NULL,
	`attempt_number` integer DEFAULT 1 NOT NULL,
	`observations_json` text DEFAULT '[]' NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`report` text DEFAULT '' NOT NULL,
	`evidence_key` text,
	`evidence_file_name` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`mark` integer,
	`passed` integer DEFAULT false NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`competency_note` text DEFAULT '' NOT NULL,
	`assessed_by_email` text,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`assessed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `virtual_lab_attempt_unique` ON `virtual_lab_submissions` (`practical_id`,`learner_email`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `virtual_lab_practical_idx` ON `virtual_lab_submissions` (`practical_id`);--> statement-breakpoint
CREATE INDEX `virtual_lab_learner_idx` ON `virtual_lab_submissions` (`learner_email`);
