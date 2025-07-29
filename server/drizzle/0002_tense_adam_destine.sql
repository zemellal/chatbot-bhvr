PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text DEFAULT (current_timestamp) NOT NULL,
	`prompt` text NOT NULL,
	`expectedTools` text,
	`type` text DEFAULT 'simple' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_queries`("id", "timestamp", "prompt", "expectedTools", "type") SELECT "id", "timestamp", "prompt", "expectedTools", "type" FROM `queries`;--> statement-breakpoint
DROP TABLE `queries`;--> statement-breakpoint
ALTER TABLE `__new_queries` RENAME TO `queries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `toolsUsed` text;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `missingTools` text;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `unexpectedTools` text;