import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const aiRequests = sqliteTable("ai_requests", {
	id: integer().primaryKey({ autoIncrement: true }),
	externalId: text().unique(),
	timestamp: integer({ mode: "timestamp" }).notNull(),
	modelId: text().notNull(),
	totalSteps: integer().notNull(),
	totalToolCalls: integer().notNull(),
	toolsUsed: text({ mode: "json" }),
	missingTools: text({ mode: "json" }),
	unexpectedTools: text({ mode: "json" }),
	promptTokens: integer().notNull(),
	completionTokens: integer().notNull(),
	totalTokens: integer().notNull(),
	errorMessage: text(),
	queryId: text().references(() => queries.id),
});

export const toolCalls = sqliteTable("tool_calls", {
	id: integer().primaryKey({ autoIncrement: true }),
	requestId: text().notNull(),
	toolName: text().notNull(),
	toolCallId: text().notNull(),
	args: text({ mode: "json" }),
	result: text({ mode: "json" }),
	errorMessage: text(),
});

export const queries = sqliteTable("queries", {
	id: text().primaryKey(), // You can use a UUID or hash as the ID
	createdAt: text("timestamp").notNull().default(sql`(current_timestamp)`),
	prompt: text().notNull(),
	expectedTools: text({ mode: "json" }),
	type: text().notNull().default("simple"),
});

export const aiRequestsRelations = relations(aiRequests, ({ many, one }) => ({
	toolCalls: many(toolCalls),
	query: one(queries, {
		fields: [aiRequests.queryId],
		references: [queries.id],
	}),
}));

// Each toolCall belongs to one request
export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
	aiRequest: one(aiRequests, {
		fields: [toolCalls.requestId],
		references: [aiRequests.externalId],
	}),
}));

// Each query has many aiRequests
export const queriesRelations = relations(queries, ({ many }) => ({
	requests: many(aiRequests),
}));
