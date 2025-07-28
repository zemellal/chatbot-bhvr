import { generateText, streamText as streamTextAi } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import { validator } from "hono/validator";
import { AI_MAX_STEPS } from "shared/dist";
import z from "zod";
import { getValidatedModelAndTools, MODELS, PROVIDERS } from "./lib/aiProvider";
import { QUERY_TYPES } from "./lib/constants";
import { getModelSummaryForQuery, getRecentMetrics } from "./lib/metrics";
import { createQuery, getAllQueries } from "./lib/queries";
import { runTestForQuery } from "./lib/testing";
import { fetchWeather } from "./lib/weather";

export const app = new Hono<{ Bindings: CloudflareBindings }>()

	.use(cors())

	.get("/", (c) => {
		return c.text("Hello Hono!");
	})

	.post("/chat", async (c) => {
		try {
			const { messages } = await c.req.json();
			if (!messages) {
				return c.json(
					{ success: false, error: "Missing 'messages' in request body." },
					{ status: 400 },
				);
			}

			const { modelInstance, tools, error } = getValidatedModelAndTools({
				provider: c.req.query("provider"),
				model: c.req.query("model"),
				env: c.env,
			});
			if (error) return c.json(error, { status: 400 });

			const result = streamTextAi({
				model: modelInstance,
				messages,
				tools,
				// onStepFinish({ text, toolCalls, toolResults, finishReason, usage }) {
				// 	console.log("Step finished:", {
				// 		text,
				// 		toolCalls,
				// 		toolResults,
				// 		finishReason,
				// 		usage,
				// 	});
				// 	// your own logic, e.g. for saving the chat history or recording usage
				// },
				onFinish: async () => {
					// Gather all necessary data for logging
					// const { usage, steps } = r;
					// const allToolResults = steps.flatMap((step) => step.toolResults);
					// if (
					// 	steps.length > 0 ||
					// 	allToolResults.length > 0 ||
					// 	(usage &&
					// 		(usage.promptTokens > 0 ||
					// 			usage.completionTokens > 0 ||
					// 			usage.totalTokens > 0))
					// ) {
					// 	await logRequestMetrics(
					// 		{
					// 			requestId: r.response.id,
					// 			modelId: r.response.modelId,
					// 			timestamp: r.response.timestamp,
					// 			usage,
					// 			totalSteps: steps.length,
					// 			totalToolCalls: allToolResults.length,
					// 			allToolResults,
					// 		},
					// 		c.env,
					// 	);
					// }
				},
				maxSteps: AI_MAX_STEPS,
				// toolCallStreaming: true,
				// onError(err) {},
			});

			// Mark the response as a v1 data stream:
			c.header("X-Vercel-AI-Data-Stream", "v1");
			c.header("Content-Type", "text/plain; charset=utf-8");
			c.header("Content-Encoding", "Identity");

			return stream(c, (stream) => stream.pipe(result.toDataStream()));
			// return result.toDataStreamResponse();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	})

	.post("/generate-text", async (c) => {
		try {
			const { prompt, provider, model, expectedTools, type, queryId } =
				await c.req.json();

			const { modelInstance, tools, error } = getValidatedModelAndTools({
				provider,
				model,
				env: c.env,
			});
			if (error) return c.json(error, { status: 400 });

			const { response, text, steps, usage } = await generateText({
				model: modelInstance,
				tools,
				maxSteps: AI_MAX_STEPS,
				prompt: prompt || "What is the weather in San Francisco?",
			});

			const allToolResults = steps.flatMap((step) => step.toolResults);

			return c.json(
				{
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
				},
				{ status: 200 },
			);
		} catch (err) {
			console.error("Error in /generate-text:", err);
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	})

	.post(
		"/queries",
		validator("json", (value, c) => {
			const parsed = z
				.object({
					prompt: z.string(),
					expectedTools: z.array(z.string()),
					type: z.enum(QUERY_TYPES),
				})
				.safeParse(value);
			if (!parsed.success) {
				return c.json(
					{ success: false, error: parsed.error.issues },
					{ status: 401 },
				);
			}
			return parsed.data;
		}),
		async (c) => {
			try {
				const { prompt, expectedTools, type } = c.req.valid("json");

				const query = await createQuery({
					prompt,
					expectedTools,
					type,
					env: c.env,
				});
				return c.json({
					success: true,
					message: "Query created successfully.",
					data: { query: query },
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return c.json(
					{ success: false, error: message || "Unknown error" },
					{ status: 500 },
				);
			}
		},
	)

	.get("/queries", async (c) => {
		try {
			const queries = await getAllQueries(c.env);
			return c.json({
				success: true,
				message: "Queries fetched successfully.",
				data: queries,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	})

	.post(
		"/test-query",
		validator("json", (value, c) => {
			const parsed = z
				.object({
					queryId: z.string(),
				})
				.safeParse(value);
			if (!parsed.success) {
				return c.json(
					{ success: false, error: parsed.error.issues },
					{ status: 401 },
				);
			}
			return parsed.data;
		}),
		async (c) => {
			try {
				const { queryId } = c.req.valid("json");

				const results = await runTestForQuery(queryId, c.env);

				return c.json({
					success: true,
					message: "Test run completed.",
					data: results,
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return c.json(
					{ success: false, error: message || "Unknown error" },
					{ status: 500 },
				);
			}
		},
	)

	.get("/query-summary/:queryId", async (c) => {
		try {
			const queryId = c.req.param("queryId");
			if (!queryId) {
				return c.json(
					{ success: false, error: "Missing queryId in path." },
					{ status: 400 },
				);
			}

			const summary = await getModelSummaryForQuery(queryId, c.env);

			return c.json({
				success: true,
				message: "Query summary fetched successfully.",
				data: summary,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	})

	.get("/models", (c) => {
		return c.json({
			success: true,
			message: "Models and providers fetched successfully.",
			data: {
				providers: PROVIDERS,
				models: MODELS,
			},
		});
	})

	.get("/analytics/recent", async (c) => {
		try {
			const recentRequests = await getRecentMetrics(c.env);

			return c.json({
				success: true,
				message: "Recent requests fetched successfully.",
				data: {
					recentRequests,
				},
			});
		} catch (err) {
			console.error(err);
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	})

	.get("/tools/weather", async (c) => {
		const query = c.req.query("query");
		if (!query) {
			const error = {
				success: false,
				error: "Missing 'query' parameter.",
			};
			return c.json(error, { status: 400 });
		}
		try {
			const weather = await fetchWeather(query, c.env);
			const response = {
				message: weather.request?.query
					? `Weather for ${weather.request.query}`
					: "Weather data",
				data: weather,
				success: true,
			};
			return c.json(response, { status: 200 });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return c.json(
				{ success: false, error: message || "Unknown error" },
				{ status: 500 },
			);
		}
	});

export default app;
