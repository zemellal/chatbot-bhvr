CREATE TABLE `queries` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`createdAt` integer DEFAULT '"2025-07-27T22:14:27.065Z"'
);
--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `queryId` text REFERENCES queries(id);