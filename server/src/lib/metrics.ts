import { aiRequests, toolCalls } from "@server/db/schema";
import { drizzle } from "drizzle-orm/d1";

type RequestMetrics = {
	requestId: string;
	timestamp: Date;
	modelId: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	totalSteps: number;
	totalToolCalls: number;
	allToolResults: ToolCallMetrics[];
	errorMessage?: string;
};

type ToolCallMetrics = {
	toolName: string;
	toolCallId: string;
	args: object; // JSON string
	result: object; // JSON string
};

export async function logRequestMetrics(
	data: RequestMetrics,
	env: CloudflareBindings,
) {
	const db = drizzle(env.DB);

	await db.insert(aiRequests).values({
		externalId: data.requestId,
		timestamp: data.timestamp,
		modelId: data.modelId,
		promptTokens: data.usage.promptTokens,
		totalSteps: data.totalSteps,
		totalToolCalls: data.totalToolCalls,
		completionTokens: data.usage.completionTokens,
		totalTokens: data.usage.totalTokens,
		errorMessage: data.errorMessage,
	});

	const toolCallValues = data.allToolResults.map((toolCall) => ({
		requestId: data.requestId,
		toolName: toolCall.toolName,
		toolCallId: toolCall.toolCallId,
		args: toolCall.args,
		result: toolCall.result,
	}));

	await db.insert(toolCalls).values(toolCallValues);
}

export async function getRecentMetrics(env: CloudflareBindings) {
	const db = drizzle(env.DB);
	const recentRequests = await db.select().from(aiRequests).all();
	return recentRequests;
}
