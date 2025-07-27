CREATE TABLE `ai_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`externalId` text,
	`timestamp` integer NOT NULL,
	`modelId` text NOT NULL,
	`totalSteps` integer NOT NULL,
	`totalToolCalls` integer NOT NULL,
	`promptTokens` integer NOT NULL,
	`completionTokens` integer NOT NULL,
	`totalTokens` integer NOT NULL,
	`errorMessage` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_requests_externalId_unique` ON `ai_requests` (`externalId`);--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requestId` text NOT NULL,
	`toolName` text NOT NULL,
	`toolCallId` text NOT NULL,
	`args` text,
	`result` text,
	`errorMessage` text
);
