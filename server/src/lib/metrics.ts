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

/**
 * Logs the result of a model test, including request and tool call metrics, to the database.
 */
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
		toolsUsed: data.toolsUsed,
		missingTools: data.missingTools,
		unexpectedTools: data.unexpectedTools,
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

/**
 * Retrieves recent AI request metrics from the database.
 */
export async function getRecentMetrics(env: CloudflareBindings) {
	const db = drizzle(env.DB);
	const recentRequests = await db.select().from(aiRequests).all();
	return recentRequests;
}

type ModelSummaryFilter = {
	hasMissingTools?: boolean;
	hasUnexpectedTools?: boolean;
};

/**
 * Fetches and summarizes model performance for a specific query, optionally filtered by tool usage.
 */
export async function getModelSummaryForQuery(
	queryId: string,
	env: CloudflareBindings,
	filter?: ModelSummaryFilter,
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
			hasMissingTools: boolean;
			hasUnexpectedTools: boolean;
			allMissingTools: string[];
			allUnexpectedTools: string[];
			toolAccuracy?: number | null;
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
				hasMissingTools: false,
				hasUnexpectedTools: false,
				allMissingTools: [],
				allUnexpectedTools: [],
				requests: [],
			};
		}
		const modelSummary = summaryByModel[model];

		modelSummary.count += 1;
		modelSummary.totalTokens += req.totalTokens;
		modelSummary.totalToolCalls += req.totalToolCalls;

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

		if (missingTools.length > 0) {
			modelSummary.hasMissingTools = true;
			modelSummary.allMissingTools.push(...missingTools);
		}
		if (unexpectedTools.length > 0) {
			modelSummary.hasUnexpectedTools = true;
			modelSummary.allUnexpectedTools.push(...unexpectedTools);
		}

		modelSummary.requests.push({
			...req,
			toolsUsed,
			missingTools,
			unexpectedTools,
		});
	}

	for (const [_model, modelSummary] of Object.entries(summaryByModel)) {
		const totalRequests = modelSummary.requests.length;
		const correctRequests = modelSummary.requests.filter(
			(req) =>
				(req.missingTools as string[]).length === 0 &&
				(req.unexpectedTools as string[]).length === 0,
		).length;

		modelSummary.toolAccuracy =
			totalRequests > 0 ? (correctRequests / totalRequests) * 100 : null;

		modelSummary.allMissingTools = [...new Set(modelSummary.allMissingTools)];
		modelSummary.allUnexpectedTools = [
			...new Set(modelSummary.allUnexpectedTools),
		];
	}

	let filteredSummaryByModel = summaryByModel;

	if (filter) {
		filteredSummaryByModel = Object.fromEntries(
			Object.entries(summaryByModel).filter(([_, modelSummary]) => {
				if (filter.hasMissingTools && !modelSummary.hasMissingTools)
					return false;
				if (filter.hasUnexpectedTools && !modelSummary.hasUnexpectedTools)
					return false;
				return true;
			}),
		);
	}

	return {
		query,
		summaryByModel: filteredSummaryByModel,
	};
}
