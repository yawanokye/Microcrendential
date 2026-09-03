CREATE TABLE IF NOT EXISTS `admin_audit_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `admin_email` text NOT NULL,
  `action` text NOT NULL,
  `details_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_audit_log_admin_idx` ON `admin_audit_log` (`admin_email`);
