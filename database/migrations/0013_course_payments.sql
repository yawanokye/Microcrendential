CREATE TABLE IF NOT EXISTS `payment_orders` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `reference` text NOT NULL,
  `user_email` text NOT NULL,
  `course_code` text NOT NULL,
  `purpose` text NOT NULL,
  `amount_pesewas` integer NOT NULL,
  `currency` text DEFAULT 'GHS' NOT NULL,
  `provider` text DEFAULT 'paystack' NOT NULL,
  `status` text DEFAULT 'initialized' NOT NULL,
  `provider_data_json` text DEFAULT '{}' NOT NULL,
  `paid_at` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `payment_orders_reference_unique` ON `payment_orders` (`reference`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_orders_user_idx` ON `payment_orders` (`user_email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_orders_course_idx` ON `payment_orders` (`course_code`);
