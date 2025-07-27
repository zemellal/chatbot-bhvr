import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const aiRequests = sqliteTable("ai_requests", {
	id: integer().primaryKey({ autoIncrement: true }),
	externalId: text().unique(),
	timestamp: integer({ mode: "timestamp" }).notNull(),
	modelId: text().notNull(),
	totalSteps: integer().notNull(),
	totalToolCalls: integer().notNull(),
	promptTokens: integer().notNull(),
	completionTokens: integer().notNull(),
	totalTokens: integer().notNull(),
	errorMessage: text(),
});

// Each request has many toolCalls
export const requestsRelations = relations(aiRequests, ({ many }) => ({
	toolCalls: many(toolCalls),
}));

export const toolCalls = sqliteTable("tool_calls", {
	id: integer().primaryKey({ autoIncrement: true }),
	requestId: text().notNull(),
	toolName: text().notNull(),
	toolCallId: text().notNull(),
	args: text({ mode: "json" }),
	result: text({ mode: "json" }),
	errorMessage: text(),
});

// Each toolCall belongs to one request
export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
	request: one(aiRequests, {
		fields: [toolCalls.requestId],
		references: [aiRequests.externalId],
	}),
}));
