CREATE TABLE `colab_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_code` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`template_file_key` text NOT NULL,
	`template_file_name` text NOT NULL,
	`template_url` text,
	`rubric` text DEFAULT '' NOT NULL,
	`max_mark` integer DEFAULT 100 NOT NULL,
	`pass_mark` integer DEFAULT 50 NOT NULL,
	`attempts_allowed` integer DEFAULT 1 NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `colab_assignments_course_idx` ON `colab_assignments` (`course_code`);--> statement-breakpoint
CREATE INDEX `colab_assignments_creator_idx` ON `colab_assignments` (`created_by_email`);--> statement-breakpoint
CREATE TABLE `colab_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`learner_email` text NOT NULL,
	`attempt_number` integer DEFAULT 1 NOT NULL,
	`submission_type` text NOT NULL,
	`notebook_key` text,
	`notebook_file_name` text,
	`notebook_url` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`mark` integer,
	`passed` integer DEFAULT false NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`assessed_by_email` text,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`assessed_at` text,
	FOREIGN KEY (`assignment_id`) REFERENCES `colab_assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `colab_submission_attempt_unique` ON `colab_submissions` (`assignment_id`,`learner_email`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `colab_submissions_assignment_idx` ON `colab_submissions` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `colab_submissions_learner_idx` ON `colab_submissions` (`learner_email`);
