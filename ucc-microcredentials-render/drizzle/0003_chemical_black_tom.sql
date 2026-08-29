ALTER TABLE `users` ADD `date_of_birth` text;--> statement-breakpoint
ALTER TABLE `users` ADD `gender` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nationality` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `id_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `id_last4` text;--> statement-breakpoint
ALTER TABLE `users` ADD `id_document_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `selfie_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `identity_status` text DEFAULT 'not_submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `verification_note` text;--> statement-breakpoint
ALTER TABLE `users` ADD `reviewed_by_email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `invite_token_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `invite_expires_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `setup_completed_at` text;