import { generateText, streamText as streamTextAi } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import { AI_MAX_STEPS } from "shared/dist";
import { getValidatedModelAndTools, MODELS, PROVIDERS } from "./lib/aiProvider";
import { getRecentMetrics, logRequestMetrics } from "./lib/metrics";
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
				onFinish: async (r) => {
					// Gather all necessary data for logging
					const { usage, steps } = r;
					const allToolResults = steps.flatMap((step) => step.toolResults);

					await logRequestMetrics(
						{
							requestId: r.response.id,
							modelId: r.response.modelId,
							timestamp: r.response.timestamp,
							usage,
							totalSteps: steps.length,
							totalToolCalls: allToolResults.length,
							allToolResults,
						},
						c.env,
					);
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

	.post("/ai-tool-test", async (c) => {
		const prompt = c.req.query("prompt");

		try {
			const { modelInstance, tools, error } = getValidatedModelAndTools({
				provider: c.req.query("provider"),
				model: c.req.query("model"),
				env: c.env,
			});
			if (error) return c.json(error, { status: 400 });

			const { response, text, steps, usage } = await generateText({
				model: modelInstance,
				tools,
				maxSteps: AI_MAX_STEPS,
				prompt: prompt || "What is the weather in San Francisco?",
			});

			// const allToolCalls = steps.flatMap((step) => step.toolCalls);
			const allToolResults = steps.flatMap((step) => step.toolResults);
			// const allUsage = steps.flatMap((step) => step.usage);

			await logRequestMetrics(
				{
					requestId: response.id,
					modelId: response.modelId,
					timestamp: response.timestamp,
					usage: usage,
					totalSteps: steps.length,
					totalToolCalls: allToolResults.length,
					allToolResults,
				},
				c.env,
			);

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
						// response: response,
					},
				},
				{ status: 200 },
			);
		} catch (err) {
			console.error("Error in /ai-tool-test:", err);
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
