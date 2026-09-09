CREATE TABLE IF NOT EXISTS `platform_migrations` (
  `migration_key` text PRIMARY KEY NOT NULL,
  `applied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
UPDATE `course_drafts`
SET `design_json` = CASE
  WHEN json_valid(`design_json`) THEN json_set(`design_json`, '$.enrolmentMode', 'open')
  ELSE '{"enrolmentMode":"open","priceGhs":0,"certificateFeeGhs":0}'
END;
--> statement-breakpoint
INSERT OR IGNORE INTO `platform_migrations` (`migration_key`) VALUES ('0014_existing_courses_self_enrolment');
