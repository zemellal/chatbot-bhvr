import { generateText } from "ai";
import { AI_MAX_STEPS } from "shared/dist";
import { getValidatedModelAndTools, MODELS } from "./aiProvider";
import { logModelTestResult } from "./metrics";
import { getQueryById } from "./queries"; // adjust import as needed
import { sleep } from "./utils";

export async function runTestForQuery(
	queryId: string,
	env: CloudflareBindings,
) {
	// 1. Fetch the query
	const query = await getQueryById(queryId, env);
	if (!query) {
		throw new Error(`Query with id ${queryId} not found.`);
	}

	// 2. Get all models (assuming one provider for now)
	const models = MODELS.groq; // Adjust if you support multiple providers

	// 3. Run the test for each model
	const results = [];
	for (const [i, model] of models.entries()) {
		try {
			const { modelInstance, tools, error } = getValidatedModelAndTools({
				provider: "groq", // or dynamic if you support more
				model,
				env,
			});
			if (error) {
				results.push({ model, error });
				continue;
			}

			const { response, text, steps, usage } = await generateText({
				model: modelInstance,
				tools,
				maxSteps: AI_MAX_STEPS,
				prompt: query.prompt,
			});

			const allToolResults = steps.flatMap((step) => step.toolResults);
			const toolsUsed = allToolResults.map((t) => t.toolName);

			const expectedTools = (query.expectedTools as typeof toolsUsed) || [];
			const missingTools = expectedTools.filter((t) => !toolsUsed.includes(t));
			const unexpectedTools = toolsUsed.filter(
				(t) => !expectedTools.includes(t),
			);

			await logModelTestResult(
				{
					requestId: response.id,
					modelId: response.modelId,
					timestamp: response.timestamp,
					usage: usage,
					totalSteps: steps.length,
					totalToolCalls: allToolResults.length,
					allToolResults,
					queryId: query.id,
					toolsUsed,
					missingTools,
					unexpectedTools,
				},
				env,
			);

			results.push({
				model,
				success: true,
				message: text,
				data: {
					requestId: response.id,
					modelId: response.modelId,
					timestamp: response.timestamp,
					usage: usage,
					totalSteps: steps.length,
					totalToolCalls: allToolResults.length,
					allToolResults,
					steps: steps,
				},
			});

			if (i < models.length - 1) {
				await sleep(1000);
			}
		} catch (err) {
			results.push({
				model,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}
