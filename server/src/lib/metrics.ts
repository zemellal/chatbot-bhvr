import * as schema from "@server/db/schema";
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
	queryId?: string; // Optional, if this request is associated with a query
	errorMessage?: string;
	toolsUsed?: string[];
	missingTools?: string[];
	unexpectedTools?: string[];
};

type ToolCallMetrics = {
	toolName: string;
	toolCallId: string;
	args: object; // JSON string
	result: object; // JSON string
};

export async function logModelTestResult(
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
		queryId: data.queryId || null,
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

export async function getModelSummaryForQuery(
	queryId: string,
	env: CloudflareBindings,
) {
	const db = drizzle(env.DB, { schema });

	// Fetch the query itself
	const query = await db.query.queries.findFirst({
		where: (queries, { eq }) => eq(queries.id, queryId),
	});
	if (!query) {
		throw new Error(`Query with id ${queryId} not found`);
	}

	// Fetch all requests for this queryId, including toolCalls
	const requests = await db.query.aiRequests.findMany({
		where: (aiRequests, { eq }) => eq(aiRequests.queryId, queryId),
		with: {
			toolCalls: true,
		},
	});

	// Summarize by modelId
	const summaryByModel: Record<
		string,
		{
			count: number;
			totalTokens: number;
			totalToolCalls: number;
			requests: typeof requests;
		}
	> = {};

	for (const req of requests) {
		const model = req.modelId;
		if (!summaryByModel[model]) {
			summaryByModel[model] = {
				count: 0,
				totalTokens: 0,
				totalToolCalls: 0,
				requests: [],
			};
		}
		summaryByModel[model].count += 1;
		summaryByModel[model].totalTokens += req.totalTokens;
		summaryByModel[model].totalToolCalls += req.totalToolCalls;

		// Normalize toolsUsed, missingTools, unexpectedTools
		const toolsUsed = req.toolsUsed
			? typeof req.toolsUsed === "string"
				? JSON.parse(req.toolsUsed)
				: req.toolsUsed
			: [];
		const missingTools = req.missingTools
			? typeof req.missingTools === "string"
				? JSON.parse(req.missingTools)
				: req.missingTools
			: [];
		const unexpectedTools = req.unexpectedTools
			? typeof req.unexpectedTools === "string"
				? JSON.parse(req.unexpectedTools)
				: req.unexpectedTools
			: [];

		summaryByModel[model].requests.push({
			...req,
			toolsUsed,
			missingTools,
			unexpectedTools,
		});
	}

	return {
		query,
		summaryByModel,
	};
}
